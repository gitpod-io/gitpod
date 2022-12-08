/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

import { GitpodTableDescriptionProvider, TableDescription } from "./tables";
import { TypeORM } from "./typeorm/typeorm";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";

@injectable()
export class PeriodicDbDeleter {
    @inject(GitpodTableDescriptionProvider) protected readonly tableProvider: GitpodTableDescriptionProvider;
    @inject(TypeORM) protected readonly typeORM: TypeORM;

    start() {
        log.error("[PeriodicDbDeleter] Start ...");
        this.sync().catch((err) => log.error("[PeriodicDbDeleter] sync failed", err));
    }

    protected async sync() {
        const doSync = async () => {
            const sortedTables = this.tableProvider.getSortedTables();
            const toBeDeleted: { table: string; deletions: string[] }[] = [];
            for (const table of sortedTables) {
                toBeDeleted.push(await this.collectRowsToBeDeleted(table));
            }
            // when collecting the deletions do so in the inverse order as during update (delete dependency targes first)
            const pendingDeletions: Promise<void>[] = [];
            for (const { deletions } of toBeDeleted.reverse()) {
                for (const deletion of deletions) {
                    pendingDeletions.push(
                        this.query(deletion).catch((err) => log.error(`[PeriodicDbDeleter] sync error`, err)),
                    );
                }
            }
            await Promise.all(pendingDeletions);
        };
        repeat(doSync, 30000); // deletion is never time-critical, so we should ensure we do not spam ourselves
    }
    protected async collectRowsToBeDeleted(table: TableDescription): Promise<{ table: string; deletions: string[] }> {
        try {
            await this.query(`SELECT COUNT(1) FROM ${table.name}`);
        } catch (err) {
            // table does not exist - we're done here
            return { table: table.name, deletions: [] };
        }

        const deletions: string[] = [];
        const result = { table: table.name, deletions };
        if (!table.deletionColumn) {
            return result;
        }

        const { deletionColumn, primaryKeys } = table;
        const markedAsDeletedQuery = `SELECT ${primaryKeys.join(", ")} FROM ${
            table.name
        } WHERE ${deletionColumn} = true ;`;
        const rows = await this.query(markedAsDeletedQuery);

        const whereClauseFn = (row: any) => primaryKeys.map((pk) => `${pk}='${row[pk]}'`).join(" AND ");
        for (const i in rows) {
            const row = rows[i];
            const whereClause = whereClauseFn(row);
            deletions.push(`DELETE FROM ${table.name} WHERE ${whereClause};`);
        }

        return result;
    }

    protected async query(sql: string): Promise<any> {
        const connection = await this.connection;
        const result = await connection.query(sql);
        return result;
    }

    protected get connection() {
        return this.typeORM.getConnection();
    }
}
