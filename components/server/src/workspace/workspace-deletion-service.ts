/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { WorkspaceSoftDeletion, VolumeSnapshot } from "@gitpod/gitpod-protocol";
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
import { DeleteVolumeSnapshotRequest } from "@gitpod/ws-manager/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class WorkspaceDeletionService {
    @inject(TracedWorkspaceDB) protected readonly db: DBWithTracing<WorkspaceDB>;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(Config) protected readonly config: Config;
    @inject(WorkspaceManagerClientProvider)
    protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;

    /**
     * This method does nothing beyond marking the given workspace as 'softDeleted' with the given cause and sets the 'softDeletedTime' to now.
     * The actual deletion happens as part of the regular workspace garbage collection.
     * @param ctx
     * @param ws
     * @param softDeleted
     */
    public async softDeleteWorkspace(
        ctx: TraceContext,
        ws: WorkspaceAndOwner,
        softDeleted: WorkspaceSoftDeletion,
    ): Promise<void> {
        await this.db.trace(ctx).updatePartial(ws.id, {
            softDeleted,
            softDeletedTime: new Date().toISOString(),
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
            const successfulDeleted = await this.deleteWorkspaceStorage({ span }, ws, deleteSnapshots);
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
    protected async deleteWorkspaceStorage(
        ctx: TraceContext,
        ws: WorkspaceAndOwner,
        includeSnapshots: boolean,
    ): Promise<boolean> {
        const span = TraceContext.startSpan("deleteWorkspaceStorage", ctx);
        try {
            await this.storageClient.deleteWorkspaceBackups(ws.ownerId, ws.id, includeSnapshots);
            let vss = await this.db.trace({ span }).findVolumeSnapshotForGCByWorkspaceId(ws.id);
            await Promise.all(vss.map((vs) => this.garbageCollectVolumeSnapshot({ span }, vs)));
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
        return true;
    }

    /**
     * Perform deletion of volume snapshot from all clusters and from gloud provider:
     *  - throws an error if something went wrong during deletion
     *  - returns true in case of successful deletion
     * @param ctx
     * @param vs
     */
    public async garbageCollectVolumeSnapshot(ctx: TraceContext, vs: VolumeSnapshot): Promise<boolean> {
        const span = TraceContext.startSpan("garbageCollectVolumeSnapshot", ctx);

        try {
            const allClusters = await this.workspaceManagerClientProvider.getAllWorkspaceClusters();
            // we need to do two things here:
            // 1. we want to delete volume snapshot object from all workspace clusters
            // 2. we want to delete cloud provider source snapshot
            let wasDeleted = false;
            let index = 0;

            let availableClusters = allClusters.filter((c) => c.state === "available");
            for (let cluster of availableClusters) {
                const client = await this.workspaceManagerClientProvider.get(cluster.name);
                const req = new DeleteVolumeSnapshotRequest();
                req.setId(vs.id);
                req.setVolumeHandle(vs.volumeHandle);

                let softDelete = true;
                // if we did not delete volume snapshot yet and this is our last cluster, make sure we perform hard delete
                // meaning we will restore volume snapshot in that cluster, and then delete it, so that it will be removed
                // from cloud provider as well
                if (!wasDeleted && index == availableClusters.length - 1) {
                    softDelete = false;
                }
                req.setSoftDelete(softDelete);

                index = index + 1;
                try {
                    const deleteResp = await client.deleteVolumeSnapshot(ctx, req);
                    if (deleteResp.getWasDeleted() === true) {
                        wasDeleted = true;
                    }
                } catch (err) {
                    log.error("wds: deleteVolumeSnapshot failed", err);
                }
            }
            if (wasDeleted) {
                await this.db.trace({ span }).deleteVolumeSnapshot(vs.id);
            }

            return wasDeleted;
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }
}
