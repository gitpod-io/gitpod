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
import { ConsensusLeaderQorum } from "../consensus/consensus-leader-quorum";

@injectable()
export class SnapshotService {
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(ConsensusLeaderQorum) protected readonly leaderQuorum: ConsensusLeaderQorum;

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
}
