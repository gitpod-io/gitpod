/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ArgumentParser } from "argparse";
import { TableUpdateProvider } from "./export";
import { writeFile, readFileSync } from "fs";
import { ReplicationConfig } from "./config";
import { PeriodicReplicatorProvider, SyncPeriod } from "./replication";
import { connect, NamedConnection, query } from "./database";
import { injectable, inject, multiInject } from "inversify";
import { Config } from "@gitpod/gitpod-db/lib/config";
import * as path from "path";
import { TableDescription, TableDescriptionProvider } from "@gitpod/gitpod-db/lib/tables";

export const ICommand = Symbol("ICommand");

export interface ICommand {
    name: string;
    help?: string;

    addOptions(parser: ArgumentParser): void;
    run(args: any): Promise<void>;
}

@injectable()
export class RunCommand implements ICommand {
    name = "run";
    help = "Runs the sync process repeatedly";

    @inject(PeriodicReplicatorProvider)
    protected readonly replicatorProvider: PeriodicReplicatorProvider;

    addOptions(parser: ArgumentParser): void {
        parser.add_argument("--soft-start", {
            help: "Does not force a synchronization beyond the lastRunTime",
            action: "store_true",
        });
        parser.add_argument("config", {
            default: "/db-sync-config.json",
            nargs: "?",
        });
    }

    async run(args: any): Promise<void> {
        const config = JSON.parse(readFileSync(args.config).toString()) as ReplicationConfig;

        if (process.env.DB_PASSWORD) {
            console.info("Found DB_PASSWORD env var, using it to establish connections.");
            if (config.source) {
                config.source.password = process.env.DB_PASSWORD;
            }
            for (const target of config.targets) {
                target.password = process.env.DB_PASSWORD;
            }
        }
        if (process.env.DB_USERNAME) {
            console.info("Found DB_USERNAME env var, using it to establish connections.");
            if (config.source) {
                config.source.user = process.env.DB_USERNAME;
            }
            for (const target of config.targets) {
                target.user = process.env.DB_USERNAME;
            }
        }

        if (config.roundRobin) {
            if (config.source) {
                console.warn("Running in round robin mode. Ignoring source connection configuration!");
            }

            const targets = await Promise.all(config.targets.map((t) => connect(t)));
            const replicators = await Promise.all(
                targets.map(async (src, si) => {
                    const replicator = await this.replicatorProvider(
                        src,
                        targets.filter((tgt, ti) => ti != si),
                        config.syncPeriod,
                        config.tableSet,
                    );
                    if (config.replicationLogDir) {
                        replicator.enableLogs(path.join(config.replicationLogDir, src.name.replace("/", "-")));
                    }
                    replicator.disableTransactions(!!config.disableTransactions);
                    replicator.showProgressbar(!!args.verbose);
                    return replicator;
                }),
            );
            console.log(`Set up ${replicators.length} replicators. Starting initial round.`);
            for (let repl of replicators) {
                await repl.synchronize(!args.soft_start);
            }

            console.log("Scheduling regular replication");
            let syncRunning = false;
            let requestExit = false;
            process.once("SIGINT", () => {
                /* Note: if this method of gracefully shutting down does not work, e.g. the ongoing synchronization
                 *       takes too long to complete before the OS decides to SIGTERM us, we might end up with an inconsistent
                 *       state in a target database (if no transactions were used because of too much data). However, after the
                 *       next round of db-sync things should be consistent again.
                 *       Most of the time though, since we're running in transactions, upon an ungraceful shutdown the target DB
                 *       state will be consistent.
                 */
                if (syncRunning) {
                    console.info("SIGINT received ... sync is currently running. Waiting for round to complete.");
                    requestExit = true;
                } else {
                    console.info("SIGINT received ... exiting.");
                    process.exit(0);
                }
            });
            return new Promise<void>((resolve, reject) => {
                setInterval(async () => {
                    if (syncRunning) {
                        console.log("Replication is already running ... skipping this time");
                        return;
                    }

                    console.log("Starting round robin replication");
                    try {
                        syncRunning = true;
                        for (let repl of replicators) {
                            await repl.synchronize(false);

                            if (requestExit) {
                                console.info("Shut down was requested ... ending replication.");
                                process.exit(0);
                            }
                        }
                        syncRunning = false;
                    } catch (err) {
                        console.error("Error during replication. Existing", err);
                        reject(err);
                    }
                }, config.syncPeriod);
            });
        } else {
            if (!config.source) {
                throw new Error("Running in single-source mode requires a source!");
            }
            const source = await connect(config.source);
            const targets = await Promise.all(config.targets.map((t) => connect(t)));
            const replicator = await this.replicatorProvider(source, targets, config.syncPeriod, config.tableSet);
            replicator.showProgressbar(!!args.verbose);
            await replicator.start(!args.soft_start);
        }
    }
}

@injectable()
export class ExportCommand implements ICommand {
    name = "export";
    help = "Exports an SQL file containing the sync operations";

    @inject(TableUpdateProvider)
    protected readonly tableUpdateProvider: TableUpdateProvider;

    addOptions(parser: ArgumentParser): void {
        parser.add_argument("--table-set");
    }

    async run(args: any): Promise<void> {
        console.log("Selecting data in range: ", args.start_date || "<OPEN>", args.end_date || "<OPEN>");
        const conn = await connect(new Config().mysqlConfig);

        const statements = await this.tableUpdateProvider.getAllStatementsForAllTables(
            conn,
            args.table_set,
            args.start_date,
            args.end_date,
        );
        await new Promise<void>((resolve, reject) => {
            writeFile("export.sql", [...statements.deletions, ...statements.updates].join("\n"), (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        console.warn(
            "Make sure you set your connection timezone to UTC when importing this file. Otherwise times will wrong and data will become inconsistent.",
        );
    }
}

export interface ResyncCommandArgs {
    table: string;
    table_set: string;
    start_date?: number;
    end_date?: number;
    batch_size?: string;
    interval?: string;
}

@injectable()
export class BumpTimeColumnCommand implements ICommand {
    name = "bump-time-column";
    help = "Bumps the timeColumn for the rows of the selected table, which in turn triggers a re-sync of the data.";

    @multiInject(TableDescriptionProvider)
    protected readonly descriptionProvider: TableDescriptionProvider[];

    addOptions(parser: ArgumentParser): void {
        parser.add_argument("--table");
        parser.add_argument("--table-set");
        parser.add_argument("--batch-size");
        parser.add_argument("--interval");
    }

    async run(args: ResyncCommandArgs): Promise<void> {
        if (!args.table || !args.table_set) {
            throw new Error(`Missing --table-set and/or --table!`);
        }
        const tableSet = args.table_set;
        const tableName = args.table;
        const batchSize = args.batch_size ? Number.parseInt(args.batch_size, 10) : 1000;
        const interval = args.interval ? Number.parseInt(args.interval, 10) : 30;

        if (!args.end_date) {
            throw new Error(`--end-date is required!`);
        }
        const period: SyncPeriod = {
            from: args.start_date ? new Date(args.start_date) : undefined,
            to: new Date(args.end_date),
        };

        const provider = tableSet
            ? this.descriptionProvider.find((v) => v.name == tableSet)
            : this.descriptionProvider[0];
        if (!provider) {
            throw new Error(`Unknown table set ${tableSet} or no table description providers registered`);
        }

        const table = provider.getSortedTables().find((t) => t.name === tableName);
        if (!table) {
            throw new Error(`Unknown table ${tableName}`);
        }

        console.log(
            `Start bumping column "${table.timeColumn}" of table "${table.name}" in period ${SyncPeriod.toString(
                period,
            )}...`,
        );
        const conn = await connect(new Config().mysqlConfig);

        let lastSyncAmount = batchSize;
        while (true) {
            lastSyncAmount = await this.bumpTimeBatch(conn, table, period, batchSize);
            console.log(`Bumped ${lastSyncAmount} rows...`);
            if (lastSyncAmount !== batchSize) {
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        }

        console.log(
            `Done bumping column "${table.timeColumn}" of table "${table.name}" in period ${SyncPeriod.toString(
                period,
            )}.`,
        );
    }

    protected async bumpTimeBatch(
        conn: NamedConnection,
        table: TableDescription,
        period: SyncPeriod,
        batchSize: number,
    ): Promise<number> {
        let lowerBound = "";
        if (period.from) {
            lowerBound = ` AND \`${table.timeColumn}\` >= ? `;
        }
        const q = `UPDATE \`${table.name}\` SET \`${table.timeColumn}\` = CURRENT_TIMESTAMP(6) WHERE \`${table.timeColumn}\` < ? ${lowerBound} ORDER BY \`${table.timeColumn}\` ASC LIMIT ${batchSize}`;
        const result = (await query(conn, q, { values: [period.to, period.from] })) as { affectedRows: number };
        return result.affectedRows;
    }
}
