/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";
import { StorageClient } from "../storage/storage-client";
import { Snapshot } from "@gitpod/gitpod-protocol";
import { Config } from "../config";

const SNAPSHOT_TIMEOUT_SECONDS = 60 * 30;
const SNAPSHOT_POLL_INTERVAL_SECONDS = 5;

@injectable()
export class SnapshotsJob implements Job {
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(Config) protected readonly config: Config;

    public name = "snapshots";
    public lockId = ["snapshots"];
    public frequencyMs = 5 * 60 * 1000; // every 5 minutes

    public async run(): Promise<void> {
        if (this.config.completeSnapshotJob?.disabled) {
            log.info("snapshots: Snapshot completion job is disabled.");
            return;
        }

        log.info("snapshots: we're leading the quorum. picking up pending snapshots and driving them home.");
        const step = 50; // make sure we're not flooding ourselves
        const { snapshots: pendingSnapshots, total } = await this.workspaceDb.findSnapshotsWithState(
            "pending",
            0,
            step,
        );
        if (total > step) {
            log.warn("snapshots: looks like we have more pending snapshots then we can handle!");
        }

        for (const snapshot of pendingSnapshots) {
            const workspace = await this.workspaceDb.findById(snapshot.originalWorkspaceId);
            if (!workspace) {
                log.error(
                    { workspaceId: snapshot.originalWorkspaceId },
                    `snapshots: unable to find workspace for snapshot`,
                    { snapshotId: snapshot.id },
                );
                continue;
            }

            this.driveSnapshot({ workspaceOwner: workspace.ownerId, snapshot }).catch((err) =>
                log.error("driveSnapshot", err),
            );
        }
    }

    protected async driveSnapshot(opts: { workspaceOwner: string; snapshot: Snapshot }): Promise<void> {
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
