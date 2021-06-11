/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

 import * as chai from 'chai';
 const expect = chai.expect;
import { suite, test, timeout } from 'mocha-typescript';

import { testContainer } from './test-container';
import { TeamDBImpl } from './typeorm/team-db-impl';
import { TypeORMUserDBImpl } from './typeorm/user-db-impl';
import { TypeORM } from './typeorm/typeorm';
import { DBTeam } from './typeorm/entity/db-team';
import { DBTeamMembership } from './typeorm/entity/db-team-membership';
import { DBUser } from './typeorm/entity/db-user';
import { DBIdentity } from './typeorm/entity/db-identity';

@suite class TeamDBSpec {

    db = testContainer.get<TeamDBImpl>(TeamDBImpl);
    userDb = testContainer.get<TypeORMUserDBImpl>(TypeORMUserDBImpl);

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const manager = await typeorm.getConnection();
        await manager.getRepository(DBTeam).delete({});
        await manager.getRepository(DBTeamMembership).delete({});
        await manager.getRepository(DBUser).delete({});
        await manager.getRepository(DBIdentity).delete({});
    }

    @test(timeout(10000))
    public async createAndFindATeam() {
        const user = await this.userDb.newUser();
        let dbResult = await this.db.findTeamsByUser(user.id);
        expect(dbResult.length).to.eq(0);
        await this.db.createTeam(user.id, 'Ground Control');
        dbResult = await this.db.findTeamsByUser(user.id);
        expect(dbResult.length).to.eq(1);
        expect(dbResult[0].name).to.eq('Ground Control');
    }

    @test(timeout(10000))
    public async findTeamMembers() {
        const user = await this.userDb.newUser();
        user.identities.push({ authProviderId: 'GitHub', authId: '1234', authName: 'Major Tom', primaryEmail: 'tom@example.com' });
        await this.userDb.storeUser(user);
        const team = await this.db.createTeam(user.id, 'Flight Crew');
        const members = await this.db.findMembersByTeam(team.id);
        expect(members.length).to.eq(1);
        expect(members[0].userId).to.eq(user.id);
        expect(members[0].primaryEmail).to.eq('tom@example.com');
    }

}

module.exports = new TeamDBSpec()
