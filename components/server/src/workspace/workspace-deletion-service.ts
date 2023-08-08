/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import {
    WorkspaceDB,
    WorkspaceAndOwner,
    WorkspaceOwnerAndSoftDeleted,
    TracedWorkspaceDB,
    DBWithTracing,
} from "@gitpod/gitpod-db/lib";
import { StorageClient } from "../storage/storage-client";
import { Config } from "../config";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";

@injectable()
export class WorkspaceDeletionService {
    @inject(TracedWorkspaceDB) protected readonly db: DBWithTracing<WorkspaceDB>;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(Config) protected readonly config: Config;
    @inject(WorkspaceManagerClientProvider)
    protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;

    /**
     * This method garbageCollects a workspace. It deletes its contents and sets the workspaces 'contentDeletedTime'
     * @param ctx
     * @param ws
     */
    public async garbageCollectWorkspace(ctx: TraceContext, ws: WorkspaceOwnerAndSoftDeleted): Promise<boolean> {
        const span = TraceContext.startSpan("garbageCollectWorkspace", ctx);

        try {
            const successfulDeleted = await this.deleteWorkspaceStorage({ span }, ws, true);
            await this.db.trace({ span }).updatePartial(ws.id, { contentDeletedTime: new Date().toISOString() });
            return successfulDeleted;
        } catch (err) {
            TraceContext.setError({ span }, err);
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
            const successfulDeleted = await this.deleteWorkspaceStorage({ span }, ws, true);
            const now = new Date().toISOString();
            // Note: soft & content deletion happens at the same time, because prebuilds are reproducible so there's no need for the extra time span.
            await this.db.trace({ span }).updatePartial(ws.id, {
                contentDeletedTime: now,
                softDeletedTime: now,
                softDeleted: "gc",
            });
            return successfulDeleted;
        } catch (err) {
            TraceContext.setError({ span }, err);
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
    private async deleteWorkspaceStorage(
        ctx: TraceContext,
        ws: WorkspaceAndOwner,
        includeSnapshots: boolean,
    ): Promise<boolean> {
        const span = TraceContext.startSpan("deleteWorkspaceStorage", ctx);
        try {
            await this.storageClient.deleteWorkspaceBackups(ws.ownerId, ws.id, includeSnapshots);
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
        return true;
    }
}
