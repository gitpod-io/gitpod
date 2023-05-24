/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test, timeout } from "mocha-typescript";
import { testContainer } from "../test-container";
import { TypeORM } from "../typeorm/typeorm";
import { JobStateDbImpl } from "./job-state-db-impl";
import { DBJobState } from "./entity/db-job-state";
const expect = chai.expect;

@suite
@timeout(5000)
export class JobStateDBSpec {
    typeORM = testContainer.get<TypeORM>(TypeORM);
    db = testContainer.get<JobStateDbImpl>(JobStateDbImpl);

    async before() {
        await this.clear();
    }

    async after() {
        await this.clear();
    }

    protected async clear() {
        const connection = await this.typeORM.getConnection();
        const manager = connection.manager;
        await manager.clear(DBJobState);
    }

    @test public async testStoreAndRetrieve() {
        await this.db.setState("jobName", { foo: "bar" });
        let data = await this.db.getState("jobName");
        expect((data?.state as any).foo, "should be bar").to.be.equal("bar");

        // try update
        await this.db.setState("jobName", { test: "bar" });
        data = await this.db.getState("jobName");
        expect((data?.state as any).test, "should be bar").to.be.equal("bar");
    }
}

module.exports = JobStateDBSpec;
