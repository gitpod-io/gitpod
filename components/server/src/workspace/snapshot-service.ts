/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { v4 as uuidv4 } from "uuid";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { GitpodServer, Snapshot } from "@gitpod/gitpod-protocol";
import { StorageClient } from "../storage/storage-client";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export interface WaitForSnapshotOptions {
    workspaceOwner: string;
    snapshot: Snapshot;
}

const SNAPSHOT_TIMEOUT_SECONDS = 60 * 30;
const SNAPSHOT_POLL_INTERVAL_SECONDS = 5;

@injectable()
export class SnapshotService {
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(StorageClient) protected readonly storageClient: StorageClient;

    public async createSnapshot(options: GitpodServer.TakeSnapshotOptions, snapshotUrl: string): Promise<Snapshot> {
        const id = uuidv4();
        return await this.workspaceDb.storeSnapshot({
            id,
            creationTime: new Date().toISOString(),
            state: "pending",
            bucketId: snapshotUrl,
            originalWorkspaceId: options.workspaceId,
        });
    }

    public async waitForSnapshot(opts: WaitForSnapshotOptions): Promise<void> {
        try {
            return await this.driveSnapshot(opts);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.SNAPSHOT_ERROR, String(err));
        }
    }

    public async driveSnapshot(opts: WaitForSnapshotOptions): Promise<void> {
        if (opts.snapshot.state === "available") {
            return;
        }
        if (opts.snapshot.state === "error") {
            throw new Error(`snapshot error: ${opts.snapshot.message}`);
        }

        const { id: snapshotId, bucketId, originalWorkspaceId, creationTime } = opts.snapshot;
        const start = new Date(creationTime).getTime();
        while (start + SNAPSHOT_TIMEOUT_SECONDS * 1000 > Date.now()) {
            await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_POLL_INTERVAL_SECONDS * 1000));

            // did somebody else complete that snapshot?
            const snapshot = await this.workspaceDb.findSnapshotById(snapshotId);
            if (!snapshot) {
                throw new Error(`no snapshot with id '${snapshotId}' found.`);
            }
            if (snapshot.state === "available") {
                return;
            }
            if (snapshot.state === "error") {
                throw new Error(`snapshot error: ${snapshot.message}`);
            }

            // pending: check if the snapshot is there
            const exists = await this.storageClient.workspaceSnapshotExists(
                opts.workspaceOwner,
                originalWorkspaceId,
                bucketId,
            );
            if (exists) {
                await this.workspaceDb.updateSnapshot({
                    id: snapshotId,
                    state: "available",
                    availableTime: new Date().toISOString(),
                });
                return;
            }
        }

        // took too long
        const message = `snapshot timed out after taking longer than ${SNAPSHOT_TIMEOUT_SECONDS}s.`;
        await this.workspaceDb.updateSnapshot({
            id: snapshotId,
            state: "error",
            message,
        });
        throw new Error(message);
    }
}
