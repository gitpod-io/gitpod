/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test, timeout } from "@testdeck/mocha";
import { v4 as uuidv4 } from "uuid";

import { testContainer } from "./test-container";
import { TeamDBImpl } from "./typeorm/team-db-impl";
import { TypeORMUserDBImpl } from "./typeorm/user-db-impl";
import { TypeORM } from "./typeorm/typeorm";
import { Connection } from "typeorm";
import { resetDB } from "./test/reset-db";

@suite
class TeamDBSpec {
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
        await resetDB(typeorm);
    }

    @test(timeout(10000))
    public async createAndFindATeam() {
        const user = await this.userDb.newUser();
        let dbResult = await this.db.findTeamsByUser(user.id);
        expect(dbResult.length).to.eq(0);
        await this.db.createTeam(user.id, "Ground Control");
        dbResult = await this.db.findTeamsByUser(user.id);
        expect(dbResult.length).to.eq(1);
        expect(dbResult[0].name).to.eq("Ground Control");
    }

    @test(timeout(10000))
    public async findTeamMembers() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "1234",
            authName: "Major Tom",
            primaryEmail: "tom@example.com",
        });
        await this.userDb.storeUser(user);
        const team = await this.db.createTeam(user.id, "Flight Crew");
        const members = await this.db.findMembersByTeam(team.id);
        expect(members.length).to.eq(1);
        expect(members[0].userId).to.eq(user.id);
    }

    @test(timeout(15000))
    public async findTeamWhenUserIsSoleOwner() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "2345",
            authName: "Nana",
            primaryEmail: "nana@example.com",
        });
        await this.userDb.storeUser(user);

        const ownTeam = await this.db.createTeam(user.id, "My Own Team");

        const teams = await this.db.findTeamsByUserAsSoleOwner(user.id);

        expect(teams.length).to.eq(1);
        expect(teams[0].id).to.eq(ownTeam.id);
    }

    @test(timeout(10000))
    public async findTeamWhenUserIsSoleOwnerWithMembers() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "2345",
            authName: "Nana",
            primaryEmail: "nana@example.com",
        });
        await this.userDb.storeUser(user);
        const user2 = await this.userDb.newUser();
        user2.identities.push({
            authProviderId: "GitLab",
            authId: "4567",
            authName: "Dudu",
            primaryEmail: "dudu@example.com",
        });
        await this.userDb.storeUser(user2);

        const ownTeam = await this.db.createTeam(user.id, "My Own Team With Members");
        await this.db.addMemberToTeam(user2.id, ownTeam.id);
        const teams = await this.db.findTeamsByUserAsSoleOwner(user.id);

        expect(teams.length).to.eq(1);
        expect(teams[0].id).to.eq(ownTeam.id);
    }

    @test(timeout(10000))
    public async findNoTeamWhenCoOwned() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "2345",
            authName: "Nana",
            primaryEmail: "nana@example.com",
        });
        await this.userDb.storeUser(user);
        const user2 = await this.userDb.newUser();
        user2.identities.push({
            authProviderId: "GitLab",
            authId: "4567",
            authName: "Dudu",
            primaryEmail: "dudu@example.com",
        });
        await this.userDb.storeUser(user2);

        const jointTeam = await this.db.createTeam(user.id, "Joint Team");
        await this.db.addMemberToTeam(user2.id, jointTeam.id);
        await this.db.setTeamMemberRole(user2.id, jointTeam.id, "owner");

        const teams = await this.db.findTeamsByUserAsSoleOwner(user.id);

        expect(teams.length).to.eq(0);
    }

    @test(timeout(10000))
    public async findTeams() {
        const user = await this.userDb.newUser();
        const t1 = await this.db.createTeam(user.id, "First Team");
        await this.db.createTeam(user.id, "Second Team");

        let searchTerm = "first";
        let result = await this.db.findTeams(0, 10, "creationTime", "DESC", searchTerm);
        expect(result.rows.length).to.eq(1);

        searchTerm = "team";
        result = await this.db.findTeams(0, 10, "creationTime", "DESC", searchTerm);
        expect(result.rows.length).to.eq(2);

        await this.db.deleteTeam(t1.id);
        result = await this.db.findTeams(0, 10, "creationTime", "DESC", searchTerm);
        expect(result.rows.length).to.eq(1);
    }

    @test(timeout(10000))
    public async test_hasActiveSSO() {
        expect((await this.db.findTeams(0, 1, "creationTime", "ASC")).total, "case 1: empty db").to.be.eq(0);

        const user = await this.userDb.newUser();
        const org = await this.db.createTeam(user.id, "Some Org");
        await this.db.createTeam(user.id, "Another Org");
        expect(await this.db.hasActiveSSO(org.id), "case 2: org without sso").to.be.false;

        const id = uuidv4();
        await this.exec(async (c) => {
            await c.query(
                "INSERT INTO d_b_oidc_client_config (id, issuer, organizationId, data, active) VALUES (?,?,?,?,?)",
                [id, "https://issuer.local", org.id, "{}", 0],
            );
        });
        expect(await this.db.hasActiveSSO(org.id), "case 3: org with inactive sso").to.be.false;

        await this.exec(async (c) => {
            await c.query("UPDATE d_b_oidc_client_config set active = ? where id = ?", [1, id]);
        });
        expect(await this.db.hasActiveSSO(org.id), "case 4: org with active sso").to.be.true;

        await this.db.deleteTeam(org.id);
        expect(await this.db.hasActiveSSO(org.id), "case 5: deleted org").to.be.false;
    }

    protected async exec(queryFn: (connection: Connection) => Promise<void>) {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const connection = await typeorm.getConnection();
        await queryFn(connection);
    }
}

module.exports = new TeamDBSpec();
