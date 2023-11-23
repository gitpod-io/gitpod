/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import {
    Disposable,
    Queue,
    WorkspaceInstancePort,
    PortVisibility,
    DisposableCollection,
    PortProtocol,
} from "@gitpod/gitpod-protocol";
import {
    WorkspaceStatus,
    WorkspacePhase,
    WorkspaceConditionBool,
    PortVisibility as WsManPortVisibility,
    PortProtocol as WsManPortProtocol,
    DescribeClusterRequest,
} from "@gitpod/ws-manager/lib";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { TracedWorkspaceDB, DBWithTracing } from "@gitpod/gitpod-db/lib/traced-db";
import { Metrics } from "./metrics";
import { ClientProvider, WsmanSubscriber } from "./wsman-subscriber";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Configuration } from "./config";
import { WorkspaceClass, WorkspaceCluster, WorkspaceClusterDB } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { performance } from "perf_hooks";
import { WorkspaceInstanceController } from "./workspace-instance-controller";
import { PrebuildUpdater } from "./prebuild-updater";
import { RedisPublisher } from "@gitpod/gitpod-db/lib";

/**
 * TODO(se) use a proper distributed lock here
 * This only works for a single instance of bridge, but that's fine as we run only one instance of ws-manager-bridge
 * Ideally we'd use a redis-based distributed lock here, but that's not available in this component (only server)
 */
class PoorMensSyncer {
    private readonly queues = new Map<string, Queue>();

    public sync<T>(key: string, cb: () => Promise<T>): Promise<T> {
        const q = this.queues.get(key) || new Queue();
        const result = q.enqueue(cb);
        this.queues.set(key, q);
        return result;
    }
}

export const WorkspaceManagerBridgeFactory = Symbol("WorkspaceManagerBridgeFactory");

function toBool(b: WorkspaceConditionBool | undefined): boolean | undefined {
    if (b === WorkspaceConditionBool.EMPTY) {
        return;
    }

    return b === WorkspaceConditionBool.TRUE;
}

export type WorkspaceClusterInfo = Pick<WorkspaceCluster, "name" | "url">;

@injectable()
export class WorkspaceManagerBridge implements Disposable {
    private readonly syncer = new PoorMensSyncer();
    constructor(
        @inject(WorkspaceClusterDB) private readonly clusterDB: WorkspaceClusterDB,
        @inject(TracedWorkspaceDB) private readonly workspaceDB: DBWithTracing<WorkspaceDB>,
        @inject(Metrics) private readonly metrics: Metrics,
        @inject(Configuration) private readonly config: Configuration,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(PrebuildUpdater) private readonly prebuildUpdater: PrebuildUpdater,
        @inject(WorkspaceInstanceController) private readonly workspaceInstanceController: WorkspaceInstanceController, // bound in "transient" mode: we expect to receive a fresh instance here
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
    ) {}

    protected readonly disposables = new DisposableCollection();
    protected readonly queues = new Map<string, Queue>();

    protected cluster: WorkspaceClusterInfo;

    public start(cluster: WorkspaceClusterInfo, clientProvider: ClientProvider) {
        const logPayload = { name: cluster.name, url: cluster.url };
        log.info(`Starting bridge to cluster...`, logPayload);
        this.cluster = cluster;

        const startStatusUpdateHandler = () => {
            log.debug(`Starting status update handler: ${cluster.name}`, logPayload);
            /* no await */ this.startStatusUpdateHandler(clientProvider, logPayload)
                // this is a mere safe-guard: we do not expect the code inside to fail
                .catch((err) => log.error("Cannot start status update handler", err));
        };

        // notify servers and _update the DB_
        startStatusUpdateHandler();

        // the actual "governing" part
        const controllerIntervalSeconds = this.config.controllerIntervalSeconds;
        if (controllerIntervalSeconds <= 0) {
            throw new Error("controllerIntervalSeconds <= 0!");
        }

        log.debug(`Starting controller: ${cluster.name}`, logPayload);
        // Control all workspace instances, either against ws-manager or configured timeouts
        this.workspaceInstanceController.start(
            cluster.name,
            clientProvider,
            controllerIntervalSeconds,
            this.config.controllerMaxDisconnectSeconds,
        );

        const tim = setInterval(() => {
            this.updateWorkspaceClasses(cluster, clientProvider);
        }, controllerIntervalSeconds * 1000);
        this.disposables.push({ dispose: () => clearInterval(tim) });

        log.info(`Started bridge to cluster.`, logPayload);
    }

    public stop() {
        this.dispose();
    }

    protected async updateWorkspaceClasses(clusterInfo: WorkspaceClusterInfo, clientProvider: ClientProvider) {
        try {
            const client = await clientProvider();
            const resp = await client.describeCluster({}, new DescribeClusterRequest());

            const cluster = await this.clusterDB.findByName(clusterInfo.name);
            if (!cluster) {
                return;
            }
            cluster.availableWorkspaceClasses = resp.getWorkspaceClassesList().map((c) => {
                return <WorkspaceClass>{
                    creditsPerMinute: c.getCreditsPerMinute(),
                    description: c.getDescription(),
                    displayName: c.getDisplayName(),
                    id: c.getId(),
                };
            });
            cluster.preferredWorkspaceClass = resp.getPreferredWorkspaceClass();

            await this.clusterDB.save(cluster);
        } catch (e) {
            log.error({}, "Failed to update workspace classes", e, { clusterInfo });
        }
    }

    protected async startStatusUpdateHandler(clientProvider: ClientProvider, logPayload: {}): Promise<void> {
        const subscriber = new WsmanSubscriber(clientProvider);
        this.disposables.push(subscriber);

        const onReconnect = (ctx: TraceContext, s: WorkspaceStatus[]) => {
            s.forEach((sx) =>
                this.serializeMessagesByInstanceId<WorkspaceStatus>(
                    ctx,
                    sx,
                    (m) => m.getId(),
                    (ctx, msg) => this.handleStatusUpdate(ctx, msg),
                ),
            );
        };
        const onStatusUpdate = (ctx: TraceContext, s: WorkspaceStatus) => {
            this.serializeMessagesByInstanceId<WorkspaceStatus>(
                ctx,
                s,
                (msg) => msg.getId(),
                (ctx, s) => this.handleStatusUpdate(ctx, s),
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
        const q = this.queues.get(instanceId) || new Queue();
        q.enqueue(() => handler(ctx, msg)).catch((e) => log.error({ instanceId }, e));
        this.queues.set(instanceId, q);
    }

    protected async handleStatusUpdate(ctx: TraceContext, rawStatus: WorkspaceStatus) {
        const start = performance.now();
        const status = rawStatus.toObject();
        log.info("Handling WorkspaceStatus update", filterStatus(status));

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
            this.metrics.reportWorkspaceInstanceUpdateStarted(this.cluster.name, status.spec.type);
            await this.statusUpdate(ctx, rawStatus);
        } catch (e) {
            const durationMs = performance.now() - start;
            this.metrics.reportWorkspaceInstanceUpdateCompleted(
                durationMs / 1000,
                this.cluster.name,
                status.spec.type,
                e,
            );
            log.error(logCtx, "Failed to complete WorkspaceInstance status update", e);
            throw e;
        }
        const durationMs = performance.now() - start;
        this.metrics.reportWorkspaceInstanceUpdateCompleted(durationMs / 1000, this.cluster.name, status.spec.type);
        log.info(logCtx, "Successfully completed WorkspaceInstance status update");
    }

    private async statusUpdate(ctx: TraceContext, rawStatus: WorkspaceStatus) {
        const status = rawStatus.toObject();

        if (!status.spec || !status.metadata || !status.conditions) {
            return;
        }

        const span = TraceContext.startSpan("handleStatusUpdate", ctx);
        span.setTag("status", JSON.stringify(filterStatus(status)));
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

            await this.syncer.sync(instanceId, async () => {
                // this is only to treat the typeschecker
                if (!status.spec || !status.metadata || !status.conditions) {
                    return;
                }
                const instance = await this.workspaceDB.trace({ span }).findInstanceById(instanceId);
                if (instance) {
                    this.metrics.statusUpdateReceived(this.cluster.name, true);
                } else {
                    // This scenario happens when the update for a WorkspaceInstance is picked up by a ws-manager-bridge in a different region,
                    // before periodic deleter finished running. This is because all ws-manager-bridge instances receive updates from all WorkspaceClusters.
                    // We ignore this update because we do not have anything to reconcile this update against, but also because we assume it is handled
                    // by another instance of ws-manager-bridge that is in the region where the WorkspaceInstance record was created.
                    this.metrics.statusUpdateReceived(this.cluster.name, false);
                    return;
                }

                const currentStatusVersion = instance.status.version || 0;
                if (currentStatusVersion > 0 && currentStatusVersion >= status.statusVersion) {
                    // We've gotten an event which is older than one we've already processed. We shouldn't process the stale one.
                    span.setTag("statusUpdate.staleEvent", true);
                    this.metrics.recordStaleStatusUpdate();
                    log.debug(ctx, "Stale status update received, skipping.");
                }

                if (!!status.spec.exposedPortsList) {
                    instance.status.exposedPorts = status.spec.exposedPortsList.map((p) => {
                        return <WorkspaceInstancePort>{
                            port: p.port,
                            visibility: mapPortVisibility(p.visibility),
                            protocol: mapPortProtocol(p.protocol),
                            url: p.url,
                        };
                    });
                }

                if (!instance.status.conditions.firstUserActivity && status.conditions.firstUserActivity) {
                    // Only report this when it's observed the first time
                    const firstUserActivity = mapFirstUserActivity(rawStatus.getConditions()!.getFirstUserActivity())!;
                    this.metrics.observeFirstUserActivity(instance, firstUserActivity);
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
                            this.metrics.observeWorkspaceStartupTime(instance);
                            this.analytics.track({
                                event: "workspace_running",
                                messageId: `bridge-wsrun-${instance.id}`,
                                properties: { instanceId: instance.id, workspaceId: workspaceId },
                                userId,
                                timestamp: new Date(instance.startedTime),
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
                        lifecycleHandler = () => this.workspaceInstanceController.onStopped({ span }, userId, instance);
                        break;
                }

                span.setTag("after", JSON.stringify(instance));

                // now notify all prebuild listeners about updates - and update DB if needed
                await this.prebuildUpdater.updatePrebuiltWorkspace({ span }, userId, status);

                await this.workspaceDB.trace(ctx).storeInstance(instance);

                // cleanup
                // important: call this after the DB update
                if (!!lifecycleHandler) {
                    await lifecycleHandler();
                }
                await this.publisher.publishInstanceUpdate({
                    ownerID: userId,
                    instanceID: instance.id,
                    workspaceID: instance.workspaceId,
                });
            });
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
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

const mapPortProtocol = (protocol: WsManPortProtocol): PortProtocol => {
    switch (protocol) {
        case WsManPortProtocol.PORT_PROTOCOL_HTTPS:
            return "https";
        default:
            return "http";
    }
};

/**
 * Filter here to avoid overloading spans
 * @param status
 */
export const filterStatus = (status: WorkspaceStatus.AsObject): Partial<WorkspaceStatus.AsObject> => {
    return {
        id: status.id,
        metadata: status.metadata,
        phase: status.phase,
        message: status.message,
        conditions: status.conditions,
        runtime: status.runtime,
    };
};
