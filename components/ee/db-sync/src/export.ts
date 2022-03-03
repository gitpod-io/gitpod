/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { TableDescription, TableDescriptionProvider } from '@gitpod/gitpod-db/lib/tables';
import { Connection, escape } from 'mysql';
import { Transform } from 'stream';
import { query } from './database';
import { injectable, multiInject } from 'inversify';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export class TableUpdate {
    constructor(protected table: TableDescription, protected start?: Date, protected end?: Date) {}
    protected columns: string[];
    protected updateColumns: string[];
    protected _updates?: string[];
    protected _deletions?: string[];

    public get updates(): string[] | undefined {
        return this._updates;
    }

    public get deletions(): string[] | undefined {
        return this._deletions;
    }

    public async populate(conn: Connection): Promise<void> {
        let description: any[];
        try {
            description = (await query(conn, `DESCRIBE ${this.table.name}`)) as any[];
        } catch (err) {
            // TODO(cw): for the time being we might have more tables in the replication list than we actually have
            //           in the database, due to the gitpod-com move. Once we've resolved this situation, missing tables
            //           should produce a proper error again.

            // table does not exist - we're done here.
            log.warn(`table ${this.table.name} does not exist - not replicating`);
            return;
        }

        // check that timeColumn is a timestamp
        const timeField = description.find((f) => f.Field == this.table.timeColumn);
        if (!timeField) {
            throw new Error(
                `Table ${this.table.name} has no column ${this.table.timeColumn} configured for time-based sync`,
            );
        } else if (!(timeField.Type as string).toLowerCase().startsWith('timestamp')) {
            throw new Error(
                `${this.table.name}'s time-column ${this.table.timeColumn} is not a timestamp, but ${timeField.Type}`,
            );
        }

        this.columns = description.map((f) => f.Field as string);
        this.updateColumns = this.columns
            // do not update primary keys
            .filter((f) => !this.table.primaryKeys.find((pk) => f == pk))
            // actually ignore the ignore columns
            .filter((f) => !(this.table.ignoreColumns || []).find((ic) => f == ic));

        let dataQueryParams: any[] = [];
        let timeConditions = [];
        if (this.start) {
            timeConditions.push(`${this.table.timeColumn} >= ?`);
            dataQueryParams.push(this.start);
        }
        if (this.end) {
            timeConditions.push(`${this.table.timeColumn} <= ?`);
            dataQueryParams.push(this.end);
        }
        if (this.table.expiryColumn) {
            timeConditions.push(`${this.table.expiryColumn} >= UNIX_TIMESTAMP(UTC_TIMESTAMP())`);
        }
        let condition = '';
        if (timeConditions.length > 0) {
            condition = `WHERE ${timeConditions.join(' AND ')}`;
        }
        const dataQuery = `SELECT ${this.columns.join(', ')} FROM ${this.table.name} ${condition}`;
        const deletionsAndUpdates = await new Promise<string[][]>((resolve, reject) => {
            const updates: string[] = [];
            const deletions: string[] = [];
            try {
                conn.query({ sql: dataQuery, values: dataQueryParams })
                    .stream()
                    .pipe(
                        new Transform({
                            objectMode: true,
                            transform: (data: any, encoding, cb) => {
                                if (data[this.table.timeColumn] > Date.now()) {
                                    const pk = this.table.primaryKeys.map((pk) => data[pk]).join(', ');
                                    console.warn(
                                        `Row (${this.table.name}: ${pk}) was modified in the future. Possible time sync issue between database and db-sync.`,
                                    );
                                }

                                const deletionStatement = this.getDeletionStatement(data);
                                if (deletionStatement) {
                                    deletions.push(deletionStatement);
                                }

                                this.getUpdateStatement(data).forEach((s) => updates.push(s));

                                cb();
                            },
                        }),
                    )
                    .on('error', (err) => reject(new Error(`Error while exporting ${this.table.name}: ${err}`)))
                    .on('finish', () => {
                        console.debug(
                            `Export of ${this.table.name} done: ${deletions.length} deletions, ${updates.length} updates`,
                        );
                        resolve([deletions, updates]);
                    });
            } catch (err) {
                reject(new Error(`Error while exporting ${this.table.name}: ${err}`));
            }
        });

        this._deletions = deletionsAndUpdates[0];
        this._updates = deletionsAndUpdates[1];
    }

    protected shouldDelete(row: any): boolean {
        if (!this.table.deletionColumn) {
            return false;
        }

        return !!row[this.table.deletionColumn];
    }

    protected getDeletionStatement(row: any): string | undefined {
        if (!this.shouldDelete(row)) {
            return;
        }

        const updateConditions = this.getUpdateConditions(row);
        return `DELETE FROM ${this.table.name} WHERE ${updateConditions};`;
    }

    protected getUpdateStatement(row: any, forceInsert: boolean = false): string[] {
        if (this.shouldDelete(row) && !forceInsert) {
            return [];
        }

        const pkValues = this.table.primaryKeys.map((c) => escape(row[c], true));
        const updateValues = this.updateColumns.map((c) => escape(row[c], true));
        const updates = this.updateColumns.map((c, i) => `${c}=${updateValues[i]}`).join(', ');
        const updateConditions = this.getUpdateConditions(row);

        let result = [
            `INSERT${forceInsert ? '' : ' IGNORE'} INTO ${this.table.name} (${this.table.primaryKeys
                .concat(this.updateColumns)
                .join(', ')}) VALUES (${pkValues.concat(updateValues).join(', ')});`,
        ];
        if (!forceInsert) {
            result.push(`UPDATE ${this.table.name} SET ${updates} WHERE ${updateConditions};`);
        }
        return result;
    }

    protected getUpdateConditions(row: any): string {
        return this.table.primaryKeys
            .map((pk) => `${pk}=${escape(row[pk])}`)
            .concat([`${this.table.timeColumn}<=${escape(row[this.table.timeColumn])}`])
            .join(' AND ');
    }
}

@injectable()
export class TableUpdateProvider {
    @multiInject(TableDescriptionProvider)
    protected readonly descriptionProvider: TableDescriptionProvider[];

    public async getAllStatementsForAllTables(
        conn: Connection,
        tableSet?: string,
        start_date?: Date,
        end_date?: Date,
    ): Promise<{ deletions: string[]; updates: string[] }> {
        const provider = tableSet
            ? this.descriptionProvider.find((v) => v.name == tableSet)
            : this.descriptionProvider[0];
        if (!provider) {
            throw new Error(`Unknown table set ${tableSet} or no table description providers registered`);
        }
        const tableUpdates = provider.getSortedTables().map((t) => new TableUpdate(t, start_date, end_date));
        await Promise.all(tableUpdates.map((t) => t.populate(conn)));

        // when collecting the deletions do so in the inverse order as during update (delete dependency targes first)
        const deletions = [];
        for (var stmts of tableUpdates.reverse()) {
            for (var stmt of stmts.deletions || []) {
                deletions.push(stmt);
            }
        }
        const updates = [];
        for (var stmts of tableUpdates) {
            for (var stmt of stmts.updates || []) {
                updates.push(stmt);
            }
        }
        return { deletions, updates };
    }
}
