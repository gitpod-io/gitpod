/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { WorkspaceSoftDeletion } from "@gitpod/gitpod-protocol";
import { WorkspaceDB, WorkspaceAndOwner, WorkspaceOwnerAndSoftDeleted, TracedWorkspaceDB, DBWithTracing } from "@gitpod/gitpod-db/lib";
import { StorageClient } from "../storage/storage-client";
import { Config } from "../config";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";

@injectable()
export class WorkspaceDeletionService {
    @inject(TracedWorkspaceDB) protected readonly db: DBWithTracing<WorkspaceDB>;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(Config) protected readonly config: Config;

    /**
     * This method does nothing beyond marking the given workspace as 'softDeleted' with the given cause and sets the 'softDeletedTime' to now.
     * The actual deletion happens as part of the regular workspace garbage collection.
     * @param ctx
     * @param ws
     * @param softDeleted
     */
    public async softDeleteWorkspace(ctx: TraceContext, ws: WorkspaceAndOwner, softDeleted: WorkspaceSoftDeletion): Promise<void> {
        await this.db.trace(ctx).updatePartial(ws.id, {
            softDeleted,
            softDeletedTime: new Date().toISOString()
        });
    }

    /**
     * This method garbageCollects a workspace. It deletes its contents and sets the workspaces 'contentDeletedTime'
     * @param ctx
     * @param ws
     */
    public async garbageCollectWorkspace(ctx: TraceContext, ws: WorkspaceOwnerAndSoftDeleted): Promise<boolean> {
        const span = TraceContext.startSpan("garbageCollectWorkspace", ctx);

        try {
            const deleteSnapshots = ws.softDeleted === "user";
            const successfulDeleted = await this.deleteWorkspaceStorage(ws, deleteSnapshots);
            await this.db.trace({span}).updatePartial(ws.id, { contentDeletedTime: new Date().toISOString() });
            return successfulDeleted;
        } catch (err) {
            TraceContext.setError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    /**
     * @param ctx
     * @param wsAndOwner
     */
    public async garbageCollectPrebuild(ctx: TraceContext, ws: WorkspaceAndOwner): Promise<boolean> {
        const span = TraceContext.startSpan("garbageCollectPrebuild", ctx);

        try {
            const successfulDeleted = await this.deleteWorkspaceStorage(ws, true);
            const now = new Date().toISOString();
            // Note: soft & content deletion happens at the same time, because prebuilds are reproducible so there's no need for the extra time span.
            await this.db.trace({span}).updatePartial(ws.id, {
                contentDeletedTime: now,
                softDeletedTime: now,
                softDeleted: 'gc'
            });
            return successfulDeleted;
        } catch (err) {
            TraceContext.setError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    /**
     * Performs the actual deletion of a workspace's backups (and optionally, snapshots). It:
     *  - throws an error if something went wrong during deletion
     *  - returns true in case of successful deletion
     * @param ws
     * @param includeSnapshots
     */
    protected async deleteWorkspaceStorage(ws: WorkspaceAndOwner, includeSnapshots: boolean): Promise<boolean> {
        await this.storageClient.deleteWorkspaceBackups(ws.ownerId, ws.id, includeSnapshots);
        return true;
    }
}