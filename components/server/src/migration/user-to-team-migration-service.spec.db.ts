/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { UserToTeamMigrationService } from "./user-to-team-migration-service";
import { v4 as uuidv4 } from "uuid";
import { ProjectDB, TeamDB, TypeORM, UserDB, WorkspaceDB, testContainer } from "@gitpod/gitpod-db/lib";
import { ContainerModule } from "inversify";
import { StripeService } from "../user/stripe-service";
import { RedisMutex } from "../redis/mutex";
import { RedlockAbortSignal } from "redlock";
const expect = chai.expect;

const mockedStripe = new StripeService();
mockedStripe.updateAttributionId = async (
    stripeCustomerId: string,
    attributionId: string,
    oldAttributionId: string,
) => {
    return true;
};
class TestingRedisMutex extends RedisMutex {
    public using<T>(
        resources: string[],
        duration: number,
        routine: (signal: RedlockAbortSignal) => Promise<T>,
    ): Promise<T> {
        return routine(undefined!);
    }
}
testContainer.load(
    new ContainerModule((bind) => {
        bind(StripeService).toConstantValue(mockedStripe);
        bind(UserToTeamMigrationService).toSelf().inSingletonScope();
        bind(RedisMutex).toConstantValue(new TestingRedisMutex());
    }),
);

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
        await conn.query("DELETE FROM d_b_workspace");
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
        ).be.eq(0);
    });

    it("should create a new free cost center when user doesn't have a team", async () => {
        await wipeRepo();
        const user = await userDB.newUser();
        const conn = await typeORM.getConnection();

        // first migration
        await migrationService.migrateUser(user);
        let teams = await teamDB.findTeamsByUser(user.id);
        expect(teams.length).to.be.eq(1);
        await teamDB.deleteTeam(teams[0].id);

        teams = await teamDB.findTeamsByUser(user.id);
        expect(teams.length).to.be.eq(0);

        // second migration after deleting the team
        await migrationService.migrateUser(user);
        teams = await teamDB.findTeamsByUser(user.id);
        expect(teams.length).to.be.eq(1);
        await teamDB.deleteTeam(teams[0].id);

        // verify that a new free cost center was created
        const newAttrId = "team:" + teams[0].id;
        expect(
            (await conn.query("SELECT * FROM d_b_cost_center WHERE id = ? AND spendingLimit = 500", [newAttrId]))
                .length,
        ).be.eq(1);
    });

    it("should not migrate the same user multiple times", async () => {
        await wipeRepo();
        const user = await userDB.newUser();

        // run multiple migration
        await Promise.all([
            migrationService.migrateUser(user),
            migrationService.migrateUser(user),
            migrationService.migrateUser(user),
        ]);
        const teams = await teamDB.findTeamsByUser(user.id);
        expect(teams.length, "not exactly one team: " + JSON.stringify(teams)).to.be.eq(1);
    });

    it("should append 'Organization' to too short names", async () => {
        await wipeRepo();
        const user = await userDB.newUser();
        user.fullName = "X";
        await userDB.storeUser(user);

        await migrationService.migrateUser(user);
        const teams = await teamDB.findTeamsByUser(user.id);
        expect(teams[0].name).to.be.eq("X Organization");
    });

    it("should update 'organizationId' for workspace without attributionId", async () => {
        await wipeRepo();
        const user = await userDB.newUser();
        await userDB.storeUser(user);

        const ws = await workspaceDB.store({
            id: uuidv4(),
            creationTime: new Date().toISOString(),
            ownerId: user.id,
            config: {},
            context: {
                title: "test",
            },
            contextURL: "https://gitpod.io",
            type: "regular",
            description: "test",
        });

        await workspaceDB.storeInstance({
            id: uuidv4(),
            creationTime: new Date().toISOString(),
            region: "eu-west-1",
            ideUrl: "https://ide.eu-west-1.aws.com",
            workspaceImage: "test",
            status: {
                conditions: {},
                phase: "stopped",
            },
            workspaceId: ws.id,
        });

        await migrationService.migrateUser(user);
        const wsAndI = await workspaceDB.findWorkspaceAndInstance(ws.id);
        const teams = await teamDB.findTeamsByUser(user.id);
        expect(wsAndI?.organizationId).to.be.eq(teams[0].id);
    });
});
