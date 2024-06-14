/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBWorkspaceInstance, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";
import { Config } from "../config";
import { Repository } from "typeorm";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

@injectable()
export class CapStatus implements Job {
    @inject(Config) protected readonly config: Config;
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;

    public name = "status-capper";
    public frequencyMs = 2 * 60 * 1000; // every 2 minutes

    public async run(): Promise<number | undefined> {
        log.info("cap-status: we're leading the quorum.");

        const limit = 500;
        const instances = await this.workspaceDb.transaction(async (db) => {
            const repo = await ((db as any).getWorkspaceInstanceRepo() as Promise<Repository<DBWorkspaceInstance>>);
            const instances = await this.findInstancesWithLengthyStatus(repo, limit);
            if (instances.length === 0) {
                return [];
            }

            // Cap the status (the old place where we stored gitStatus before)
            instances.forEach((i) => {
                if (i.status) {
                    delete (i.status as any).repo;
                }
            });

            // In order to effectively cap the storage size, we have to delete and re-inser the instance.
            // Thank you, MySQL! -.-
            await repo.delete(instances.map((i) => i.id));
            await repo.save(instances);

            return instances;
        });
        const instancesCapped = instances.length;

        log.info(`cap-status: capped ${instancesCapped} instances.`, {
            instanceIds: new TrustedValue(instances.map((i) => i.id)),
        });
        return instancesCapped;
    }

    async findInstancesWithLengthyStatus(
        repo: Repository<DBWorkspaceInstance>,
        limit: number = 1000,
    ): Promise<WorkspaceInstance[]> {
        const qb = repo.createQueryBuilder("wsi").where("wsi.status->>'$.repo' IS NOT NULL").limit(limit);
        return qb.getMany();
    }
}
