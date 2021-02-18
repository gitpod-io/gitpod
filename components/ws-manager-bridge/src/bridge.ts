/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { MessageBusIntegration } from "./messagebus-integration";
import { Disposable, WorkspaceInstance, Queue, WorkspaceInstancePort, PortVisibility, RunningWorkspaceInfo } from "@gitpod/gitpod-protocol";
import { WorkspaceManagerClient, WorkspaceStatus, WorkspacePhase, GetWorkspacesRequest, GetWorkspacesResponse, WorkspaceConditionBool, WorkspaceLogMessage, PortVisibility as WsManPortVisibility, WorkspaceType } from "@gitpod/ws-manager/lib";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { HeadlessLogEvent } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TracedWorkspaceDB, TracedUserDB, DBWithTracing } from '@gitpod/gitpod-db/lib/traced-db';
import { PrometheusMetricsExporter } from "./prometheus-metrics-exporter";
import { ClientProvider, WsmanSubscriber } from "./wsman-subscriber";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";

export const WorkspaceManagerBridgeFactory = Symbol("WorkspaceManagerBridgeFactory");

function toBool(b: WorkspaceConditionBool | undefined): boolean | undefined {
    if (b === WorkspaceConditionBool.EMPTY) {
        return;
    }

    return b === WorkspaceConditionBool.TRUE;
}

@injectable()
export class WorkspaceManagerBridge implements Disposable {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(TracedUserDB) protected readonly userDB: DBWithTracing<UserDB>;
    @inject(MessageBusIntegration) protected readonly messagebus: MessageBusIntegration;
    @inject(PrometheusMetricsExporter) protected readonly prometheusExporter: PrometheusMetricsExporter;
    protected readonly disposables: Disposable[] = [];
    protected readonly queues = new Map<string, Queue>();

    public async startDatabaseUpdater(clientProvider: ClientProvider): Promise<void> {
        const subscriber = await new WsmanSubscriber(clientProvider);
        this.disposables.push(subscriber);

        const onHeadlessLog = (ctx: TraceContext, s: WorkspaceLogMessage) => {
            this.serializeMessagesByInstanceId<WorkspaceLogMessage>(ctx, s, msg => msg.getId(), (ctx, s) => this.handleHeadlessLog(ctx, s.toObject()))
        };
        const onReconnect = (ctx: TraceContext, s: WorkspaceStatus[]) => {
            s.forEach(sx => this.serializeMessagesByInstanceId<WorkspaceStatus>(ctx, sx, m => m.getId(), (ctx, msg) => this.handleStatusUpdate(ctx, msg)))
        };
        const onStatusUpdate = (ctx: TraceContext, s: WorkspaceStatus) => {
            this.serializeMessagesByInstanceId<WorkspaceStatus>(ctx, s, msg => msg.getId(), (ctx, s) => this.handleStatusUpdate(ctx, s))
        };
        await subscriber.subscribe({ onHeadlessLog, onReconnect, onStatusUpdate });
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

    protected async handleStatusUpdate(ctx: TraceContext, rawStatus: WorkspaceStatus) {
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
        span.setTag("status", JSON.stringify(status))
        try {
            // Beware of the ID mapping here: What's a workspace to the ws-manager is a workspace instance to the rest of the system.
            //                                The workspace ID of ws-manager is the workspace instance ID in the database.
            //                                The meta ID of ws-manager is the workspace ID in the database.
            const instanceId = status.id!;
            const workspaceId = status.metadata!.metaId!;
            const userId = status.metadata!.owner!;
            const logCtx = { instanceId, workspaceId, userId };

            const instance = await this.workspaceDB.trace({span}).findInstanceById(instanceId);
            if (!instance) {
                log.warn(logCtx, "Received a status update for an unknown instance", { status });
                return;
            }

            if (!!status.spec.exposedPortsList) {
                instance.status.exposedPorts = status.spec.exposedPortsList.map(p => {
                    return <WorkspaceInstancePort>{
                        port: p.port,
                        targetPort: !!p.target ? p.target : undefined,
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
            instance.status.conditions.serviceExists = toBool(status.conditions.serviceExists!);
            instance.status.conditions.deployed = toBool(status.conditions.deployed);
            instance.status.conditions.timeout = status.conditions.timeout;
            instance.status.conditions.firstUserActivity = mapFirstUserActivity(rawStatus.getConditions()!.getFirstUserActivity());
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
                    }

                    instance.status.phase = "running";
                    break;
                case WorkspacePhase.INTERRUPTED:
                    instance.status.phase = "interrupted";
                    break;
                case WorkspacePhase.STOPPING:
                    instance.status.phase = "stopping";
                    break;
                case WorkspacePhase.STOPPED:
                    instance.stoppedTime = new Date().toISOString();
                    instance.status.phase = "stopped";
                    lifecycleHandler = () => this.onInstanceStopped({span}, userId, instance);
                    break;
            }

            await this.updatePrebuiltWorkspace({span}, status);
            
            span.setTag("after", JSON.stringify(instance));
            await this.workspaceDB.trace({span}).storeInstance(instance);
            await this.messagebus.notifyOnInstanceUpdate({span}, userId, instance);

            // important: call this after the DB update
            await this.cleanupProbeWorkspace({span}, status);

            if (!!lifecycleHandler) {
                await lifecycleHandler();
            }
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async handleHeadlessLog(ctx: TraceContext, evt: WorkspaceLogMessage.AsObject): Promise<void> {
        const userID = evt.metadata!.owner;
        const workspaceID = evt.metadata!.metaId;

        // we deliberately do not pass the tracing information along to prevent spamming our trace system with headless-log messages
        await this.messagebus.notifyHeadlessUpdate({}, userID, workspaceID, <HeadlessLogEvent>{
            text: evt.message,
            type: "log-output",
            workspaceID,
        });
    }

    public async startController(clientProvider: () => Promise<WorkspaceManagerClient>, installation: string, controllerIntervalSeconds: number, controllerMaxDisconnectSeconds: number, maxTimeToRunningPhaseSeconds = 60 * 60): Promise<void> {
        let disconnectStarted = Number.MAX_SAFE_INTEGER;
        const timer = setInterval(async () => {
            try {
                const client = await clientProvider();
                await this.controlInstallationInstances(client, installation, maxTimeToRunningPhaseSeconds);

                disconnectStarted = Number.MAX_SAFE_INTEGER;    // Reset disconnect period
            } catch (e) {
                if (durationLongerThanSeconds(disconnectStarted, controllerMaxDisconnectSeconds)) {
                    log.warn("error while controlling installation's workspaces", e);
                } else if (disconnectStarted > Date.now()) {
                    disconnectStarted = Date.now();
                }
            }
        }, controllerIntervalSeconds * 1000);
        this.disposables.push({ dispose: () => clearTimeout(timer) });
    }

    protected async controlInstallationInstances(manager: WorkspaceManagerClient, installation: string, maxTimeToRunningPhaseSeconds: number) {
        log.debug("controlling instances", { installation });

        const runningInstances = await this.workspaceDB.trace({}).findRunningInstancesWithWorkspaces(installation);
        const runningInstacesIdx = new Map<string, RunningWorkspaceInfo>();
        runningInstances.forEach(i => runningInstacesIdx.set(i.latestInstance.id, i));

        const actuallyRunningInstances = await new Promise<GetWorkspacesResponse>((resolve, reject) => manager.getWorkspaces(new GetWorkspacesRequest(), (err, res) => { if (err) reject(err); else resolve(res); }));
        actuallyRunningInstances.getStatusList().forEach(s => runningInstacesIdx.delete(s.getId()));

        const promises: Promise<any>[] = [];
        for (const [instanceId, ri] of runningInstacesIdx.entries()) {
            const instance = ri.latestInstance;
            if (!(instance.status.phase === 'running' || durationLongerThanSeconds(Date.parse(instance.creationTime), maxTimeToRunningPhaseSeconds))) {
                log.debug({ instanceId }, "skipping instance", { phase: instance.status.phase, creationTime: instance.creationTime, region: instance.region });
                continue;
            }

            log.info({instanceId, workspaceId: instance.workspaceId}, "Database says the instance is starting for too long or running, but wsman does not know about it. Marking as stopped in database.", {installation});
            instance.status.phase = "stopped";
            instance.stoppedTime = new Date().toISOString();
            promises.push(this.workspaceDB.trace({}).storeInstance(instance));
            promises.push(this.onInstanceStopped({}, ri.workspace.ownerId, instance));
            promises.push(this.controlPrebuildInstance(instance));
        }
        await Promise.all(promises);
    }

    protected async cleanupProbeWorkspace(ctx: TraceContext, status: WorkspaceStatus.AsObject | undefined) {
        // probes are an EE feature - we just need the hook here
    }

    protected async updatePrebuiltWorkspace(ctx: TraceContext, status: WorkspaceStatus.AsObject) {
        // prebuilds are an EE feature - we just need the hook here
    }

    protected async controlPrebuildInstance(instance: WorkspaceInstance): Promise<void> {
        // prebuilds are an EE feature - we just need the hook here
    }

    protected async onInstanceStopped(ctx: TraceContext, ownerUserID: string, instance: WorkspaceInstance): Promise<void> {
        const span = TraceContext.startSpan("onInstanceStopped", ctx);

        try {
            await this.userDB.trace({span}).deleteGitpodTokensNamedLike(ownerUserID, `${instance.id}-%`);
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
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