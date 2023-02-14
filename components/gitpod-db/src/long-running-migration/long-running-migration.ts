/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable, multiInject } from "inversify";
import { DBLongRunningMigration } from "../typeorm/entity/db-long-running-migration";
import { Synchronizer } from "../typeorm/synchronizer";
import { TypeORM } from "../typeorm/typeorm";

export const LongRunningMigration = Symbol("LongRunningMigration");
export interface LongRunningMigration {
    /**
     * The name of the migration. This is used to store the completion state in the database.
     * Changing the name will cause the migration to be run again.
     */
    getName(): string;

    /**
     * Returns true if the migration has completed.
     */
    runMigrationBatch(): Promise<boolean>;
}

/**
 * This service runs all registered long running migrations in batches until they are completed.
 * It stores the completion state in the database.
 */
@injectable()
export class LongRunningMigrationService {
    public constructor(
        @inject(TypeORM) private typeorm: TypeORM,
        @inject(Synchronizer) private distributedLock: Synchronizer,
        @multiInject(LongRunningMigration) private migrations: LongRunningMigration[],
    ) {}

    /**
     * Runs a batch for all registered long running migration.
     *
     * @returns true if all migrations are completed.
     */
    async runMigrationBatch(): Promise<boolean> {
        const now = new Date();
        try {
            log.info(`Running long running migrations ...`);
            return this.distributedLock.synchronized(
                "long-running-migration",
                "LongRunningMigrationService",
                async () => {
                    const conn = await this.typeorm.getConnection();
                    const repo = conn.getRepository(DBLongRunningMigration);
                    let allCompleted = true;
                    for (const migration of this.migrations) {
                        let migrationMetaData = await repo.findOne({ name: migration.getName() });
                        if (!migrationMetaData) {
                            migrationMetaData = await repo.save({
                                name: migration.getName(),
                                firstRun: new Date(),
                                lastRun: new Date(),
                                completed: false,
                            });
                        }
                        if (migrationMetaData.completed) {
                            log.info(`Skipping completed migration '${migration.getName()}'`);
                            continue;
                        }
                        log.info(`Running migration '${migration.getName()}' ...`);
                        const now = new Date();
                        try {
                            const completed = await migration.runMigrationBatch();
                            log.info(`Finished batch for migration ${migration.getName()}`, {
                                duration: new Date().getTime() - now.getTime(),
                                completed,
                            });
                            migrationMetaData.completed = completed;
                        } catch (e) {
                            log.error(`Running batch for migration ${migration.getName()} failed`, e);
                        }
                        allCompleted = allCompleted && migrationMetaData.completed;
                        migrationMetaData.lastRun = new Date();
                        await repo.save(migrationMetaData);
                    }
                    return allCompleted;
                },
            );
        } finally {
            log.info(`Running long running migrations ... done`, { duration: new Date().getTime() - now.getTime() });
        }
    }
}
