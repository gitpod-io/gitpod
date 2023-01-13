/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { testContainer } from "./test-container";
import { TypeORM } from "./typeorm/typeorm";
import { UserToTeamMigrationService } from "./user-to-team-migration-service";
import { UserDB } from "./user-db";
import { TeamDB } from "./team-db";
import { ProjectDB } from "./project-db";
import { v4 as uuidv4 } from "uuid";
import { WorkspaceDB } from "./workspace-db";
const expect = chai.expect;

describe("Migration Service", () => {
    const typeORM = testContainer.get<TypeORM>(TypeORM);
    const migrationService = testContainer.get<UserToTeamMigrationService>(UserToTeamMigrationService);
    const userDB = testContainer.get<UserDB>(UserDB);
    const teamDB = testContainer.get<TeamDB>(TeamDB);
    const projectDB = testContainer.get<ProjectDB>(ProjectDB);
    const workspaceDB = testContainer.get<WorkspaceDB>(WorkspaceDB);

    const wipeRepo = async () => {
        const conn = await typeORM.getConnection();
        await conn.query("DELETE FROM d_b_user");
        await conn.query("DELETE FROM d_b_project");
        await conn.query("DELETE FROM d_b_team");
        await conn.query("DELETE FROM d_b_stripe_customer");
        await conn.query("DELETE FROM d_b_workspace_instance");
        await conn.query("DELETE FROM d_b_usage");
        await conn.query("DELETE FROM d_b_cost_center");
    };

    it("should create a team of one", async () => {
        await wipeRepo();
        const user = await userDB.newUser();
        await projectDB.storeProject({
            id: uuidv4(),
            appInstallationId: "test",
            cloneUrl: "test",
            name: "test",
            creationTime: new Date().toISOString(),
            slug: "test",
            userId: user.id,
        });

        await migrationService.migrateUser(user);
        let teams = await teamDB.findTeamsByUser(user.id);
        expect(teams.length, "rerunning the migration should not create a new team.").to.be.eq(1);

        const userProjects = await projectDB.findUserProjects(user.id);
        expect(userProjects.length, "personal projects should be migrated to the new team.").to.be.eq(0);

        await teamDB.removeMemberFromTeam(user.id, teams[0].id);
        expect(await migrationService.needsMigration(user), "migrated user withoiut team needs migration").to.be.true;
        await migrationService.migrateUser(user);
        teams = await teamDB.findTeamsByUser(user.id);
        expect(teams.length, "rerunning the migration should not create a new team.").to.be.eq(1);
    });

    it("should migrate all usage", async () => {
        await wipeRepo();
        const user = await userDB.newUser();
        const attrId = "user:" + user.id;
        const conn = await typeORM.getConnection();
        const wsiId = uuidv4();
        await workspaceDB.storeInstance({
            id: wsiId,
            creationTime: new Date().toISOString(),
            usageAttributionId: attrId,
            region: "eu-west-1",
            ideUrl: "https://ide.eu-west-1.aws.com",
            workspaceImage: "test",
            status: {
                conditions: {},
                phase: "stopped",
            },
            workspaceId: uuidv4(),
        });
        await conn.query(
            "INSERT INTO d_b_usage (id, attributionId, description, creditCents, effectiveTime, kind, workspaceInstanceId, draft) VALUES (?,?,?,?,?,?,?,?)",
            [uuidv4(), attrId, "test", 2000, new Date().toISOString(), "workspaceinstance", wsiId, false],
        );
        await conn.query(
            "INSERT INTO d_b_cost_center (id, creationTime, spendingLimit, billingStrategy, billingCycleStart, nextBillingTime) VALUES (?,?,?,?,?,?)",
            [attrId, new Date().toISOString(), 100000, "other", new Date().toISOString(), new Date().toISOString()],
        );
        await conn.query(
            "INSERT INTO d_b_stripe_customer (stripeCustomerId, attributionId, creationTime) VALUES (?,?,?)",
            ["foo-stripe-id", attrId, new Date().toISOString()],
        );
        await migrationService.migrateUser(user);
        let teams = await teamDB.findTeamsByUser(user.id);
        const newAttrId = "team:" + teams[0].id;
        expect(
            (await conn.query("SELECT * FROM d_b_workspace_instance WHERE usageAttributionId = ?", [newAttrId])).length,
        ).be.eq(1);
        expect((await conn.query("SELECT * FROM d_b_usage WHERE attributionId = ?", [newAttrId])).length).be.eq(1);
        expect((await conn.query("SELECT * FROM d_b_cost_center WHERE id = ?", [newAttrId])).length).be.eq(1);
        expect(
            (await conn.query("SELECT * FROM d_b_stripe_customer WHERE attributionId = ?", [newAttrId])).length,
        ).be.eq(1);
    });
});
