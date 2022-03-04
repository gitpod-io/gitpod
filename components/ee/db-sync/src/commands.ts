/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ArgumentParser } from "argparse";
import { TableUpdateProvider } from "./export";
import { writeFile, readFileSync } from "fs";
import { ReplicationConfig } from "./config";
import { PeriodicReplicatorProvider } from "./replication";
import { connect } from "./database";
import { injectable, inject } from "inversify";
import { Config } from "@gitpod/gitpod-db/lib/config";
import * as path from 'path';

export const ICommand = Symbol('ICommand');

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
            nargs: '?'
        });
    }

    async run(args: any): Promise<void> {
        const config = JSON.parse(readFileSync(args.config).toString()) as ReplicationConfig;

        if(config.roundRobin) {
            if(config.source) {
                console.warn("Running in round robin mode. Ignoring source connection configuration!");
            }

            const targets = await Promise.all(config.targets.map(t => connect(t)));
            const replicators = await Promise.all(
                targets.map(async (src, si) => {
                        const replicator = await this.replicatorProvider(src, targets.filter((tgt, ti) => ti != si), config.syncPeriod, config.tableSet);
                        if (config.replicationLogDir) {
                            replicator.enableLogs(path.join(config.replicationLogDir, src.name.replace('/', '-')));
                        }
                        replicator.disableTransactions(!!config.disableTransactions);
                        replicator.showProgressbar(!!args.verbose);
                        return replicator;
                    }
                )
            );
            console.log(`Set up ${replicators.length} replicators. Starting initial round.`);
            for(let repl of replicators) {
                await repl.synchronize(!args.soft_start);
            }

            console.log("Scheduling regular replication");
            let syncRunning = false;
            let requestExit = false;
            process.once('SIGINT', () => {
                /* Note: if this method of gracefully shutting down does not work, e.g. the ongoing synchronization
                 *       takes too long to complete before the OS decides to SIGTERM us, we might end up with an inconsistent
                 *       state in a target database (if no transactions were used because of too much data). However, after the
                 *       next round of db-sync things should be consistent again.
                 *       Most of the time though, since we're running in transactions, upon an ungraceful shutdown the target DB
                 *       state will be consistent.
                 */
                if (syncRunning) {
                    console.info('SIGINT received ... sync is currently running. Waiting for round to complete.');
                    requestExit = true;
                } else {
                    console.info('SIGINT received ... exiting.');
                    process.exit(0);
                }
            });
            return new Promise<void>((resolve, reject) => {
                setInterval(async () => {
                    if(syncRunning) {
                        console.log("Replication is already running ... skipping this time");
                        return;
                    }

                    console.log("Starting round robin replication");
                    try {
                        syncRunning = true;
                        for(let repl of replicators) {
                            await repl.synchronize(false);

                            if (requestExit) {
                                console.info('Shut down was requested ... ending replication.')
                                process.exit(0);
                            }
                        }
                        syncRunning = false;
                    } catch(err) {
                        console.error("Error during replication. Existing", err);
                        reject(err);
                    }
                }, config.syncPeriod);
            });
        } else {
            const source = await connect(config.source);
            const targets = await Promise.all(config.targets.map(t => connect(t)));
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

        const statements = await this.tableUpdateProvider.getAllStatementsForAllTables(conn, args.table_set, args.start_date, args.end_date);
        await new Promise<void>((resolve, reject) => {
            writeFile("export.sql", [...statements.deletions, ...statements.updates].join("\n"), (err) => {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        });
        console.warn("Make sure you set your connection timezone to UTC when importing this file. Otherwise times will wrong and data will become inconsistent.");
    }

}