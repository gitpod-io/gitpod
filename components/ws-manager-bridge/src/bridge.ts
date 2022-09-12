/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, interfaces } from "inversify";
import { MessageBusIntegration } from "./messagebus-integration";
import {
    Disposable,
    WorkspaceInstance,
    Queue,
    WorkspaceInstancePort,
    PortVisibility,
    RunningWorkspaceInfo,
    DisposableCollection,
} from "@gitpod/gitpod-protocol";
import {
    WorkspaceStatus,
    WorkspacePhase,
    GetWorkspacesRequest,
    WorkspaceConditionBool,
    PortVisibility as WsManPortVisibility,
} from "@gitpod/ws-manager/lib";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { TracedWorkspaceDB, TracedUserDB, DBWithTracing } from "@gitpod/gitpod-db/lib/traced-db";
import { PrometheusMetricsExporter } from "./prometheus-metrics-exporter";
import { ClientProvider, WsmanSubscriber } from "./wsman-subscriber";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Configuration } from "./config";
import { WorkspaceCluster } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { PreparingUpdateEmulator, PreparingUpdateEmulatorFactory } from "./preparing-update-emulator";
import { performance } from "perf_hooks";
import { PrebuildUpdater } from "./prebuild-updater";

export const WorkspaceManagerBridgeFactory = Symbol("WorkspaceManagerBridgeFactory");

function toBool(b: WorkspaceConditionBool | undefined): boolean | undefined {
    if (b === WorkspaceConditionBool.EMPTY) {
        return;
    }

    return b === WorkspaceConditionBool.TRUE;
}

export type WorkspaceClusterInfo = Pick<WorkspaceCluster, "name" | "url" | "govern">;

@injectable()
export class WorkspaceManagerBridge implements Disposable {
    @inject(TracedWorkspaceDB)
    protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;

    @inject(TracedUserDB)
    protected readonly userDB: DBWithTracing<UserDB>;

    @inject(MessageBusIntegration)
    protected readonly messagebus: MessageBusIntegration;

    @inject(PrometheusMetricsExporter)
    protected readonly prometheusExporter: PrometheusMetricsExporter;

    @inject(Configuration)
    protected readonly config: Configuration;

    @inject(PreparingUpdateEmulatorFactory)
    protected readonly preparingUpdateEmulatorFactory: interfaces.Factory<PreparingUpdateEmulator>;

    @inject(IAnalyticsWriter)
    protected readonly analytics: IAnalyticsWriter;

    @inject(PrebuildUpdater)
    protected readonly prebuildUpdater: PrebuildUpdater;

    protected readonly disposables = new DisposableCollection();
    protected readonly queues = new Map<string, Queue>();

    protected cluster: WorkspaceClusterInfo;

    public start(cluster: WorkspaceClusterInfo, clientProvider: ClientProvider) {
        const logPayload = { name: cluster.name, url: cluster.url, govern: cluster.govern };
        log.info(`Starting bridge to cluster...`, logPayload);
        this.cluster = cluster;

        const startStatusUpdateHandler = (writeToDB: boolean) => {
            log.debug(`Starting status update handler: ${cluster.name}`, logPayload);
            /* no await */ this.startStatusUpdateHandler(clientProvider, writeToDB, logPayload)
                // this is a mere safe-guard: we do not expect the code inside to fail
                .catch((err) => log.error("Cannot start status update handler", err));
        };

        if (cluster.govern) {
            // notify servers and _update the DB_
            startStatusUpdateHandler(true);

            // the actual "governing" part
            const controllerIntervalSeconds = this.config.controllerIntervalSeconds;
            if (controllerIntervalSeconds <= 0) {
                throw new Error("controllerIntervalSeconds <= 0!");
            }

            log.debug(`Starting controller: ${cluster.name}`, logPayload);
            // Control all workspace instances, either against ws-manager or configured timeouts
            this.startController(clientProvider, controllerIntervalSeconds, this.config.controllerMaxDisconnectSeconds);
        } else {
            // _DO NOT_ update the DB (another bridge is responsible for that)
            // Still, listen to all updates, generate/derive new state and distribute it locally!
            startStatusUpdateHandler(false);

            // emulate WorkspaceInstance updates for all Workspaces in the  "preparing" or "building" phase in this cluster
            const updateEmulator = this.preparingUpdateEmulatorFactory() as PreparingUpdateEmulator;
            this.disposables.push(updateEmulator);
            updateEmulator.start(cluster.name);
        }
        log.info(`Started bridge to cluster.`, logPayload);
    }

    public stop() {
        this.dispose();
    }

    protected async startStatusUpdateHandler(
        clientProvider: ClientProvider,
        writeToDB: boolean,
        logPayload: {},
    ): Promise<void> {
        const subscriber = new WsmanSubscriber(clientProvider);
        this.disposables.push(subscriber);

        const onReconnect = (ctx: TraceContext, s: WorkspaceStatus[]) => {
            s.forEach((sx) =>
                this.serializeMessagesByInstanceId<WorkspaceStatus>(
                    ctx,
                    sx,
                    (m) => m.getId(),
                    (ctx, msg) => this.handleStatusUpdate(ctx, msg, writeToDB),
                ),
            );
        };
        const onStatusUpdate = (ctx: TraceContext, s: WorkspaceStatus) => {
            this.serializeMessagesByInstanceId<WorkspaceStatus>(
                ctx,
                s,
                (msg) => msg.getId(),
                (ctx, s) => this.handleStatusUpdate(ctx, s, writeToDB),
            );
        };
        await subscriber.subscribe({ onReconnect, onStatusUpdate }, logPayload);
    }

    protected serializeMessagesByInstanceId<M>(
        ctx: TraceContext,
        msg: M,
        getInstanceId: (msg: M) => string,
        handler: (ctx: TraceContext, msg: M) => Promise<void>,
    ) {
        const instanceId = getInstanceId(msg);
        if (!instanceId) {
            log.warn("Received invalid message, could not read instanceId!", { msg });
            return;
        }

        // We can't just handle the status update directly, but have to "serialize" it to ensure the updates stay in order.
        // If we did not do this, the async nature of our code would allow for one message to overtake the other.
        let q = this.queues.get(instanceId) || new Queue();
        q.enqueue(() => handler(ctx, msg)).catch((e) => log.error({ instanceId }, e));
        this.queues.set(instanceId, q);
    }

    protected async handleStatusUpdate(ctx: TraceContext, rawStatus: WorkspaceStatus, writeToDB: boolean) {
        const start = performance.now();
        const status = rawStatus.toObject();
        log.info("Handling WorkspaceStatus update", status);

        if (!status.spec || !status.metadata || !status.conditions) {
            log.warn("Received invalid status update", status);
            return;
        }

        const logCtx = {
            instanceId: status.id!,
            workspaceId: status.metadata!.metaId!,
            userId: status.metadata!.owner!,
        };

        try {
            this.prometheusExporter.reportWorkspaceInstanceUpdateStarted(
                writeToDB,
                this.cluster.name,
                status.spec.type,
            );
            await this.statusUpdate(ctx, rawStatus, writeToDB);
        } catch (e) {
            const durationMs = performance.now() - start;
            this.prometheusExporter.reportWorkspaceInstanceUpdateCompleted(
                durationMs / 1000,
                writeToDB,
                this.cluster.name,
                status.spec.type,
                e,
            );
            log.error(logCtx, "Failed to complete WorkspaceInstance status update", e);
            throw e;
        }
        const durationMs = performance.now() - start;
        this.prometheusExporter.reportWorkspaceInstanceUpdateCompleted(
            durationMs / 1000,
            writeToDB,
            this.cluster.name,
            status.spec.type,
        );
        log.info(logCtx, "Successfully completed WorkspaceInstance status update");
    }

    private async statusUpdate(ctx: TraceContext, rawStatus: WorkspaceStatus, writeToDB: boolean) {
        const status = rawStatus.toObject();

        if (!status.spec || !status.metadata || !status.conditions) {
            return;
        }

        const span = TraceContext.startSpan("handleStatusUpdate", ctx);
        span.setTag("status", JSON.stringify(filterStatus(status)));
        span.setTag("writeToDB", writeToDB);
        span.setTag("statusVersion", status.statusVersion);
        try {
            // Beware of the ID mapping here: What's a workspace to the ws-manager is a workspace instance to the rest of the system.
            //                                The workspace ID of ws-manager is the workspace instance ID in the database.
            //                                The meta ID of ws-manager is the workspace ID in the database.
            const instanceId = status.id!;
            const workspaceId = status.metadata!.metaId!;
            const userId = status.metadata!.owner!;
            const logContext: LogContext = {
                userId,
                instanceId,
                workspaceId,
            };

            const instance = await this.workspaceDB.trace({ span }).findInstanceById(instanceId);
            if (instance) {
                this.prometheusExporter.statusUpdateReceived(this.cluster.name, true);
            } else {
                // This scenario happens when the update for a WorkspaceInstance is picked up by a ws-manager-bridge in a different region,
                // before db-sync finished running. This is because all ws-manager-bridge instances receive updates from all WorkspaceClusters.
                // We ignore this update because we do not have anything to reconcile this update against, but also because we assume it is handled
                // by another instance of ws-manager-bridge that is in the region where the WorkspaceInstance record was created.
                this.prometheusExporter.statusUpdateReceived(this.cluster.name, false);
                return;
            }

            const currentStatusVersion = instance.status.version || 0;
            if (currentStatusVersion > 0 && currentStatusVersion >= status.statusVersion) {
                // We've gotten an event which is older than one we've already processed. We shouldn't process the stale one.
                span.setTag("statusUpdate.staleEvent", true);
                this.prometheusExporter.recordStaleStatusUpdate();
                log.debug(ctx, "Stale status update received, skipping.");
            }

            if (!!status.spec.exposedPortsList) {
                instance.status.exposedPorts = status.spec.exposedPortsList.map((p) => {
                    return <WorkspaceInstancePort>{
                        port: p.port,
                        visibility: mapPortVisibility(p.visibility),
                        url: p.url,
                    };
                });
            }

            if (!instance.status.conditions.firstUserActivity && status.conditions.firstUserActivity) {
                // Only report this when it's observed the first time
                const firstUserActivity = mapFirstUserActivity(rawStatus.getConditions()!.getFirstUserActivity())!;
                this.prometheusExporter.observeFirstUserActivity(instance, firstUserActivity);
            }

            instance.ideUrl = status.spec.url!;
            instance.status.version = status.statusVersion;
            instance.status.timeout = status.spec.timeout;
            if (!!instance.status.conditions.failed && !status.conditions.failed) {
                // We already have a "failed" condition, and received an empty one: This is a bug, "failed" conditions are terminal per definition.
                // Do not override!
                log.error(logContext, 'We received an empty "failed" condition overriding an existing one!', {
                    current: instance.status.conditions.failed,
                });

                // TODO(gpl) To make ensure we do not break anything big time we keep the unconditional override for now, and observe for some time.
                instance.status.conditions.failed = status.conditions.failed;
            } else {
                instance.status.conditions.failed = status.conditions.failed;
            }
            instance.status.conditions.pullingImages = toBool(status.conditions.pullingImages!);
            instance.status.conditions.deployed = toBool(status.conditions.deployed);
            instance.status.conditions.timeout = status.conditions.timeout;
            instance.status.conditions.firstUserActivity = mapFirstUserActivity(
                rawStatus.getConditions()!.getFirstUserActivity(),
            );
            instance.status.conditions.headlessTaskFailed = status.conditions.headlessTaskFailed;
            instance.status.conditions.stoppedByRequest = toBool(status.conditions.stoppedByRequest);
            instance.status.message = status.message;
            instance.status.nodeName = instance.status.nodeName || status.runtime?.nodeName;
            instance.status.podName = instance.status.podName || status.runtime?.podName;
            instance.status.nodeIp = instance.status.nodeIp || status.runtime?.nodeIp;
            instance.status.ownerToken = status.auth!.ownerToken;

            if (status.repo) {
                const r = status.repo;
                const undefinedIfEmpty = <T>(l: T[]) => (l.length > 0 ? l : undefined);

                instance.status.repo = {
                    branch: r.branch,
                    latestCommit: r.latestCommit,
                    uncommitedFiles: undefinedIfEmpty(r.uncommitedFilesList),
                    totalUncommitedFiles: r.totalUncommitedFiles,
                    unpushedCommits: undefinedIfEmpty(r.unpushedCommitsList),
                    totalUntrackedFiles: r.totalUntrackedFiles,
                    untrackedFiles: undefinedIfEmpty(r.untrackedFilesList),
                    totalUnpushedCommits: r.totalUnpushedCommits,
                };
            }

            let lifecycleHandler: (() => Promise<void>) | undefined;
            switch (status.phase) {
                case WorkspacePhase.PENDING:
                    instance.status.phase = "pending";
                    break;
                case WorkspacePhase.CREATING:
                    instance.status.phase = "creating";
                    break;
                case WorkspacePhase.INITIALIZING:
                    instance.status.phase = "initializing";
                    break;
                case WorkspacePhase.RUNNING:
                    if (!instance.startedTime) {
                        instance.startedTime = new Date().toISOString();
                        this.prometheusExporter.observeWorkspaceStartupTime(instance);
                        this.analytics.track({
                            event: "workspace_running",
                            messageId: `bridge-wsrun-${instance.id}`,
                            properties: { instanceId: instance.id, workspaceId: workspaceId },
                            userId,
                        });
                    }

                    instance.status.phase = "running";
                    // let's check if the state is inconsistent and be loud if it is.
                    if (instance.stoppedTime || instance.stoppingTime) {
                        log.error("Resetting already stopped workspace to running.", {
                            instanceId: instance.id,
                            stoppedTime: instance.stoppedTime,
                        });
                        instance.stoppedTime = undefined;
                        instance.stoppingTime = undefined;
                    }
                    break;
                case WorkspacePhase.INTERRUPTED:
                    instance.status.phase = "interrupted";
                    break;
                case WorkspacePhase.STOPPING:
                    if (instance.status.phase != "stopped") {
                        instance.status.phase = "stopping";
                        if (!instance.stoppingTime) {
                            // The first time a workspace enters stopping we record that as it's stoppingTime time.
                            // This way we don't take the time a workspace requires to stop into account when
                            // computing the time a workspace instance was running.
                            instance.stoppingTime = new Date().toISOString();
                        }
                    } else {
                        log.warn(logContext, "Got a stopping event for an already stopped workspace.", instance);
                    }
                    break;
                case WorkspacePhase.STOPPED:
                    const now = new Date().toISOString();
                    instance.stoppedTime = now;
                    instance.status.phase = "stopped";
                    if (!instance.stoppingTime) {
                        // It's possible we've never seen a stopping update, hence have not set the `stoppingTime`
                        // yet. Just for this case we need to set it now.
                        instance.stoppingTime = now;
                    }
                    lifecycleHandler = () => this.onInstanceStopped({ span }, userId, instance);
                    break;
            }

            span.setTag("after", JSON.stringify(instance));

            // now notify all prebuild listeners about updates - and update DB if needed
            await this.prebuildUpdater.updatePrebuiltWorkspace({ span }, userId, status, writeToDB);

            // update volume snapshot information
            if (
                status.conditions.volumeSnapshot &&
                status.conditions.volumeSnapshot.volumeSnapshotName != "" &&
                writeToDB
            ) {
                if (status.conditions.volumeSnapshot.volumeSnapshotName != instance.id) {
                    log.error(logContext, "volume snapshot name doesn't match workspace instance id", {
                        volumeSnapshotName: status.conditions.volumeSnapshot.volumeSnapshotName,
                    });
                } else {
                    let existingSnapshot = await this.workspaceDB
                        .trace(ctx)
                        .findVolumeSnapshotById(status.conditions.volumeSnapshot.volumeSnapshotName);
                    if (existingSnapshot === undefined) {
                        await this.workspaceDB.trace(ctx).storeVolumeSnapshot({
                            id: status.conditions.volumeSnapshot.volumeSnapshotName,
                            workspaceId: workspaceId,
                            creationTime: new Date().toISOString(),
                            volumeHandle: status.conditions.volumeSnapshot.volumeSnapshotHandle,
                        });
                    }
                }
            }

            if (writeToDB) {
                await this.workspaceDB.trace(ctx).storeInstance(instance);

                // cleanup
                // important: call this after the DB update
                if (!!lifecycleHandler) {
                    await lifecycleHandler();
                }
            }
            await this.messagebus.notifyOnInstanceUpdate(ctx, userId, instance);
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected startController(
        clientProvider: ClientProvider,
        controllerIntervalSeconds: number,
        controllerMaxDisconnectSeconds: number,
        maxTimeToRunningPhaseSeconds = 60 * 60,
    ) {
        let disconnectStarted = Number.MAX_SAFE_INTEGER;
        this.disposables.push(
            repeat(async () => {
                const span = TraceContext.startSpan("controlInstances");
                const ctx = { span };
                try {
                    const installation = this.cluster.name;
                    log.debug("Controlling instances...", { installation });

                    const runningInstances = await this.workspaceDB
                        .trace(ctx)
                        .findRunningInstancesWithWorkspaces(installation, undefined, true);

                    // Control running workspace instances against ws-manager
                    try {
                        await this.controlRunningInstances(
                            ctx,
                            runningInstances,
                            clientProvider,
                            maxTimeToRunningPhaseSeconds,
                        );

                        disconnectStarted = Number.MAX_SAFE_INTEGER; // Reset disconnect period
                    } catch (err) {
                        if (durationLongerThanSeconds(disconnectStarted, controllerMaxDisconnectSeconds)) {
                            log.warn("Error while controlling installation's workspaces", err, {
                                installation: this.cluster.name,
                            });
                        } else if (disconnectStarted > Date.now()) {
                            disconnectStarted = Date.now();
                        }
                    }

                    // Control workspace instances against timeouts
                    await this.controlInstancesTimeouts(ctx, runningInstances);

                    log.debug("Done controlling instances.", { installation });
                } catch (err) {
                    TraceContext.setError(ctx, err);
                    log.error("Error while controlling installation's workspaces", err, {
                        installation: this.cluster.name,
                    });
                } finally {
                    span.finish();
                }
            }, controllerIntervalSeconds * 1000),
        );
    }

    /**
     * This methods controls all instances that we have currently marked as "running" in the DB.
     * It checks whether they are still running with their respective ws-manager, and if not, marks them as stopped in the DB.
     */
    protected async controlRunningInstances(
        parentCtx: TraceContext,
        runningInstances: RunningWorkspaceInfo[],
        clientProvider: ClientProvider,
        maxTimeToRunningPhaseSeconds: number,
    ) {
        const installation = this.config.installation;

        const span = TraceContext.startSpan("controlRunningInstances", parentCtx);
        const ctx = { span };
        try {
            log.debug("Controlling running instances...", { installation });

            const runningInstancesIdx = new Map<string, RunningWorkspaceInfo>();
            runningInstances.forEach((i) => runningInstancesIdx.set(i.latestInstance.id, i));

            const client = await clientProvider();
            const actuallyRunningInstances = await client.getWorkspaces(ctx, new GetWorkspacesRequest());
            actuallyRunningInstances.getStatusList().forEach((s) => runningInstancesIdx.delete(s.getId()));

            for (const [instanceId, ri] of runningInstancesIdx.entries()) {
                const instance = ri.latestInstance;
                // This ensures that the workspace instance is not in a
                // non-running phase for longer than the max time
                if (
                    !(
                        instance.status.phase === "running" ||
                        durationLongerThanSeconds(Date.parse(instance.creationTime), maxTimeToRunningPhaseSeconds)
                    )
                ) {
                    log.debug({ instanceId }, "Skipping instance", {
                        phase: instance.status.phase,
                        creationTime: instance.creationTime,
                        region: instance.region,
                    });
                    continue;
                }

                log.info(
                    { instanceId, workspaceId: instance.workspaceId },
                    "Database says the instance is running, but wsman does not know about it. Marking as stopped in database.",
                    { installation },
                );
                await this.markWorkspaceInstanceAsStopped(ctx, ri, new Date());
            }

            log.debug("Done controlling running instances.", { installation });
        } catch (err) {
            TraceContext.setError(ctx, err);
            throw err; // required by caller
        }
    }

    /**
     * This methods controls all instances of this installation during periods where ws-manager does not control them, but we have them in our DB.
     * These currently are:
     *  - preparing
     *  - building
     * It also covers these phases, as fallback, when - for whatever reason - we no longer receive updates from ws-manager.
     *  - unknown (fallback)
     */
    protected async controlInstancesTimeouts(parentCtx: TraceContext, runningInstances: RunningWorkspaceInfo[]) {
        const installation = this.config.installation;

        const span = TraceContext.startSpan("controlDBInstances", parentCtx);
        const ctx = { span };
        try {
            log.debug("Controlling DB instances...", { installation });

            await Promise.all(runningInstances.map((info) => this.controlInstanceTimeouts(ctx, info)));

            log.debug("Done controlling DB instances.", { installation });
        } catch (err) {
            log.error("Error while running controlDBInstances", err, {
                installation: this.cluster.name,
            });
            TraceContext.setError(ctx, err);
        } finally {
            span.finish();
        }
    }

    protected async controlInstanceTimeouts(parentCtx: TraceContext, info: RunningWorkspaceInfo) {
        const logContext: LogContext = {
            userId: info.workspace.ownerId,
            workspaceId: info.workspace.id,
            instanceId: info.latestInstance.id,
        };
        const ctx = TraceContext.childContext("controlDBInstance", parentCtx);
        try {
            const now = Date.now();
            const creationTime = new Date(info.latestInstance.creationTime).getTime();
            const timedOutInPreparing = now >= creationTime + this.config.timeouts.preparingPhaseSeconds * 1000;
            const timedOutInBuilding = now >= creationTime + this.config.timeouts.buildingPhaseSeconds * 1000;
            const timedOutInUnknown = now >= creationTime + this.config.timeouts.unknownPhaseSeconds * 1000;
            const currentPhase = info.latestInstance.status.phase;

            log.debug(logContext, "Controller: Checking for instances in the DB to mark as stopped", {
                creationTime,
                timedOutInPreparing,
                currentPhase,
            });

            if (
                (currentPhase === "preparing" && timedOutInPreparing) ||
                (currentPhase === "building" && timedOutInBuilding) ||
                (currentPhase === "unknown" && timedOutInUnknown)
            ) {
                log.info(logContext, "Controller: Marking workspace instance as stopped", {
                    creationTime,
                    currentPhase,
                });
                await this.markWorkspaceInstanceAsStopped(ctx, info, new Date(now));
            }
        } catch (err) {
            log.warn(logContext, "Controller: Error while marking workspace instance as stopped", err);
            TraceContext.setError(ctx, err);
        } finally {
            ctx.span.finish();
        }
    }

    protected async markWorkspaceInstanceAsStopped(ctx: TraceContext, info: RunningWorkspaceInfo, now: Date) {
        const nowISO = now.toISOString();
        info.latestInstance.stoppingTime = nowISO;
        info.latestInstance.stoppedTime = nowISO;
        info.latestInstance.status.phase = "stopped";
        await this.workspaceDB.trace(ctx).storeInstance(info.latestInstance);

        await this.messagebus.notifyOnInstanceUpdate(ctx, info.workspace.ownerId, info.latestInstance);
        await this.prebuildUpdater.stopPrebuildInstance(ctx, info.latestInstance);
    }

    protected async onInstanceStopped(
        ctx: TraceContext,
        ownerUserID: string,
        instance: WorkspaceInstance,
    ): Promise<void> {
        const span = TraceContext.startSpan("onInstanceStopped", ctx);

        try {
            await this.userDB.trace({ span }).deleteGitpodTokensNamedLike(ownerUserID, `${instance.id}-%`);
            this.analytics.track({
                userId: ownerUserID,
                event: "workspace_stopped",
                messageId: `bridge-wsstopped-${instance.id}`,
                properties: { instanceId: instance.id, workspaceId: instance.workspaceId },
            });
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    public dispose() {
        this.disposables.dispose();
    }
}

const mapFirstUserActivity = (firstUserActivity: Timestamp | undefined): string | undefined => {
    if (!firstUserActivity) {
        return undefined;
    }

    return firstUserActivity.toDate().toISOString();
};

const mapPortVisibility = (visibility: WsManPortVisibility | undefined): PortVisibility | undefined => {
    switch (visibility) {
        case undefined:
            return undefined;
        case WsManPortVisibility.PORT_VISIBILITY_PRIVATE:
            return "private";
        case WsManPortVisibility.PORT_VISIBILITY_PUBLIC:
            return "public";
    }
};

const durationLongerThanSeconds = (time: number, durationSeconds: number, now: number = Date.now()) => {
    return (now - time) / 1000 > durationSeconds;
};

/**
 * Filter here to avoid overloading spans
 * @param status
 */
const filterStatus = (status: WorkspaceStatus.AsObject): Partial<WorkspaceStatus.AsObject> => {
    return {
        id: status.id,
        metadata: status.metadata,
        phase: status.phase,
        message: status.message,
        conditions: status.conditions,
        runtime: status.runtime,
    };
};
