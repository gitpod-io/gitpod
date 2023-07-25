/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test, timeout } from "@testdeck/mocha";
import { testContainer } from "./test-container";
import { TypeORM } from "./typeorm/typeorm";
import { EmailDomainFilterDB } from "./email-domain-filter-db";
import { resetDB } from "./test/reset-db";
const expect = chai.expect;

@suite
@timeout(5000)
export class EmailDomainFilterDBSpec {
    typeORM = testContainer.get<TypeORM>(TypeORM);
    db = testContainer.get<EmailDomainFilterDB>(EmailDomainFilterDB);

    async before() {
        await this.clear();
    }

    async after() {
        await this.clear();
    }

    protected async clear() {
        await resetDB(this.typeORM);
    }

    @test public async filterSimple() {
        await this.db.storeFilterEntry({
            domain: "gitpod.io",
            negative: true,
        });

        const actual = await this.db.isBlocked("gitpod.io");
        expect(actual, "isBlocked").to.equal(true);
    }

    @test public async filterSimple_negative() {
        await this.db.storeFilterEntry({
            domain: "gitpod.io",
            negative: true,
        });

        const actual = await this.db.isBlocked("example.org");
        expect(actual, "isBlocked").to.equal(false);

        const actual2 = await this.db.isBlocked("sub.gitpod.io");
        expect(actual2, "isBlocked").to.equal(false);
    }

    @test public async filterSuffixMatch() {
        await this.db.storeFilterEntry({
            domain: "%.gitpod.io",
            negative: true,
        });

        const actual = await this.db.isBlocked("gitpod.io");
        expect(actual, "isBlocked").to.equal(false);

        const actual2 = await this.db.isBlocked("sub.gitpod.io");
        expect(actual2, "isBlocked").to.equal(true);

        const actual3 = await this.db.isBlocked("sub.gitpod.io.xyz");
        expect(actual3, "isBlocked").to.equal(false);
    }

    @test public async filterSimple_guard_against_blocking_everyone() {
        await this.db.storeFilterEntry({
            domain: "%",
            negative: true,
        });

        const actual = await this.db.isBlocked("example.org");
        expect(actual, "isBlocked").to.equal(false);

        const actual2 = await this.db.isBlocked("sub.gitpod.io");
        expect(actual2, "isBlocked").to.equal(false);
    }
}

module.exports = EmailDomainFilterDBSpec;
