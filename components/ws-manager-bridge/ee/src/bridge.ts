/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { WorkspaceManagerBridge } from "../../src/bridge";
import { inject, injectable } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceStatus, WorkspaceType, WorkspacePhase } from "@gitpod/ws-manager/lib";
import { HeadlessWorkspaceEvent } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { PrebuildStateMapper } from "../../src/prebuild-state-mapper";

@injectable()
export class WorkspaceManagerBridgeEE extends WorkspaceManagerBridge {
    @inject(PrebuildStateMapper)
    protected readonly prebuildStateMapper: PrebuildStateMapper;

    protected async cleanupProbeWorkspace(ctx: TraceContext, status: WorkspaceStatus.AsObject | undefined) {
        if (!status) {
            return;
        }
        if (status.spec && status.spec.type != WorkspaceType.PROBE) {
            return;
        }
        if (status.phase !== WorkspacePhase.STOPPED) {
            return;
        }

        const span = TraceContext.startSpan("cleanupProbeWorkspace", ctx);
        try {
            const workspaceId = status.metadata!.metaId!;
            await this.workspaceDB.trace({ span }).hardDeleteWorkspace(workspaceId);
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async updatePrebuiltWorkspace(
        ctx: TraceContext,
        userId: string,
        status: WorkspaceStatus.AsObject,
        writeToDB: boolean,
    ) {
        if (status.spec && status.spec.type != WorkspaceType.PREBUILD) {
            return;
        }

        const instanceId = status.id!;
        const workspaceId = status.metadata!.metaId!;
        const logCtx: LogContext = { instanceId, workspaceId, userId };

        log.info("Handling prebuild workspace update.", status);

        const span = TraceContext.startSpan("updatePrebuiltWorkspace", ctx);
        try {
            const prebuild = await this.workspaceDB.trace({ span }).findPrebuildByWorkspaceID(status.metadata!.metaId!);
            if (!prebuild) {
                log.warn(logCtx, "Headless workspace without prebuild");
                TraceContext.setError({ span }, new Error("headless workspace without prebuild"));
                return;
            }
            span.setTag("updatePrebuiltWorkspace.prebuildId", prebuild.id);
            span.setTag("updatePrebuiltWorkspace.workspaceInstance.statusVersion", status.statusVersion);
            log.info("Found prebuild record in database.", prebuild);

            // prebuild.statusVersion = 0 is the default value in the DB, these shouldn't be counted as stale in our metrics
            if (prebuild.statusVersion > 0 && prebuild.statusVersion >= status.statusVersion) {
                // We've gotten an event which is younger than one we've already processed. We shouldn't process the stale one.
                span.setTag("updatePrebuiltWorkspace.staleEvent", true);
                this.prometheusExporter.recordStalePrebuildEvent();
                log.info(logCtx, "Stale prebuild event received, skipping.");
                return;
            }
            prebuild.statusVersion = status.statusVersion;

            const update = this.prebuildStateMapper.mapWorkspaceStatusToPrebuild(status);
            if (update) {
                const updatedPrebuild = {
                    ...prebuild,
                    ...update.update,
                };

                span.setTag("updatePrebuildWorkspace.prebuild.state", updatedPrebuild.state);
                span.setTag("updatePrebuildWorkspace.prebuild.error", updatedPrebuild.error);

                if (writeToDB) {
                    await this.workspaceDB.trace({ span }).storePrebuiltWorkspace(updatedPrebuild);
                }

                // notify updates
                // headless update
                await this.messagebus.notifyHeadlessUpdate({ span }, userId, workspaceId, <HeadlessWorkspaceEvent>{
                    type: update.type,
                    workspaceID: workspaceId,
                });

                // prebuild info
                const info = (await this.workspaceDB.trace({ span }).findPrebuildInfos([updatedPrebuild.id]))[0];
                if (info) {
                    this.messagebus.notifyOnPrebuildUpdate({ info, status: updatedPrebuild.state });
                }
            }
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async stopPrebuildInstance(ctx: TraceContext, instance: WorkspaceInstance): Promise<void> {
        const span = TraceContext.startSpan("stopPrebuildInstance", ctx);

        const prebuild = await this.workspaceDB.trace({}).findPrebuildByWorkspaceID(instance.workspaceId);
        if (prebuild) {
            // this is a prebuild - set it to aborted
            prebuild.state = "aborted";
            await this.workspaceDB.trace({}).storePrebuiltWorkspace(prebuild);

            {
                // notify about prebuild updated
                const info = (await this.workspaceDB.trace({ span }).findPrebuildInfos([prebuild.id]))[0];
                if (info) {
                    this.messagebus.notifyOnPrebuildUpdate({ info, status: prebuild.state });
                }
            }
        }
    }
}
