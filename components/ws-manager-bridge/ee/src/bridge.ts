/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { WorkspaceManagerBridge } from "../../src/bridge";
import { injectable } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceStatus, WorkspaceType, WorkspacePhase } from "@gitpod/ws-manager/lib";
import { HeadlessWorkspaceEvent, HeadlessWorkspaceEventType } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class WorkspaceManagerBridgeEE extends WorkspaceManagerBridge {

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
            await this.workspaceDB.trace({span}).hardDeleteWorkspace(workspaceId);
        } catch (e) {
            TraceContext.setError({span}, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async updatePrebuiltWorkspace(ctx: TraceContext, userId: string, status: WorkspaceStatus.AsObject, writeToDB: boolean) {
        if (status.spec && status.spec.type != WorkspaceType.PREBUILD) {
            return;
        }

        const instanceId = status.id!;
        const workspaceId = status.metadata!.metaId!;
        const logCtx: LogContext = { instanceId, workspaceId, userId };

        const span = TraceContext.startSpan("updatePrebuiltWorkspace", ctx);
        try {
            const prebuild = await this.workspaceDB.trace({span}).findPrebuildByWorkspaceID(status.metadata!.metaId!);
            if (!prebuild) {
                log.warn(logCtx, "headless workspace without prebuild");
                TraceContext.setError({span}, new Error("headless workspace without prebuild"));
                return
            }
            span.setTag("updatePrebuiltWorkspace.prebuildId", prebuild.id);

            if (prebuild.state === 'queued') {
                // We've received an update from ws-man for this workspace, hence it must be running.
                prebuild.state = "building";

                if (writeToDB) {
                    await this.workspaceDB.trace({span}).storePrebuiltWorkspace(prebuild);
                }
                await this.messagebus.notifyHeadlessUpdate({span}, userId, workspaceId, <HeadlessWorkspaceEvent>{
                    type: HeadlessWorkspaceEventType.Started,
                    workspaceID: workspaceId,
                });
            }

            if (status.phase === WorkspacePhase.STOPPING) {
                let headlessUpdateType: HeadlessWorkspaceEventType = HeadlessWorkspaceEventType.Aborted;
                if (!!status.conditions!.timeout) {
                    prebuild.state = "timeout";
                    prebuild.error = status.conditions!.timeout;
                    headlessUpdateType = HeadlessWorkspaceEventType.AbortedTimedOut;
                } else if (!!status.conditions!.failed) {
                    prebuild.state = "failed";
                    prebuild.error = status.conditions!.failed;
                    headlessUpdateType = HeadlessWorkspaceEventType.Failed;
                } else if (!!status.conditions!.stoppedByRequest) {
                    prebuild.state = "aborted";
                    prebuild.error = "Cancelled";
                    headlessUpdateType = HeadlessWorkspaceEventType.Aborted;
                } else if (!!status.conditions!.headlessTaskFailed) {
                    prebuild.state = "available";
                    prebuild.error = status.conditions!.headlessTaskFailed;
                    prebuild.snapshot = status.conditions!.snapshot;
                    headlessUpdateType = HeadlessWorkspaceEventType.FinishedButFailed;
                } else if (!status.conditions!.snapshot) {
                    prebuild.state = "failed";
                    headlessUpdateType = HeadlessWorkspaceEventType.Failed;
                } else {
                    prebuild.state = "available";
                    prebuild.snapshot = status.conditions!.snapshot;
                    headlessUpdateType = HeadlessWorkspaceEventType.FinishedSuccessfully;
                }

                if (writeToDB) {
                    await this.workspaceDB.trace({span}).storePrebuiltWorkspace(prebuild);
                }

                // notify updates
                // headless update
                await this.messagebus.notifyHeadlessUpdate({span}, userId, workspaceId, <HeadlessWorkspaceEvent>{
                    type: headlessUpdateType,
                    workspaceID: workspaceId,
                });

                // prebuild info
                const info = (await this.workspaceDB.trace({span}).findPrebuildInfos([prebuild.id]))[0];
                if (info) {
                    this.messagebus.notifyOnPrebuildUpdate({ info, status: prebuild.state });
                }
            }
        } catch (e) {
            TraceContext.setError({span}, e);
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
            prebuild.state = 'aborted';
            await this.workspaceDB.trace({}).storePrebuiltWorkspace(prebuild);

            { // notify about prebuild updated
                const info = (await this.workspaceDB.trace({span}).findPrebuildInfos([prebuild.id]))[0];
                if (info) {
                    this.messagebus.notifyOnPrebuildUpdate({ info, status: prebuild.state });
                }
            }
        }
    }

}