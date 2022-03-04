/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Disposable, GitpodServer, Snapshot } from "@gitpod/gitpod-protocol";
import { StorageClient } from "../../../src/storage/storage-client";
import { ConsensusLeaderQorum } from "../../../src/consensus/consensus-leader-quorum";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";

const SNAPSHOT_TIMEOUT_SECONDS = 60 * 30;
const SNAPSHOT_POLL_INTERVAL_SECONDS = 5;
const SNAPSHOT_DB_POLL_INTERVAL_SECONDS = 60 * 5;

export interface WaitForSnapshotOptions {
    workspaceOwner: string;
    snapshot: Snapshot;
}

/**
 * SnapshotService hosts all code that's necessary to create snapshots and drive them to completion.
 * To guarantee every snapshot reacheds an end state ('error' or 'available') it regularly polls the DB to pick up and drive those as well.
 */
@injectable()
export class SnapshotService {
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(ConsensusLeaderQorum) protected readonly leaderQuorum: ConsensusLeaderQorum;

    protected readonly runningSnapshots: Map<string, Promise<void>> = new Map();

    public async start(): Promise<Disposable> {
        return repeat(() => this.pickupAndDriveFromDbIfWeAreLeader().catch(log.error), SNAPSHOT_DB_POLL_INTERVAL_SECONDS * 1000);
    }

    public async pickupAndDriveFromDbIfWeAreLeader() {
        if (!await this.leaderQuorum.areWeLeader()) {
            return
        }

        log.info("snapshots: we're leading the quorum. picking up pending snapshots and driving them home.");
        const step = 50;    // make sure we're not flooding ourselves
        const { snapshots: pendingSnapshots, total } = await this.workspaceDb.findSnapshotsWithState('pending', 0, step);
        if (total > step) {
            log.warn("snapshots: looks like we have more pending snapshots then we can handle!");
        }

        for (const snapshot of pendingSnapshots) {
            const workspace = await this.workspaceDb.findById(snapshot.originalWorkspaceId);
            if (!workspace) {
                log.error({ workspaceId: snapshot.originalWorkspaceId }, `snapshots: unable to find workspace for snapshot`, { snapshotId: snapshot.id });
                continue;
            }

            this.driveSnapshotCached({ workspaceOwner: workspace.ownerId, snapshot })
                .catch(err => {/** ignore */});
        }
    }

    public async createSnapshot(options: GitpodServer.TakeSnapshotOptions, snapshotUrl: string): Promise<Snapshot> {
        const id = uuidv4()
        return await this.workspaceDb.storeSnapshot({
            id,
            creationTime: new Date().toISOString(),
            state: 'pending',
            bucketId: snapshotUrl,
            originalWorkspaceId: options.workspaceId,
            layoutData: options.layoutData,
        });
    }

    public async waitForSnapshot(opts: WaitForSnapshotOptions): Promise<void> {
        return await this.driveSnapshotCached(opts);
    }

    protected async driveSnapshotCached(opts: WaitForSnapshotOptions): Promise<void> {
        const running = this.runningSnapshots.get(opts.snapshot.id);
        if (running) {
            return running;
        }

        const started = this.driveSnapshot(opts)
            .finally(() => this.runningSnapshots.delete(opts.snapshot.id))
            .catch(err => log.error("driveSnapshot", err));
        this.runningSnapshots.set(opts.snapshot.id, started);
        return started;
    }

    protected async driveSnapshot(opts: WaitForSnapshotOptions): Promise<void> {
        if (opts.snapshot.state === 'available') {
            return;
        }
        if (opts.snapshot.state === 'error') {
            throw new Error(`snapshot error: ${opts.snapshot.message}`);
        }

        const { id: snapshotId, bucketId, originalWorkspaceId, creationTime } = opts.snapshot;
        const start = new Date(creationTime).getTime();
        while (start + (SNAPSHOT_TIMEOUT_SECONDS * 1000) > Date.now()) {
            await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_POLL_INTERVAL_SECONDS * 1000));

            // did somebody else complete that snapshot?
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

            // pending: check if the snapshot is there
            const exists = await this.storageClient.workspaceSnapshotExists(opts.workspaceOwner, originalWorkspaceId, bucketId);
            if (exists) {
                await this.workspaceDb.updateSnapshot({
                    id: snapshotId,
                    state: 'available',
                    availableTime: new Date().toISOString(),
                });
                return;
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