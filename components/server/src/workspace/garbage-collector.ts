/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { ConsensusLeaderQorum } from "../consensus/consensus-leader-quorum";
import { Disposable, VolumeSnapshotWithWSType } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { WorkspaceDeletionService } from "./workspace-deletion-service";
import * as opentracing from "opentracing";
import { TracedWorkspaceDB, DBWithTracing, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Config } from "../config";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";

/**
 * The WorkspaceGarbageCollector has two tasks:
 *  - mark old, unused workspaces as 'softDeleted = "gc"' after a certain period (initially: 21)
 *  - actually delete softDeleted workspaces if they are older than a configured time (initially: 7)
 */
@injectable()
export class WorkspaceGarbageCollector {
    @inject(ConsensusLeaderQorum) protected readonly leaderQuorum: ConsensusLeaderQorum;
    @inject(WorkspaceDeletionService) protected readonly deletionService: WorkspaceDeletionService;
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(Config) protected readonly config: Config;

    public async start(): Promise<Disposable> {
        if (this.config.workspaceGarbageCollection.disabled) {
            console.log("wsgc: Garbage collection is disabled");
            return {
                dispose: () => {},
            };
        }
        return repeat(
            async () => this.garbageCollectWorkspacesIfLeader(),
            this.config.workspaceGarbageCollection.intervalSeconds * 1000,
        );
    }

    public async garbageCollectWorkspacesIfLeader() {
        if (await this.leaderQuorum.areWeLeader()) {
            log.info("wsgc: we're leading the quorum. Collecting old workspaces");
            this.softDeleteOldWorkspaces().catch((err) => log.error("wsgc: error during soft-deletion", err));
            this.deleteWorkspaceContentAfterRetentionPeriod().catch((err) =>
                log.error("wsgc: error during content deletion", err),
            );
            this.purgeWorkspacesAfterPurgeRetentionPeriod().catch((err) =>
                log.error("wsgc: error during hard deletion of workspaces", err),
            );
            this.deleteOldPrebuilds().catch((err) => log.error("wsgc: error during prebuild deletion", err));
            this.deleteOutdatedVolumeSnapshots().catch((err) =>
                log.error("wsgc: error during volume snapshot gc deletion", err),
            );
        }
    }

    /**
     * Marks old, unused workspaces as softDeleted
     */
    protected async softDeleteOldWorkspaces() {
        if (Date.now() < this.config.workspaceGarbageCollection.startDate) {
            log.info("wsgc: garbage collection not yet active.");
            return;
        }

        const span = opentracing.globalTracer().startSpan("softDeleteOldWorkspaces");
        try {
            const workspaces = await this.workspaceDB
                .trace({ span })
                .findWorkspacesForGarbageCollection(
                    this.config.workspaceGarbageCollection.minAgeDays,
                    this.config.workspaceGarbageCollection.chunkLimit,
                );
            const deletes = await Promise.all(
                workspaces.map((ws) => this.deletionService.softDeleteWorkspace({ span }, ws, "gc")),
            );

            log.info(`wsgc: successfully soft-deleted ${deletes.length} workspaces`);
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

            log.info(`wsgc: successfully deleted the content of ${deletes.length} workspaces`);
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
                workspaces.map((ws) => this.deletionService.hardDeleteWorkspace({ span }, ws.id)),
            );

            log.info(`wsgc: successfully purged ${deletes.length} workspaces`);
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

            log.info(`wsgc: successfully deleted ${deletes.length} prebuilds`);
            span.addTags({ nrOfCollectedPrebuilds: deletes.length });
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    // finds volume snapshots that have been superseded by newer volume snapshot and removes them
    protected async deleteOutdatedVolumeSnapshots() {
        const span = opentracing.globalTracer().startSpan("deleteOutdatedVolumeSnapshots");
        try {
            const workspaceIds = await this.workspaceDB
                .trace({ span })
                .findVolumeSnapshotWorkspacesForGC(this.config.workspaceGarbageCollection.chunkLimit);
            const volumeSnapshotsWithWSPromises = workspaceIds.map(async (wsId) => {
                const [vss, ws] = await Promise.all([
                    this.workspaceDB
                        .trace({ span })
                        .findVolumeSnapshotForGCByWorkspaceId(wsId, this.config.workspaceGarbageCollection.chunkLimit),
                    this.workspaceDB.trace({ span }).findById(wsId),
                ]);
                return { wsId, ws, vss };
            });

            // We're doing the actual deletion in a sync for-loop tp avoid quadratic explosion of requests
            for await (const { wsId, ws, vss } of volumeSnapshotsWithWSPromises) {
                if (!ws) {
                    log.error(`Workspace ${wsId} not found while looking for outdated volume snapshots`);
                    continue; // Still, continue deleting the others
                }
                await Promise.all(
                    // skip the first volume snapshot, as it is most recent, and then pass the rest into deletion
                    vss.slice(1).map((vs) => {
                        let vswst: VolumeSnapshotWithWSType = {
                            vs,
                            wsType: ws?.type,
                        };
                        return this.deletionService.garbageCollectVolumeSnapshot({ span }, vswst);
                    }),
                );
            }
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
