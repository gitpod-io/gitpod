/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

import { GitpodTableDescriptionProvider, TableDescription } from "./tables";
import { TypeORM } from "./typeorm/typeorm";

@injectable()
export class PeriodicDbDeleter {
    @inject(GitpodTableDescriptionProvider) protected readonly tableProvider: GitpodTableDescriptionProvider;
    @inject(TypeORM) protected readonly typeORM: TypeORM;

    async runOnce(): Promise<number> {
        const tickID = new Date().toISOString();
        log.info("[PeriodicDbDeleter] Starting to collect deleted rows.", {
            periodicDeleterTickId: tickID,
        });
        const sortedTables = this.tableProvider.getSortedTables();
        const toBeDeleted: { table: string; deletions: string[] }[] = [];
        for (const table of sortedTables) {
            const rowsForTableToDelete = await this.collectRowsToBeDeleted(table);
            if (rowsForTableToDelete.deletions.length === 0) {
                continue;
            }
            log.info(
                `[PeriodicDbDeleter] Identified ${rowsForTableToDelete.deletions.length} entries in ${rowsForTableToDelete.table} to be deleted.`,
                {
                    periodicDeleterTickId: tickID,
                },
            );
            toBeDeleted.push(rowsForTableToDelete);
        }
        // when collecting the deletions do so in the inverse order as during update (delete dependency targes first)
        const pendingDeletions: Promise<void>[] = [];
        for (const { deletions } of toBeDeleted.reverse()) {
            for (const deletion of deletions) {
                const promise: Promise<void> = this.query(deletion).catch((err) =>
                    log.error(`[PeriodicDbDeleter] sync error`, err, {
                        periodicDeleterTickId: tickID,
                        query: deletion,
                    }),
                );
                pendingDeletions.push(promise);
            }
        }
        await Promise.all(pendingDeletions);
        log.info("[PeriodicDbDeleter] Finished deleting records.", {
            periodicDeleterTickId: tickID,
        });
        return pendingDeletions.length;
    }

    protected async collectRowsToBeDeleted(table: TableDescription): Promise<{ table: string; deletions: string[] }> {
        try {
            await this.query(`SELECT 1 FROM ${table.name} LIMIT 1`);
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
        } WHERE ${deletionColumn} = true LIMIT 100;`;
        const rows = await this.query(markedAsDeletedQuery);

        const whereClauseFn = (row: any) => primaryKeys.map((pk) => `${pk}='${row[pk]}'`).join(" AND ");
        for (const i in rows) {
            const row = rows[i];
            const whereClause = whereClauseFn(row);
            deletions.push(`DELETE FROM ${table.name} WHERE ${whereClause} AND ${deletionColumn} = true;`);
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
