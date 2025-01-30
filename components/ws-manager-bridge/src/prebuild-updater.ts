/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceStatus, WorkspaceType } from "@gitpod/ws-manager/lib";
import { HeadlessWorkspaceEventType, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { PrebuildStateMapper } from "./prebuild-state-mapper";
import { DBWithTracing, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib/traced-db";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { Metrics } from "./metrics";
import { filterStatus } from "./bridge";
import { RedisPublisher } from "@gitpod/gitpod-db/lib";

@injectable()
export class PrebuildUpdater {
    constructor(
        @inject(PrebuildStateMapper) private readonly prebuildStateMapper: PrebuildStateMapper,
        @inject(TracedWorkspaceDB) private readonly workspaceDB: DBWithTracing<WorkspaceDB>,
        @inject(Metrics) private readonly prometheusExporter: Metrics,
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
    ) {}

    async updatePrebuiltWorkspace(ctx: TraceContext, userId: string, status: WorkspaceStatus.AsObject) {
        if (status.spec && status.spec.type !== WorkspaceType.PREBUILD) {
            return;
        }

        const instanceId = status.id!;
        const workspaceId = status.metadata!.metaId!;
        const logCtx: LogContext = { instanceId, workspaceId, userId };

        log.info(logCtx, "Handling prebuild workspace update.", filterStatus(status));

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
            log.info(logCtx, "Found prebuild record in database.", prebuild);

            // prebuild.statusVersion = 0 is the default value in the DB, these shouldn't be counted as stale in our metrics
            if (prebuild.statusVersion > 0 && prebuild.statusVersion >= status.statusVersion) {
                // We've gotten an event which is younger than one we've already processed. We shouldn't process the stale one.
                span.setTag("updatePrebuiltWorkspace.staleEvent", true);
                this.prometheusExporter.recordStalePrebuildEvent();
                log.info(logCtx, "Stale prebuild event received, skipping.");
                return;
            }
            prebuild.statusVersion = status.statusVersion;

            const update = await this.prebuildStateMapper.mapWorkspaceStatusToPrebuild(status);
            const terminatingStates = ["available", "timeout", "aborted", "failed"];
            if (update) {
                const updatedPrebuild = {
                    ...prebuild,
                    ...update.update,
                };

                span.setTag("updatePrebuildWorkspace.prebuild.state", updatedPrebuild.state);
                span.setTag("updatePrebuildWorkspace.prebuild.error", updatedPrebuild.error);

                // Here we make sure that we increment the counter only when:
                // the state changes (we can receive multiple events with the same state)
                if (
                    updatedPrebuild.state &&
                    terminatingStates.includes(updatedPrebuild.state) &&
                    updatedPrebuild.state !== prebuild.state
                ) {
                    this.prometheusExporter.increasePrebuildsCompletedCounter(updatedPrebuild.state);
                }

                await this.workspaceDB.trace({ span }).storePrebuiltWorkspace(updatedPrebuild);

                // notify updates
                // headless update
                if (!HeadlessWorkspaceEventType.isRunning(update.type)) {
                    await this.publisher.publishHeadlessUpdate({
                        type: update.type,
                        workspaceID: workspaceId,
                    });
                }

                // prebuild info
                const info = (await this.workspaceDB.trace({ span }).findPrebuildInfos([updatedPrebuild.id]))[0];
                if (info) {
                    await this.publisher.publishPrebuildUpdate({
                        projectID: prebuild.projectId || "",
                        prebuildID: updatedPrebuild.id,
                        status: updatedPrebuild.state,
                        workspaceID: workspaceId,
                        organizationID: info.teamId,
                    });
                }
            }
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    async stopPrebuildInstance(ctx: TraceContext, instance: WorkspaceInstance): Promise<void> {
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
                    await this.publisher.publishPrebuildUpdate({
                        projectID: prebuild.projectId || "",
                        prebuildID: prebuild.id,
                        status: prebuild.state,
                        workspaceID: instance.workspaceId,
                        organizationID: info.teamId,
                    });
                }
            }
        }
    }
}
