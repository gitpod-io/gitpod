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
        return this.distributedLock.synchronized("long-running-migration", "LongRunningMigrationService", async () => {
            const repo = (await this.typeorm.getConnection()).getRepository(DBLongRunningMigration);
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
                    continue;
                }
                log.info(`Running long running migration '${migration.getName()}' ...`);
                const now = new Date();
                try {
                    const completed = await migration.runMigrationBatch();
                    log.info(
                        `Long running migration ${migration.getName()} took ${new Date().getTime() - now.getTime()}ms`,
                        { completed },
                    );
                    migrationMetaData.completed = completed;
                } catch (e) {
                    log.error(`Long running migration ${migration.getName()} failed`, e);
                }
                allCompleted = allCompleted && migrationMetaData.completed;
                migrationMetaData.lastRun = new Date();
                await repo.save(migrationMetaData);
            }
            return allCompleted;
        });
    }
}
