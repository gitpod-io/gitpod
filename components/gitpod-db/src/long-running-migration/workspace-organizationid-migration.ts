/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { TypeORM } from "../typeorm/typeorm";
import { LongRunningMigration } from "./long-running-migration";

const BATCH_OFFSET = 12 * 60 * 60 * 1000; /* 12 hour */

@injectable()
export class WorkspaceOrganizationIdMigration implements LongRunningMigration {
    @inject(TypeORM) protected readonly typeorm: TypeORM;

    getName(): string {
        return "WorkspaceOrganizationIdMigration";
    }

    public async runMigrationBatch(): Promise<boolean> {
        const conn = await this.typeorm.getConnection();
        const runner = conn.createQueryRunner();
        const minCreationTimeMigrated = (
            await runner.query(
                "SELECT min(creationTime) as minTime FROM d_b_workspace WHERE organizationId IS NOT NULL",
            )
        )[0].minTime;
        const minCreationTimeTotal = (await runner.query("SELECT min(creationTime) as minTime FROM d_b_workspace"))[0]
            .minTime;

        let endDate = minCreationTimeMigrated ? new Date(Date.parse(minCreationTimeMigrated)) : new Date();
        let startDate = new Date(endDate.getTime() - BATCH_OFFSET);
        log.info(`Running migration with start date: ${startDate}, end date: ${endDate}`);

        let result;
        do {
            const query = `
            UPDATE d_b_workspace w
            JOIN (
                SELECT workspaceId, MAX(creationTime) as maxCreationTime
                FROM d_b_workspace_instance
                WHERE usageAttributionId LIKE 'team:%'
                GROUP BY workspaceId
                ) wi ON w.id = wi.workspaceId
                SET w.organizationid = (
                    SELECT substr(usageAttributionId, 6)
                    FROM d_b_workspace_instance
                    WHERE workspaceId = wi.workspaceId AND creationTime = wi.maxCreationTime
                    )
                    WHERE
                    w.creationTime >= '${startDate.toISOString()}' and
                    w.creationTime < '${endDate.toISOString()}' and
                    w.organizationId IS NULL and
                    w.softDeleted IS NULL
            `;
            result = await runner.query(query);
            if (result.affectedRows > 0) {
                log.info(`Migrated ${result.affectedRows} workspaces. Start date: ${startDate}, end date: ${endDate}`, {
                    query,
                });
            } else {
                // Wait a second to avoid hammering the database
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            endDate = new Date(endDate.getTime() - BATCH_OFFSET);
            startDate = new Date(startDate.getTime() - BATCH_OFFSET);
        } while (result.affectedRows === 0 && endDate.toISOString() > minCreationTimeTotal);
        const completed = result.affectedRows === 0;
        return completed;
    }
}
