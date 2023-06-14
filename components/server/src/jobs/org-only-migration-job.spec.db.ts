/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { AdditionalUserData } from "@gitpod/gitpod-protocol";
import * as chai from "chai";
import { Container, ContainerModule } from "inversify";
import { RedlockAbortSignal } from "redlock";
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";
import { RedisMutex } from "../redis/mutex";
import { StripeService } from "../user/stripe-service";
import { OrgOnlyMigrationJob } from "./org-only-migration-job";
import { dbContainerModule } from "@gitpod/gitpod-db/lib/container-module";
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
    const userDB = testContainer.get<UserDB>(UserDB);

    it("should migrate non migrated user", async () => {
        const migratedUser = await userDB.newUser();
        AdditionalUserData.set(migratedUser, { isMigratedToTeamOnlyAttribution: true });
        await userDB.storeUser(migratedUser);
        const nonMigratedUser = await userDB.newUser();
        AdditionalUserData.set(nonMigratedUser, { isMigratedToTeamOnlyAttribution: undefined });
        await userDB.storeUser(nonMigratedUser);

        const users = await migrationJob.migrateUsers(1000, "1900-01-01");

        expect(
            users.some((u) => u.id === nonMigratedUser.id),
            "should migrate non migrated user",
        ).to.be.true;
        expect(
            users.some((u) => u.id === migratedUser.id),
            "should not migrate already migrated user",
        ).to.be.false;
        expect(
            users.find((u) => u.id === nonMigratedUser.id)?.additionalData?.isMigratedToTeamOnlyAttribution,
            "user should be migrated",
        ).to.be.true;

        const c = await typeORM.getConnection();
        await c.query("DELETE FROM d_b_user WHERE id in (?)", [[migratedUser.id, nonMigratedUser.id]]);
    });

    it("should migrate in badges", async () => {
        const user1 = await userDB.newUser();
        user1.creationDate = "2021-01-01";
        await userDB.storeUser(user1);
        const user2 = await userDB.newUser();
        user2.creationDate = "2022-01-01";
        await userDB.storeUser(user2);

        let users = await migrationJob.migrateUsers(1, "1900-01-01");
        expect(users[0].id === user1.id, "should migrate the older user").to.be.true;
        users = await migrationJob.migrateUsers(1, users[0].creationDate);
        expect(users[0].id === user2.id, "should migrate the younger user next").to.be.true;

        const c = await typeORM.getConnection();
        await c.query("DELETE FROM d_b_user WHERE id in (?)", [[user1.id, user2.id]]);
    });
});
