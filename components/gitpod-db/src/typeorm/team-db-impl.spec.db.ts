/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout } from "mocha-typescript";
import { testContainer } from "../test-container";
import { UserDB } from "../user-db";
import { TypeORM } from "./typeorm";
import { DBUser } from "./entity/db-user";
import * as chai from "chai";
import { TeamDB } from "../team-db";
import { DBTeam } from "./entity/db-team";
const expect = chai.expect;

@suite(timeout(10000))
export class TeamDBSpec {
    private readonly teamDB = testContainer.get<TeamDB>(TeamDB);
    private readonly userDB = testContainer.get<UserDB>(UserDB);

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
        await manager.getRepository(DBUser).delete({});
    }

    @test()
    async testPersistAndUpdate(): Promise<void> {
        const user = await this.userDB.newUser();
        let team = await this.teamDB.createTeam(user.id, "Test Team");
        team.name = "Test Team 2";
        team = await this.teamDB.updateTeam(team.id, team);
        expect(team.name).to.be.eq("Test Team 2");
    }
}
