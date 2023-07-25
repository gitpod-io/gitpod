/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout } from "@testdeck/mocha";
import { testContainer } from "../test-container";
import { TypeORM } from "./typeorm";
import * as chai from "chai";
import { OneTimeSecretDB } from "../one-time-secret-db";
import { DBOneTimeSecret } from "./entity/db-one-time-secret";
import { resetDB } from "../test/reset-db";
const expect = chai.expect;

@suite(timeout(10000))
export class OneTimeSecretSpec {
    private readonly otsDB = testContainer.get<OneTimeSecretDB>(OneTimeSecretDB);

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    }

    @test()
    async testPruneExpired(): Promise<void> {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        await this.otsDB.register("secret", yesterday);
        await this.otsDB.register("secret2", tomorrow);

        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const manager = await typeorm.getConnection();

        const beforePrune = await manager.getRepository(DBOneTimeSecret).count();
        expect(beforePrune).to.be.eq(2);

        await this.otsDB.pruneExpired();

        const afterPrune = await manager.getRepository(DBOneTimeSecret).count();
        expect(afterPrune).to.be.eq(1);
    }
}
