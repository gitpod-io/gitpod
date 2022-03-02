/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, interfaces } from "inversify";
import { MessageBusIntegration } from "./messagebus-integration";
import { Disposable, WorkspaceInstance, Queue, WorkspaceInstancePort, PortVisibility, RunningWorkspaceInfo, DisposableCollection } from "@gitpod/gitpod-protocol";
import { WorkspaceStatus, WorkspacePhase, GetWorkspacesRequest, WorkspaceConditionBool, PortVisibility as WsManPortVisibility, WorkspaceType, PromisifiedWorkspaceManagerClient } from "@gitpod/ws-manager/lib";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { TracedWorkspaceDB, TracedUserDB, DBWithTracing } from '@gitpod/gitpod-db/lib/traced-db';
import { PrometheusMetricsExporter } from "./prometheus-metrics-exporter";
import { ClientProvider, WsmanSubscriber } from "./wsman-subscriber";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Configuration } from "./config";
import { WorkspaceCluster } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { PreparingUpdateEmulator, PreparingUpdateEmulatorFactory } from "./preparing-update-emulator";

export const WorkspaceManagerBridgeFactory = Symbol("WorkspaceManagerBridgeFactory");

function toBool(b: WorkspaceConditionBool | undefined): boolean | undefined {
    if (b === WorkspaceConditionBool.EMPTY) {
        return;
    }

    return b === WorkspaceConditionBool.TRUE;
}

export type WorkspaceClusterInfo = Pick<WorkspaceCluster, "name" | "url" | "governedBy">;

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

    protected readonly disposables = new DisposableCollection();
    protected readonly queues = new Map<string, Queue>();

    protected cluster: WorkspaceClusterInfo;

    public start(cluster: WorkspaceClusterInfo, clientProvider: ClientProvider) {
        const logPayload = { name: cluster.name, url: cluster.url, governedBy: cluster.governedBy };
        log.info(`starting bridge to cluster...`, logPayload);
        this.cluster = cluster;

        const startStatusUpdateHandler = (writeToDB: boolean) => {
            log.debug(`starting status update handler: ${cluster.name}`, logPayload);
            /* no await */ this.startStatusUpdateHandler(clientProvider, writeToDB, logPayload)
                // this is a mere safe-guard: we do not expect the code inside to fail
                .catch(err => log.error("cannot start status update handler", err));
        };

        if (cluster.governedBy === this.config.installation) {
            // notify servers and _update the DB_
            startStatusUpdateHandler(true);

            // the actual "governing" part
            const controllerInterval = this.config.controllerIntervalSeconds;
            if (controllerInterval <= 0) {
                throw new Error("controllerInterval <= 0!");
            }
            log.debug(`starting controller: ${cluster.name}`, logPayload);
            this.startController(clientProvider, controllerInterval, this.config.controllerMaxDisconnectSeconds);
        } else if (cluster.governedBy !== "") {
            // _DO NOT_ update the DB (another bridge is responsible for that)
            // Still, listen to all updates, generate/derive new state and distribute it locally!
            startStatusUpdateHandler(false);

            // emulate WorkspaceInstance updates for all Workspaces in the "preparing" phase in this cluster
            const updateEmulator = this.preparingUpdateEmulatorFactory() as PreparingUpdateEmulator;
            this.disposables.push(updateEmulator);
            updateEmulator.start(cluster.name);
        } else {
            // case governedBy === "": a state that we'll only have during a transition period for backwards-compatibilities sake
        }
        log.info(`started bridge to cluster.`, logPayload);
    }

    public stop() {
        this.dispose();
    }

    protected async startStatusUpdateHandler(clientProvider: ClientProvider, writeToDB: boolean, logPayload: {}): Promise<void> {
        const subscriber = new WsmanSubscriber(clientProvider);
        this.disposables.push(subscriber);

        const onReconnect = (ctx: TraceContext, s: WorkspaceStatus[]) => {
            s.forEach(sx => this.serializeMessagesByInstanceId<WorkspaceStatus>(ctx, sx, m => m.getId(), (ctx, msg) => this.handleStatusUpdate(ctx, msg, writeToDB)))
        };
        const onStatusUpdate = (ctx: TraceContext, s: WorkspaceStatus) => {
            this.serializeMessagesByInstanceId<WorkspaceStatus>(ctx, s, msg => msg.getId(), (ctx, s) => this.handleStatusUpdate(ctx, s, writeToDB))
        };
        await subscriber.subscribe({ onReconnect, onStatusUpdate }, logPayload);
    }

    protected serializeMessagesByInstanceId<M>(ctx: TraceContext, msg: M, getInstanceId: (msg: M) => string, handler: (ctx: TraceContext, msg: M) => Promise<void>) {
        const instanceId = getInstanceId(msg);
        if (!instanceId) {
            log.warn("Received invalid message, could not read instanceId!", { msg });
            return;
        }

        // We can't just handle the status update directly, but have to "serialize" it to ensure the updates stay in order.
        // If we did not do this, the async nature of our code would allow for one message to overtake the other.
        let q = this.queues.get(instanceId) || new Queue();
        q.enqueue(() => handler(ctx, msg)).catch(e => log.error({instanceId}, e));
        this.queues.set(instanceId, q);
    }

    protected async handleStatusUpdate(ctx: TraceContext, rawStatus: WorkspaceStatus, writeToDB: boolean) {
        const status = rawStatus.toObject();
        if (!status.spec || !status.metadata || !status.conditions) {
            log.warn("Received invalid status update", status);
            return;
        }
        if (status.spec.type === WorkspaceType.GHOST) {
            return;
        }
        log.debug("Received status update", status);

        const span = TraceContext.startSpan("handleStatusUpdate", ctx);
        span.setTag("status", JSON.stringify(filterStatus(status)));
        span.setTag("writeToDB", writeToDB);
        try {
            // Beware of the ID mapping here: What's a workspace to the ws-manager is a workspace instance to the rest of the system.
            //                                The workspace ID of ws-manager is the workspace instance ID in the database.
            //                                The meta ID of ws-manager is the workspace ID in the database.
            const instanceId = status.id!;
            const workspaceId = status.metadata!.metaId!;
            const userId = status.metadata!.owner!;
            const logCtx = { instanceId, workspaceId, userId };

            const instance = await this.workspaceDB.trace({span}).findInstanceById(instanceId);
            if (instance) {
                this.prometheusExporter.statusUpdateReceived(this.cluster.name, true);
            } else {
                this.prometheusExporter.statusUpdateReceived(this.cluster.name, false);
                log.warn(logCtx, "Received a status update for an unknown instance", { status });
                return;
            }

            if (!!status.spec.exposedPortsList) {
                instance.status.exposedPorts = status.spec.exposedPortsList.map(p => {
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
            instance.status.timeout = status.spec.timeout;
            instance.status.conditions.failed = status.conditions.failed;
            instance.status.conditions.pullingImages = toBool(status.conditions.pullingImages!);
            instance.status.conditions.deployed = toBool(status.conditions.deployed);
            instance.status.conditions.timeout = status.conditions.timeout;
            instance.status.conditions.firstUserActivity = mapFirstUserActivity(rawStatus.getConditions()!.getFirstUserActivity());
            instance.status.conditions.headlessTaskFailed = status.conditions.headlessTaskFailed;
            instance.status.conditions.stoppedByRequest = toBool(status.conditions.stoppedByRequest);
            instance.status.message = status.message;
            instance.status.nodeName = instance.status.nodeName || status.runtime?.nodeName;
            instance.status.podName = instance.status.podName || status.runtime?.podName;
            instance.status.nodeIp = instance.status.nodeIp || status.runtime?.nodeIp;
            instance.status.ownerToken = status.auth!.ownerToken;

            if (status.repo) {
                const r = status.repo;
                const undefinedIfEmpty = <T>(l: T[]) => l.length > 0 ? l : undefined;

                instance.status.repo = {
                    branch: r.branch,
                    latestCommit: r.latestCommit,
                    uncommitedFiles: undefinedIfEmpty(r.uncommitedFilesList),
                    totalUncommitedFiles: r.totalUncommitedFiles,
                    unpushedCommits: undefinedIfEmpty(r.unpushedCommitsList),
                    totalUntrackedFiles: r.totalUntrackedFiles,
                    untrackedFiles: undefinedIfEmpty(r.untrackedFilesList),
                    totalUnpushedCommits: r.totalUnpushedCommits
                }
            }

            if (instance.status.conditions.deployed && !instance.deployedTime) {
                instance.deployedTime = new Date().toISOString();
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
                    break;
                case WorkspacePhase.INTERRUPTED:
                    instance.status.phase = "interrupted";
                    break;
                case WorkspacePhase.STOPPING:
                    if (instance.status.phase != 'stopped') {
                        instance.status.phase = "stopping";
                        if (!instance.stoppingTime) {
                            // The first time a workspace enters stopping we record that as it's stoppingTime time.
                            // This way we don't take the time a workspace requires to stop into account when
                            // computing the time a workspace instance was running.
                            instance.stoppingTime = new Date().toISOString();
                        }
                    } else {
                        log.warn("Got a stopping event for an already stopped workspace.", instance);
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
                    lifecycleHandler = () => this.onInstanceStopped({span}, userId, instance);
                    break;
            }

            span.setTag("after", JSON.stringify(instance));

            // now notify all prebuild listeners about updates - and update DB if needed
            await this.updatePrebuiltWorkspace({span}, userId, status, writeToDB);

            if (writeToDB) {
                await this.workspaceDB.trace(ctx).storeInstance(instance);

                // cleanup
                // important: call this after the DB update
                await this.cleanupProbeWorkspace(ctx, status);

                if (!!lifecycleHandler) {
                    await lifecycleHandler();
                }
            }
            await this.messagebus.notifyOnInstanceUpdate(ctx, userId, instance);

        } catch (e) {
            TraceContext.setError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected startController(clientProvider: ClientProvider, controllerIntervalSeconds: number, controllerMaxDisconnectSeconds: number, maxTimeToRunningPhaseSeconds = 60 * 60) {
        let disconnectStarted = Number.MAX_SAFE_INTEGER;
        this.disposables.push(
            repeat(async () => {
                try {
                    const client = await clientProvider();
                    await this.controlInstallationInstances(client, maxTimeToRunningPhaseSeconds);

                    disconnectStarted = Number.MAX_SAFE_INTEGER;    // Reset disconnect period
                } catch (e) {
                    if (durationLongerThanSeconds(disconnectStarted, controllerMaxDisconnectSeconds)) {
                        log.warn("error while controlling installation's workspaces", e, { installation: this.cluster.name });
                    } else if (disconnectStarted > Date.now()) {
                        disconnectStarted = Date.now();
                    }
                }
            }, controllerIntervalSeconds * 1000)
        );
    }

    protected async controlInstallationInstances(client: PromisifiedWorkspaceManagerClient, maxTimeToRunningPhaseSeconds: number) {
        const installation = this.cluster.name;
        log.debug("controlling instances", { installation });
        let ctx: TraceContext = {};

        const runningInstances = await this.workspaceDB.trace(ctx).findRunningInstancesWithWorkspaces(installation);
        const runningInstancesIdx = new Map<string, RunningWorkspaceInfo>();
        runningInstances.forEach(i => runningInstancesIdx.set(i.latestInstance.id, i));

        const actuallyRunningInstances = await client.getWorkspaces(ctx, new GetWorkspacesRequest());
        actuallyRunningInstances.getStatusList().forEach(s => runningInstancesIdx.delete(s.getId()));

        const promises: Promise<any>[] = [];
        for (const [instanceId, ri] of runningInstancesIdx.entries()) {
            const instance = ri.latestInstance;
            if (!(instance.status.phase === 'running' || durationLongerThanSeconds(Date.parse(instance.creationTime), maxTimeToRunningPhaseSeconds))) {
                log.debug({ instanceId }, "skipping instance", { phase: instance.status.phase, creationTime: instance.creationTime, region: instance.region });
                continue;
            }

            log.info({instanceId, workspaceId: instance.workspaceId}, "Database says the instance is starting for too long or running, but wsman does not know about it. Marking as stopped in database.", {installation});
            instance.status.phase = "stopped";
            instance.stoppingTime = new Date().toISOString();
            instance.stoppedTime = new Date().toISOString();
            promises.push(this.workspaceDB.trace({}).storeInstance(instance));
            promises.push(this.onInstanceStopped({}, ri.workspace.ownerId, instance));
            promises.push(this.stopPrebuildInstance(ctx, instance));
        }
        await Promise.all(promises);
    }

    protected async cleanupProbeWorkspace(ctx: TraceContext, status: WorkspaceStatus.AsObject | undefined) {
        // probes are an EE feature - we just need the hook here
    }

    protected async updatePrebuiltWorkspace(ctx: TraceContext, userId: string, status: WorkspaceStatus.AsObject, writeToDB: boolean) {
        // prebuilds are an EE feature - we just need the hook here
    }

    protected async stopPrebuildInstance(ctx: TraceContext, instance: WorkspaceInstance): Promise<void> {
        // prebuilds are an EE feature - we just need the hook here
    }

    protected async onInstanceStopped(ctx: TraceContext, ownerUserID: string, instance: WorkspaceInstance): Promise<void> {
        const span = TraceContext.startSpan("onInstanceStopped", ctx);

        try {
            await this.userDB.trace({span}).deleteGitpodTokensNamedLike(ownerUserID, `${instance.id}-%`);
            this.analytics.track({
                userId: ownerUserID,
                event: "workspace_stopped",
                messageId: `bridge-wsstopped-${instance.id}`,
                properties: { "instanceId": instance.id, "workspaceId": instance.workspaceId }
            });
        } catch (err) {
            TraceContext.setError({span}, err);
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
}