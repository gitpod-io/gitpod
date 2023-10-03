/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test, timeout } from "@testdeck/mocha";

import { testContainer } from "./test-container";
import { TypeORMBlockedRepositoryDBImpl } from "./typeorm/blocked-repository-db-impl";
import { TypeORM } from "./typeorm/typeorm";
import { resetDB } from "./test/reset-db";

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
    public async canCreateABlockedRepository() {
        const blockedRepository = await this.blockedRepositoryDb.createBlockedRepository(
            "github.com/bob/some-repo",
            true,
        );
        expect(blockedRepository.urlRegexp).eq("github.com/bob/some-repo");
        expect(blockedRepository.blockUser).eq(true);
    }

    @test(timeout(10000))
    public async checkRepositoryIsBlocked() {
        await this.blockedRepositoryDb.createBlockedRepository("github.com/bob/.*", true);

        const blockedRepository = await this.blockedRepositoryDb.findBlockedRepositoryByURL("github.com/bob/some-repo");

        expect(blockedRepository).not.undefined;
        expect(blockedRepository?.urlRegexp).to.eq("github.com/bob/.*");
        expect(blockedRepository?.blockUser).to.eq(true);
    }

    @test(timeout(10000))
    public async checkRepositoryIsNotBlocked() {
        await this.blockedRepositoryDb.createBlockedRepository("github.com/bob/.*", true);

        const blockedRepository = await this.blockedRepositoryDb.findBlockedRepositoryByURL(
            "github.com/alice/some-repo",
        );

        expect(blockedRepository).undefined;
    }

    @test(timeout(10000))
    public async canFindAllRepositoriesWithoutSearchTerm() {
        await this.blockedRepositoryDb.createBlockedRepository("github.com/bob/.*", true);
        await this.blockedRepositoryDb.createBlockedRepository("github.com/alice/.*", true);

        const blockedRepositories = await this.blockedRepositoryDb.findAllBlockedRepositories(0, 1, "id", "ASC");

        expect(blockedRepositories.total).eq(2);
    }

    @test(timeout(10000))
    public async canFindAllRepositoriesWithSearchTerm() {
        await this.blockedRepositoryDb.createBlockedRepository("github.com/bob/.*", true);
        await this.blockedRepositoryDb.createBlockedRepository("github.com/alice/.*", true);

        const blockedRepositories = await this.blockedRepositoryDb.findAllBlockedRepositories(0, 1, "id", "ASC", "bob");

        expect(blockedRepositories.total).eq(1);
    }

    async wipeRepo() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    }
}

module.exports = new BlockedRepositoryDBSpec();
