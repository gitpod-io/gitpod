/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { GetWorkspacesRequest } from "@gitpod/ws-manager/lib";
import { Disposable, DisposableCollection, RunningWorkspaceInfo, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Configuration } from "./config";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Metrics } from "./metrics";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { DBWithTracing, TracedUserDB, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib/traced-db";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ClientProvider } from "./wsman-subscriber";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { PrebuildUpdater } from "./prebuild-updater";
import { RedisPublisher } from "@gitpod/gitpod-db/lib";
import { durationLongerThanSeconds } from "@gitpod/gitpod-protocol/lib/util/timeutil";

export const WorkspaceInstanceController = Symbol("WorkspaceInstanceController");

export interface WorkspaceInstanceController extends Disposable {
    start(
        workspaceClusterName: string,
        clientProvider: ClientProvider,
        controllerIntervalSeconds: number,
        controllerMaxDisconnectSeconds: number,
    ): void;

    controlNotStoppedAppClusterManagedInstanceTimeouts(
        parentCtx: TraceContext,
        runningInstances: RunningWorkspaceInfo[],
        workspaceClusterName: string,
    ): Promise<void>;

    onStopped(ctx: TraceContext, ownerUserID: string, instance: WorkspaceInstance): Promise<void>;
}

/**
 * This class is responsible for controlling the WorkspaceInstances that are not stopped and to ensure that there
 * actual state is properly reflected in the database, eventually.
 *
 * !!! It's statful, so make sure it's bound in transient mode !!!
 */
@injectable()
export class WorkspaceInstanceControllerImpl implements WorkspaceInstanceController, Disposable {
    constructor(
        @inject(Configuration) private readonly config: Configuration,
        @inject(Metrics) private readonly prometheusExporter: Metrics,
        @inject(TracedWorkspaceDB) private readonly workspaceDB: DBWithTracing<WorkspaceDB>,
        @inject(TracedUserDB) private readonly userDB: DBWithTracing<UserDB>,
        @inject(PrebuildUpdater) private readonly prebuildUpdater: PrebuildUpdater,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
    ) {}

    protected readonly disposables = new DisposableCollection();

    start(
        workspaceClusterName: string,
        clientProvider: ClientProvider,
        controllerIntervalSeconds: number,
        controllerMaxDisconnectSeconds: number,
    ) {
        let disconnectStarted = Number.MAX_SAFE_INTEGER;
        this.disposables.push(
            repeat(async () => {
                const span = TraceContext.startSpan("controlInstances");
                const ctx = { span };
                try {
                    log.debug("Controlling instances...", { workspaceClusterName });

                    const nonStoppedInstances = await this.workspaceDB
                        .trace(ctx)
                        .findRunningInstancesWithWorkspaces(workspaceClusterName, undefined, true);

                    // Control running workspace instances against ws-manager
                    try {
                        await this.controlNonStoppedWSManagerManagedInstances(
                            ctx,
                            workspaceClusterName,
                            nonStoppedInstances,
                            clientProvider,
                            this.config.timeouts.pendingPhaseSeconds,
                            this.config.timeouts.stoppingPhaseSeconds,
                        );

                        disconnectStarted = Number.MAX_SAFE_INTEGER; // Reset disconnect period
                    } catch (err) {
                        if (durationLongerThanSeconds(disconnectStarted, controllerMaxDisconnectSeconds)) {
                            log.warn("Error while controlling workspace cluster's workspaces", err, {
                                workspaceClusterName,
                            });
                        } else if (disconnectStarted > Date.now()) {
                            disconnectStarted = Date.now();
                        }
                    }

                    // Control workspace instances against timeouts
                    await this.controlNotStoppedAppClusterManagedInstanceTimeouts(
                        ctx,
                        nonStoppedInstances,
                        workspaceClusterName,
                    );

                    log.debug("Done controlling instances.", { workspaceClusterName });
                } catch (err) {
                    TraceContext.setError(ctx, err);
                    log.error("Error while controlling workspace cluster's workspaces", err, {
                        workspaceClusterName,
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
    protected async controlNonStoppedWSManagerManagedInstances(
        parentCtx: TraceContext,
        workspaceClusterName: string,
        runningInstances: RunningWorkspaceInfo[],
        clientProvider: ClientProvider,
        pendingPhaseSeconds: number,
        stoppingPhaseSeconds: number,
    ) {
        const span = TraceContext.startSpan("controlNonStoppedWSManagerManagedInstances", parentCtx);
        const ctx = { span };
        try {
            log.debug("Controlling ws-manager managed instances...", { workspaceClusterName });

            const runningInstancesIdx = new Map<string, RunningWorkspaceInfo>();
            runningInstances.forEach((i) => runningInstancesIdx.set(i.latestInstance.id, i));

            const client = await clientProvider();
            const actuallyRunningInstances = await client.getWorkspaces(ctx, new GetWorkspacesRequest());
            actuallyRunningInstances.getStatusList().forEach((s) => runningInstancesIdx.delete(s.getId()));

            // runningInstancesIdx only contains instances that ws-manager is not aware of
            for (const [instanceId, ri] of runningInstancesIdx.entries()) {
                const instance = ri.latestInstance;
                const phase = instance.status.phase;

                // When ws-manager is not aware of the following instances outside of the timeout duration,
                // they should be marked as stopped.
                // pending states timeout is 1 hour after creationTime.
                // stopping states timeout is 1 hour after stoppingTime.
                if (
                    phase === "running" ||
                    (phase === "pending" &&
                        durationLongerThanSeconds(Date.parse(instance.creationTime), pendingPhaseSeconds)) ||
                    (phase === "stopping" &&
                        instance.stoppingTime &&
                        durationLongerThanSeconds(Date.parse(instance.stoppingTime), stoppingPhaseSeconds))
                ) {
                    log.info(
                        { instanceId, workspaceId: instance.workspaceId },
                        "Database says the instance is present, but ws-man does not know about it. Marking as stopped in database.",
                        { workspaceClusterName, phase },
                    );
                    await this.markWorkspaceInstanceAsStopped(ctx, ri, new Date());
                    continue;
                }

                log.debug({ instanceId }, "Skipping instance", {
                    phase: phase,
                    creationTime: instance.creationTime,
                    region: instance.region,
                });
            }

            log.debug("Done controlling ws-manager managed instances.", { workspaceClusterName });
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
    async controlNotStoppedAppClusterManagedInstanceTimeouts(
        parentCtx: TraceContext,
        runningInstances: RunningWorkspaceInfo[],
        applicationClusterName: string,
    ) {
        const span = TraceContext.startSpan("controlNotStoppedAppClusterManagedInstanceTimeouts", parentCtx);
        const ctx = { span };
        try {
            log.debug("Controlling app cluster managed instances...", { applicationClusterName });

            await Promise.all(
                runningInstances.map((info) => this.controlNotStoppedAppClusterManagedInstance(ctx, info)),
            );

            log.debug("Done controlling app cluster managed instances.", { applicationClusterName });
        } catch (err) {
            log.error("Error while controlling app cluster managed instances:", err, {
                applicationClusterName,
            });
            TraceContext.setError(ctx, err);
        } finally {
            span.finish();
        }
    }

    protected async controlNotStoppedAppClusterManagedInstance(parentCtx: TraceContext, info: RunningWorkspaceInfo) {
        const logContext: LogContext = {
            userId: info.workspace.ownerId,
            workspaceId: info.workspace.id,
            instanceId: info.latestInstance.id,
        };
        const ctx = TraceContext.childContext("controlNotStoppedAppClusterManagedInstance", parentCtx);
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

    async markWorkspaceInstanceAsStopped(ctx: TraceContext, info: RunningWorkspaceInfo, now: Date) {
        const nowISO = now.toISOString();
        if (!info.latestInstance.stoppingTime) {
            info.latestInstance.stoppingTime = nowISO;
        }
        info.latestInstance.stoppedTime = nowISO;
        info.latestInstance.status.message = `Stopped by ws-manager-bridge. Previously in phase ${info.latestInstance.status.phase}`;
        this.prometheusExporter.increaseInstanceMarkedStoppedCounter(info.latestInstance.status.phase);
        info.latestInstance.status.phase = "stopped";
        await this.workspaceDB.trace(ctx).storeInstance(info.latestInstance);

        // cleanup
        // important: call this after the DB update
        await this.onStopped(ctx, info.workspace.ownerId, info.latestInstance);

        await this.publisher.publishInstanceUpdate({
            ownerID: info.workspace.ownerId,
            instanceID: info.latestInstance.id,
            workspaceID: info.workspace.id,
        });

        await this.prebuildUpdater.stopPrebuildInstance(ctx, info.latestInstance);
    }

    async onStopped(ctx: TraceContext, ownerUserID: string, instance: WorkspaceInstance): Promise<void> {
        const span = TraceContext.startSpan("onInstanceStopped", ctx);

        try {
            await this.userDB.trace({ span }).deleteGitpodTokensNamedLike(ownerUserID, `${instance.id}-%`);
            this.analytics.track({
                userId: ownerUserID,
                event: "workspace_stopped",
                messageId: `bridge-wsstopped-${instance.id}`,
                properties: {
                    instanceId: instance.id,
                    workspaceId: instance.workspaceId,
                    stoppingTime: new Date(instance.stoppingTime!),
                    conditions: instance.status.conditions,
                    timeout: instance.status.timeout,
                },
                timestamp: new Date(instance.stoppedTime!),
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
