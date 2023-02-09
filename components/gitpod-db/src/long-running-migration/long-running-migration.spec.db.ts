/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { testContainer } from "../test-container";
import { Synchronizer } from "../typeorm/synchronizer";
import { TypeORM } from "../typeorm/typeorm";
import { LongRunningMigration, LongRunningMigrationService } from "./long-running-migration";
const expect = chai.expect;

class MultiBatchesMigration implements LongRunningMigration {
    constructor(public readonly name: string, public batches: number) {}

    public getName(): string {
        return this.name;
    }

    public async runMigrationBatch(): Promise<boolean> {
        return --this.batches <= 0;
    }
}

describe("long running migration service", () => {
    const typeORM = testContainer.get<TypeORM>(TypeORM);

    const wipeRepo = async () => {
        const conn = await typeORM.getConnection();
        await conn.query("DELETE FROM d_b_long_running_migration");
    };

    it("should migrate until completed", async () => {
        await wipeRepo();
        const threeBatches = new MultiBatchesMigration("threeBatches", 3);
        const migrationService = new LongRunningMigrationService(
            testContainer.get<TypeORM>(TypeORM),
            testContainer.get<Synchronizer>(Synchronizer),
            [threeBatches],
        );

        expect(await migrationService.runMigrationBatch(), "run #1").to.be.false;
        expect(await migrationService.runMigrationBatch(), "run #2").to.be.false;
        expect(await migrationService.runMigrationBatch(), "run #3").to.be.true;
        expect(threeBatches.batches).to.equal(0);
    });

    it("should migrate until all are completed", async () => {
        await wipeRepo();
        const threeBatches = new MultiBatchesMigration("threeBatches", 3);
        const runsOnce = new MultiBatchesMigration("runsOnce", 1);
        const migrationService = new LongRunningMigrationService(
            testContainer.get<TypeORM>(TypeORM),
            testContainer.get<Synchronizer>(Synchronizer),
            [threeBatches, runsOnce],
        );

        expect(await migrationService.runMigrationBatch(), "run #1").to.be.false;
        expect(await migrationService.runMigrationBatch(), "run #2").to.be.false;
        expect(await migrationService.runMigrationBatch(), "run #3").to.be.true;
        expect(runsOnce.batches).to.equal(0);
        expect(threeBatches.batches).to.equal(0);
    });
});
