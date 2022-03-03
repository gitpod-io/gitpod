/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { ConsensusLeaderQorum } from '../consensus/consensus-leader-quorum';
import { Disposable } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceDeletionService } from './workspace-deletion-service';
import * as opentracing from 'opentracing';
import { TracedWorkspaceDB, DBWithTracing, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { Config } from '../config';
import { repeat } from '@gitpod/gitpod-protocol/lib/util/repeat';

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
            console.log('wsgc: Garabage collection is disabled');
            return {
                dispose: () => {},
            };
        }
        return repeat(async () => this.garbageCollectWorkspacesIfLeader(), 30 * 60 * 1000);
    }

    public async garbageCollectWorkspacesIfLeader() {
        if (await this.leaderQuorum.areWeLeader()) {
            log.info("wsgc: we're leading the quorum. Collecting old workspaces");
            this.softDeleteOldWorkspaces().catch((err) => log.error('wsgc: error during soft-deletion', err));
            this.deleteWorkspaceContentAfterRetentionPeriod().catch((err) =>
                log.error('wsgc: error during content deletion', err),
            );
            this.deleteOldPrebuilds().catch((err) => log.error('wsgc: error during prebuild deletion', err));
        }
    }

    /**
     * Marks old, unused workspaces as softDeleted
     */
    protected async softDeleteOldWorkspaces() {
        if (Date.now() < this.config.workspaceGarbageCollection.startDate) {
            log.info('wsgc: garbage collection not yet active.');
            return;
        }

        const span = opentracing.globalTracer().startSpan('softDeleteOldWorkspaces');
        try {
            const workspaces = await this.workspaceDB
                .trace({ span })
                .findWorkspacesForGarbageCollection(
                    this.config.workspaceGarbageCollection.minAgeDays,
                    this.config.workspaceGarbageCollection.chunkLimit,
                );
            const deletes = await Promise.all(
                workspaces.map((ws) => this.deletionService.softDeleteWorkspace({ span }, ws, 'gc')),
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
        const span = opentracing.globalTracer().startSpan('deleteWorkspaceContentAfterRetentionPeriod');
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

    protected async deleteOldPrebuilds() {
        const span = opentracing.globalTracer().startSpan('deleteOldPrebuilds');
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
}
