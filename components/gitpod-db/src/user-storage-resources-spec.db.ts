/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
const expect = chai.expect;
import { suite, test, timeout } from 'mocha-typescript';

import { testContainer } from './test-container';
import { TypeORM } from './typeorm/typeorm';
import { Repository } from 'typeorm';
import { UserStorageResourcesDB } from './user-storage-resources-db';
import { DBUserStorageResource } from './typeorm/entity/db-user-storage-resource';

@suite
class UserStorageResourcesDBSpec {
    typeORM = testContainer.get<TypeORM>(TypeORM);
    resourcesDb = testContainer.get<UserStorageResourcesDB>(UserStorageResourcesDB);

    protected async getRepo(): Promise<Repository<DBUserStorageResource>> {
        return (await (await this.typeORM.getConnection()).manager).getRepository(DBUserStorageResource);
    }

    async after() {
        const repo = await this.getRepo();
        await repo.createQueryBuilder('resource').delete().execute();
    }

    @test(timeout(10000))
    public async testGetEmpty() {
        const content = await this.resourcesDb.get('user1', 'some://uri');
        expect(content).to.be.eq('');
    }

    @test(timeout(10000))
    public async testUpdate() {
        await this.resourcesDb.update('user1', 'some://uri', 'content');
        const content = await this.resourcesDb.get('user1', 'some://uri');
        expect(content).to.be.eq('content');
    }
}

module.exports = new UserStorageResourcesDBSpec();
