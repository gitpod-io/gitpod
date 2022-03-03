/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Connection } from 'mysql';
import { TableUpdateProvider } from './export';
import * as ProgressBar from 'progress';
import { query, NamedConnection } from './database';
import { injectable, inject } from 'inversify';
import * as path from 'path';
import * as fs from 'fs';
import { Semaphore } from '@gitpod/gitpod-protocol/lib/util/semaphore';

export type PeriodicReplicatorProvider = (
    source: Connection,
    targets: Connection[],
    syncInterval: number,
    tableSet: string,
) => PeriodicReplicator;
export const PeriodicReplicatorProvider = Symbol('PeriodicReplicatorProvider');

@injectable()
export class PeriodicReplicator {
    @inject(TableUpdateProvider)
    protected tableUpdateProvider: TableUpdateProvider;

    protected source: NamedConnection;
    protected targets: NamedConnection[];
    protected syncInterval: number;
    protected showProgressBar: boolean = false;
    protected tableSet: string | undefined;
    protected logdir: string | undefined;
    protected useTransactions: boolean = true;

    // This is a weird setup and I'd rather have those fields set in the constructor.
    // I have not found a way how to do that using inversify.
    public setup(
        source: NamedConnection,
        targets: NamedConnection[],
        syncInterval: number,
        tableSet: string | undefined,
    ) {
        this.source = source;
        this.targets = targets;
        this.syncInterval = syncInterval;
        this.tableSet = tableSet;
    }

    public enableLogs(logdir: string) {
        this.logdir = logdir;
    }

    public disableTransactions(disable: boolean) {
        this.useTransactions = !disable;
    }

    public showProgressbar(show: boolean) {
        this.showProgressBar = show;
    }

    public async start(forceInitialSync: boolean): Promise<void> {
        console.log('Starting DB replicator');
        await this.synchronize(forceInitialSync);
        console.log('Initial replication done');
        setInterval(() => this.synchronize(false), this.syncInterval);
        console.log('Regular sync process established');
        return new Promise<void>((rs, rj) => {});
    }

    public async synchronize(ignoreStartDate: boolean): Promise<void> {
        const now = new Date();
        let previousRun = await this.getLastExportDate();
        console.info(`Replicating ${this.toString()}: last ran on ${previousRun}`);
        if (ignoreStartDate) {
            if (previousRun && previousRun > now) {
                console.warn(
                    `Previous run was in the future (${previousRun} > now=${now}). Possible time sync issue between database and db-sync.`,
                );
            }

            console.info('Synchronizing complete database (ignoring previous run)');
            previousRun = undefined;
        } else if (previousRun && previousRun > now) {
            throw new Error(
                `Previous run was in the future (${previousRun} > now=${now}). Possible time sync issue between database and db-sync.`,
            );
        }

        const modifications = await this.tableUpdateProvider.getAllStatementsForAllTables(
            this.source,
            this.tableSet,
            previousRun,
        );
        const deletions = modifications.deletions;
        const updates = modifications.updates;
        const total = [...deletions, ...updates];
        console.debug(`Collected ${total.length} statements`);
        try {
            /* nowait */ this.logStatements(now, total);

            await Promise.all([this.source, ...this.targets].map((target) => this.update(target, deletions)));
            await Promise.all(this.targets.map((target) => this.update(target, updates)));
            await this.markLastExportDate(now);
        } catch (err) {
            console.error('Error during replication', err);
        }
    }

    protected async logStatements(now: Date, updates: string[]) {
        if (!this.logdir) return;

        const logdir = this.logdir;
        const dest = path.join(logdir, `${this.tableSet || 'default'}-${now.getTime()}.sql`);
        try {
            if (!(await new Promise<boolean>((resolve, reject) => fs.exists(logdir, resolve)))) {
                await new Promise<void>((resolve, reject) => {
                    fs.mkdir(logdir, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }

            const logfile = fs.createWriteStream(dest, { flags: 'w' });
            const semaphore = new Semaphore(1);
            logfile.on('drain', () => semaphore.release());
            for (const row of updates) {
                const written = logfile.write(row + '\n');
                if (!written) {
                    await semaphore.acquire();
                }
            }
            console.debug(`Log file ${dest} written`);
        } catch (err) {
            console.warn('Error while writing log file to ' + dest, err);
        }

        await this.deleteOldLogs(logdir);
    }

    protected async deleteOldLogs(logdir: string) {
        try {
            const files = await new Promise<string[]>((resolve, reject) =>
                fs.readdir(this.logdir!, (err: any, files: string[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(files);
                    }
                }),
            );
            for (const file of files) {
                // We don't care about errors during deletion: it's racy anyway (see "nowait" above), and will succeed next time
                const filePath = path.join(logdir, file);
                const ctime = await new Promise<number>((resolve, reject) =>
                    fs.stat(filePath, (err, stats) => {
                        if (!err) {
                            resolve(stats.ctimeMs);
                        }
                    }),
                );
                const now = Date.now();
                const endTime = ctime + 2 * 24 * 60 * 60;
                if (now > endTime) {
                    fs.unlink(filePath, (_) => {});
                }
            }
        } catch (err) {
            console.debug('Error while cleaning up old replicator logs', err);
        }
    }

    protected async getLastExportDate(): Promise<Date | undefined> {
        try {
            const rows = (await query(
                this.source,
                "SELECT value FROM gitpod_replication WHERE item = 'lastExport'",
            )) as any[];
            if (rows.length > 0) {
                return new Date(rows[0]['value'] as string);
            }
            return undefined;
        } catch (err) {
            if (err.toString().indexOf('ER_NO_SUCH_TABLE') > -1) {
                return undefined;
            } else {
                throw err;
            }
        }
    }

    protected async update(target: Connection, updates: string[], batchSize = 100) {
        const updateSize = updates.join().length;
        const inTransaction = updateSize < 8 * 1024 * 1024 && this.useTransactions;
        if (inTransaction) {
            await query(target, 'START TRANSACTION;');
        } else {
            console.warn(
                'Update is too big (> 8mb) or transactions are disabled, not running in a transaction! Inconsistency is possible.',
            );
        }

        const bar =
            this.showProgressBar && updates.length > batchSize
                ? new ProgressBar('inserting/updating [:bar] :rate/bps :percent :etas', updates.length / batchSize)
                : { tick: () => {}, terminate: () => {} };
        try {
            for (var i = 0; i < updates.length; i += batchSize) {
                const imax = Math.min(i + batchSize, updates.length);
                const thisUpdate = updates.slice(i, imax).join('');
                await query(target, thisUpdate);
                bar.tick();
            }
            if (inTransaction) {
                console.debug('Modifications were OK. Committing transaction.');
                await query(target, 'COMMIT;');
            }
        } catch (err) {
            if (inTransaction) {
                console.error('Caught an error during modification. Rolling back transaction.', err);
                await query(target, 'ROLLBACK;');
            } else {
                console.error(
                    'Caught an error during modification. NOT RUNNING IN A TRANSACTION. Data may be inconsistent.',
                    err,
                );
            }
            throw err;
        } finally {
            bar.terminate();
        }
    }

    async markLastExportDate(date: Date) {
        await query(
            this.source,
            'CREATE TABLE IF NOT EXISTS gitpod_replication (item VARCHAR(36), value VARCHAR(255), PRIMARY KEY (item))',
        );
        await query(
            this.source,
            "INSERT INTO gitpod_replication VALUES ('lastExport', ?) ON DUPLICATE KEY UPDATE value=?",
            { values: [date.toISOString(), date.toISOString()] },
        );
    }

    public toString(): string {
        return `${this.source.name} -> [ ${this.targets.map((t) => t.name).join(', ')} ]`;
    }
}
