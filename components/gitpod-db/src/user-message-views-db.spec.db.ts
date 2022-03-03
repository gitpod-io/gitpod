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
import { DBUserMessageViewEntry } from './typeorm/entity/db-user-message-view-entry';
import { Repository } from 'typeorm';
import { UserMessageViewsDB } from './user-message-views-db';

@suite
class UserMessageViewsDBSpec {
    typeORM = testContainer.get<TypeORM>(TypeORM);
    viewsdb = testContainer.get<UserMessageViewsDB>(UserMessageViewsDB);

    protected async getUserMessageViewsRepo(): Promise<Repository<DBUserMessageViewEntry>> {
        return (await (await this.typeORM.getConnection()).manager).getRepository(DBUserMessageViewEntry);
    }

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        const repo = await this.getUserMessageViewsRepo();
        await repo.createQueryBuilder('view').delete().execute();
    }

    @test(timeout(10000))
    public async testSimple11() {
        const viewed = await this.viewsdb.didViewMessage('user1', 'message1');
        expect(viewed).to.be.false;
    }

    @test(timeout(10000))
    public async testSimple2() {
        await this.viewsdb.markAsViewed('user1', ['message1']);
        const viewed = await this.viewsdb.didViewMessage('user1', 'message1');
        expect(viewed).to.be.true;
    }
}

module.exports = new UserMessageViewsDBSpec();
