/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test, timeout } from "mocha-typescript";

import { testContainer } from "./test-container";
import { TypeORMBlockedRepositoryDBImpl } from "./typeorm/blocked-repository-db-impl";
import { TypeORM } from "./typeorm/typeorm";
import { DBBlockedRepository } from "./typeorm/entity/db-blocked-repository";

@suite
class BlockedRepositoryDBSpec {
    blockedRepositoryDb = testContainer.get<TypeORMBlockedRepositoryDBImpl>(TypeORMBlockedRepositoryDBImpl);

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    @test(timeout(10000))
    public async checkRepositoryIsBlocked() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const manager = await typeorm.getConnection();
        manager.getRepository(DBBlockedRepository).insert({
            urlRegexp: "github.com/bob/.*",
            blockUser: true,
            deleted: false,
        });

        const blockedRepository = await this.blockedRepositoryDb.findBlockedRepositoryByURL("github.com/bob/some-repo");

        expect(blockedRepository).not.undefined;
        expect(blockedRepository?.urlRegexp).to.eq("github.com/bob/.*");
        expect(blockedRepository?.blockUser).to.eq(true);
    }

    @test(timeout(10000))
    public async checkRepositoryIsNotBlocked() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const manager = await typeorm.getConnection();
        manager.getRepository(DBBlockedRepository).insert({
            urlRegexp: "github.com/bob/.*",
            blockUser: true,
            deleted: false,
        });

        const blockedRepository = await this.blockedRepositoryDb.findBlockedRepositoryByURL(
            "github.com/alice/some-repo",
        );

        expect(blockedRepository).undefined;
    }

    async wipeRepo() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const manager = await typeorm.getConnection();
        await manager.getRepository(DBBlockedRepository).delete({});
    }
}

module.exports = new BlockedRepositoryDBSpec();
