/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB, TypeORM, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import * as chai from "chai";
import { Container, ContainerModule } from "inversify";
import { RedlockAbortSignal } from "redlock";
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";
import { RedisMutex } from "../redis/mutex";
import { StripeService } from "../user/stripe-service";
import { OrgOnlyMigrationJob } from "./org-only-migration-job";
import { dbContainerModule } from "@gitpod/gitpod-db/lib/container-module";
import { v4 as uuidv4 } from "uuid";
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
export const testContainer = new Container();
testContainer.load(dbContainerModule());
testContainer.load(
    new ContainerModule((bind) => {
        bind(StripeService).toConstantValue(mockedStripe);
        bind(OrgOnlyMigrationJob).toSelf().inSingletonScope();
        bind(UserToTeamMigrationService).toSelf().inSingletonScope();
        bind(RedisMutex).toConstantValue(new TestingRedisMutex());
    }),
);

describe("Migration Job", () => {
    const typeORM = testContainer.get<TypeORM>(TypeORM);
    const migrationJob = testContainer.get<OrgOnlyMigrationJob>(OrgOnlyMigrationJob);
    const workspaceDB = testContainer.get<WorkspaceDB>(WorkspaceDB);
    const userDB = testContainer.get<UserDB>(UserDB);
    const teamDB = testContainer.get<TeamDB>(TeamDB);

    it("should migrate non migrated workspaces", async () => {
        const user = await userDB.newUser();
        const org = await teamDB.createTeam(user.id, "test");
        const ws = await workspaceDB.store({
            id: uuidv4(),
            ownerId: user.id,
            config: {},
            creationTime: "2021-01-01",
            type: "regular",
            contextURL: "",
            context: {
                title: "",
            },
            description: "",
        });

        const workspaces = await migrationJob.migrateWorkspaces(1000);

        expect(
            workspaces.some((w) => w.organizationId === org.id && w.id === ws.id),
            "should migrate non migrated workspace",
        ).to.be.true;

        const c = await typeORM.getConnection();
        await c.query("DELETE FROM d_b_user WHERE id in (?)", [[user.id]]);
        await c.query("DELETE FROM d_b_team WHERE id in (?)", [[org.id]]);
        await c.query("DELETE FROM d_b_workspace WHERE id in (?)", [[ws.id]]);
    });
});
