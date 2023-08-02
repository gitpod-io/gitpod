/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { WorkspaceDeletionService } from "../workspace/workspace-deletion-service";
import * as opentracing from "opentracing";
import { TracedWorkspaceDB, DBWithTracing, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Config } from "../config";
import { Job } from "./runner";
import { WorkspaceService } from "../workspace/workspace-service";

/**
 * The WorkspaceGarbageCollector has two tasks:
 *  - mark old, unused workspaces as 'softDeleted = "gc"' after a certain period (initially: 21)
 *  - actually delete softDeleted workspaces if they are older than a configured time (initially: 7)
 */
@injectable()
export class WorkspaceGarbageCollector implements Job {
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(WorkspaceDeletionService) protected readonly deletionService: WorkspaceDeletionService;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(Config) protected readonly config: Config;

    public name = "workspace-gc";
    public frequencyMs: number;

    @postConstruct()
    protected init() {
        this.frequencyMs = this.config.workspaceGarbageCollection.intervalSeconds * 1000;
    }

    public async run(): Promise<void> {
        if (this.config.workspaceGarbageCollection.disabled) {
            log.info("workspace-gc: Garbage collection disabled.");
            return;
        }

        await Promise.all([
            this.softDeleteOldWorkspaces().catch((err) => log.error("workspace-gc: error during soft-deletion", err)),
            this.deleteWorkspaceContentAfterRetentionPeriod().catch((err) =>
                log.error("workspace-gc: error during content deletion", err),
            ),
            this.purgeWorkspacesAfterPurgeRetentionPeriod().catch((err) =>
                log.error("workspace-gc: error during hard deletion of workspaces", err),
            ),
            this.deleteOldPrebuilds().catch((err) => log.error("workspace-gc: error during prebuild deletion", err)),
        ]);
    }

    /**
     * Marks old, unused workspaces as softDeleted
     */
    protected async softDeleteOldWorkspaces() {
        if (Date.now() < this.config.workspaceGarbageCollection.startDate) {
            log.info("workspace-gc: garbage collection not yet active.");
            return;
        }

        const span = opentracing.globalTracer().startSpan("softDeleteOldWorkspaces");
        try {
            const now = new Date();
            const workspaces = await this.workspaceDB
                .trace({ span })
                .findWorkspacesForGarbageCollection(
                    this.config.workspaceGarbageCollection.minAgeDays,
                    this.config.workspaceGarbageCollection.chunkLimit,
                );
            const afterSelect = new Date();
            const deletes = await Promise.all(
                workspaces.map((ws) => this.workspaceService.deleteWorkspace(ws.ownerId, ws.id, "gc")), // TODO(gpl) This should be a system user/service account instead of ws owner
            );
            const afterDelete = new Date();

            log.info(`workspace-gc: successfully soft-deleted ${deletes.length} workspaces`, {
                selectionTimeMs: afterSelect.getTime() - now.getTime(),
                deletionTimeMs: afterDelete.getTime() - afterSelect.getTime(),
            });
            span.addTags({ nrOfCollectedWorkspaces: deletes.length });
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async deleteWorkspaceContentAfterRetentionPeriod() {
        const span = opentracing.globalTracer().startSpan("deleteWorkspaceContentAfterRetentionPeriod");
        try {
            const workspaces = await this.workspaceDB
                .trace({ span })
                .findWorkspacesForContentDeletion(
                    this.config.workspaceGarbageCollection.contentRetentionPeriodDays,
                    this.config.workspaceGarbageCollection.contentChunkLimit,
                );
            const deletes = await Promise.all(
                workspaces.map((ws) => this.deletionService.garbageCollectWorkspace({ span }, ws)),
            );

            log.info(`workspace-gc: successfully deleted the content of ${deletes.length} workspaces`);
            span.addTags({ nrOfCollectedWorkspaces: deletes.length });
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    /**
     * This method is meant to purge all traces of a Workspace and it's WorkspaceInstances from the DB
     */
    protected async purgeWorkspacesAfterPurgeRetentionPeriod() {
        const span = opentracing.globalTracer().startSpan("purgeWorkspacesAfterPurgeRetentionPeriod");
        try {
            const now = new Date();
            const workspaces = await this.workspaceDB
                .trace({ span })
                .findWorkspacesForPurging(
                    this.config.workspaceGarbageCollection.purgeRetentionPeriodDays,
                    this.config.workspaceGarbageCollection.purgeChunkLimit,
                    now,
                );
            const deletes = await Promise.all(
                workspaces.map((ws) =>
                    this.workspaceService
                        .hardDeleteWorkspace(ws.ownerId, ws.id)
                        .catch((err) => log.error("failed to hard-delete workspace", err)),
                ), // TODO(gpl) This should be a system user/service account instead of ws owner
            );

            log.info(`workspace-gc: successfully purged ${deletes.length} workspaces`);
            span.addTags({ nrOfCollectedWorkspaces: deletes.length });
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async deleteOldPrebuilds() {
        const span = opentracing.globalTracer().startSpan("deleteOldPrebuilds");
        try {
            const workspaces = await this.workspaceDB
                .trace({ span })
                .findPrebuiltWorkspacesForGC(
                    this.config.workspaceGarbageCollection.minAgePrebuildDays,
                    this.config.workspaceGarbageCollection.chunkLimit,
                );
            const deletes = await Promise.all(
                workspaces.map((ws) => this.deletionService.garbageCollectPrebuild({ span }, ws)),
            );

            log.info(`workspace-gc: successfully deleted ${deletes.length} prebuilds`);
            span.addTags({ nrOfCollectedPrebuilds: deletes.length });
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
