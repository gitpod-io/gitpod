/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { suite, test, timeout } from "@testdeck/mocha";
import * as chai from "chai";
import { TeamDB } from "../team-db";
import { testContainer } from "../test-container";
import { resetDB } from "../test/reset-db";
import { UserDB } from "../user-db";
import { TypeORM } from "./typeorm";
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
        await resetDB(typeorm);
    }

    @test()
    async testPersistAndUpdate(): Promise<void> {
        const user = await this.userDB.newUser();
        let team = await this.teamDB.createTeam(user.id, "Test Team");
        team.name = "Test Team 2";
        team = await this.teamDB.updateTeam(team.id, team);
        expect(team.name).to.be.eq("Test Team 2");
    }

    @test()
    async testBadNames(): Promise<void> {
        const user = await this.userDB.newUser();
        try {
            await this.teamDB.createTeam(user.id, "X");
            expect.fail("Team name too short");
        } catch (error) {
            if (error instanceof ApplicationError && error.code === ErrorCodes.BAD_REQUEST) {
                // expected ApplicationError of code BAD_REQUEST
            } else {
                expect.fail("Unexpected error: " + error);
            }
        }
        try {
            await this.teamDB.createTeam(
                user.id,
                "this is way too long for a team name, as we have a limit of 60 characters and this is 8 more than that. this is way too long for a team name, as we have a limit of 60 characters and this is 8 more than that",
            );
            expect.fail("Team name too long");
        } catch (error) {
            if (error instanceof ApplicationError && error.code === ErrorCodes.BAD_REQUEST) {
                // expected ApplicationError of code BAD_REQUEST
            } else {
                expect.fail("Unexpected error: " + error);
            }
        }
        const team = await this.teamDB.createTeam(user.id, "      I ♥ gitpod        ");
        expect(team.name).to.be.eq("I ♥ gitpod");
        expect(team.slug).to.be.eq("i-love-gitpod");
    }

    @test()
    async testSlugIsAutomated(): Promise<void> {
        const user = await this.userDB.newUser();

        const team1 = await this.teamDB.createTeam(user.id, "My Team");
        expect(team1.slug).to.be.eq("my-team");
        const team2 = await this.teamDB.createTeam(user.id, "My Other Team");
        expect(team2.slug).to.be.eq("my-other-team");
        team2.name = "My Team";
        const team3 = await this.teamDB.updateTeam(team2.id, team2);
        expect(team3.slug).to.match(/^my-team-[a-zA-Z0-9_-]{8}$/);
    }

    @test()
    async testNoSlugDuplicates(): Promise<void> {
        const user = await this.userDB.newUser();

        const team1 = await this.teamDB.createTeam(user.id, "My Team");
        expect(team1.slug).to.be.eq("my-team");
        const team2 = await this.teamDB.createTeam(user.id, "My Team");
        expect(team2.slug).to.match(/my-team-[a-f0-9]{4}/);
    }

    @test()
    async testNestedTransaction(): Promise<void> {
        const user = await this.userDB.newUser();

        const team1 = await this.teamDB.transaction(async (db) => {
            return await db.transaction(async (db) => {
                return await db.createTeam(user.id, "My Team");
            });
        });
        expect(team1.slug).to.be.eq("my-team");
    }
}
