/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";
import { Config } from "../config";
import { SnapshotService } from "../workspace/snapshot-service";

@injectable()
export class SnapshotsJob implements Job {
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(SnapshotService) protected readonly snapshotService: SnapshotService;
    @inject(Config) protected readonly config: Config;

    public name = "snapshots";
    public frequencyMs = 5 * 60 * 1000; // every 5 minutes

    public async run(): Promise<number | undefined> {
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

            this.snapshotService
                .driveSnapshot({ workspaceOwner: workspace.ownerId, snapshot })
                .catch((err) => log.error("driveSnapshot", err));
        }

        return pendingSnapshots.length;
    }
}
