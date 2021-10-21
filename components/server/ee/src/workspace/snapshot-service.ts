/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Snapshot } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { StorageClient } from "../../../src/storage/storage-client";

const SNAPSHOT_TIMEOUT_SECONDS = 60 * 30;

@injectable()
export class SnapshotService {
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(StorageClient) protected readonly storageClient: StorageClient;

    public async driveSnapshot(snapshotWorkspaceOwner: string, _snapshot: Snapshot): Promise<void> {
        const { id: snapshotId, bucketId, originalWorkspaceId, creationTime } = _snapshot;
        const start = new Date(creationTime).getTime();
        while (start + SNAPSHOT_TIMEOUT_SECONDS < Date.now()) {
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // pending: check if we're done:
            const exists = await this.storageClient.workspaceSnapshotExists(snapshotWorkspaceOwner, originalWorkspaceId, bucketId);
            if (exists) {
                await this.workspaceDb.updateSnapshot({
                    id: snapshotId,
                    state: 'available',
                    availableTime: new Date().toISOString(),
                });
                return
            }

            const snapshot = await this.workspaceDb.findSnapshotById(snapshotId);
            if (!snapshot) {
                throw new Error(`no snapshot with id '${snapshotId}' found.`)
            }

            if (snapshot.state === 'available') {
                return;
            }
            if (snapshot.state === 'error') {
                throw new Error(`snapshot error: ${snapshot.message}`);
            }
        }

        // took too long
        const message = `snapshot timed out after taking longer than ${SNAPSHOT_TIMEOUT_SECONDS}s.`;
        await this.workspaceDb.updateSnapshot({
            id: snapshotId,
            state: 'error',
            message,
        });
        throw new Error(message);
    }
}