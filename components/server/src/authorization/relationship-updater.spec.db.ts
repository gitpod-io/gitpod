/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { v1 } from "@authzed/authzed-node";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID, ProjectDB, TeamDB, TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { AdditionalUserData, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { v4 } from "uuid";
import { createTestContainer } from "../test/service-testing-container-module";
import { Authorizer } from "./authorizer";
import { rel } from "./definitions";
import { RelationshipUpdater } from "./relationship-updater";

const expect = chai.expect;

describe("RelationshipUpdater", async () => {
    let container: Container;
    let userDB: UserDB;
    let orgDB: TeamDB;
    let projectDB: ProjectDB;
    let migrator: RelationshipUpdater;
    let authorizer: Authorizer;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        BUILTIN_INSTLLATION_ADMIN_USER_ID;
        userDB = container.get<UserDB>(UserDB);
        orgDB = container.get<TeamDB>(TeamDB);
        projectDB = container.get<ProjectDB>(ProjectDB);
        migrator = container.get<RelationshipUpdater>(RelationshipUpdater);
        authorizer = container.get<Authorizer>(Authorizer);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
    });

    it("should update a simple user", async () => {
        let user = await userDB.newUser();
        user = await migrate(user);

        await expected(rel.user(user.id).container.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await notExpected(rel.installation.admin.user(user.id));
        await expected(rel.installation.member.user(user.id));
        await authorizer.removeAllRelationships("user", user.id);
    });

    it("should update an admin user", async () => {
        let user = await userDB.newUser();
        user.rolesOrPermissions = ["admin"];
        user = await migrate(user);

        await expected(rel.user(user.id).container.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await expected(rel.installation.admin.user(user.id));
        await expected(rel.installation.member.user(user.id));

        // remove admin role
        user.rolesOrPermissions = [];
        // reset fgaRelationshipsVersion to force update
        AdditionalUserData.set(user, { fgaRelationshipsVersion: undefined });
        user = await userDB.storeUser(user);
        user = await migrate(user);
        await expected(rel.user(user.id).container.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await notExpected(rel.installation.admin.user(user.id));
        await expected(rel.installation.member.user(user.id));
    });

    it("should update a simple user organization owned", async () => {
        let user = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        user.organizationId = org.id;
        user = await userDB.storeUser(user);

        user = await migrate(user);

        await expected(rel.user(user.id).self.user(user.id));
        await expected(rel.user(user.id).container.organization(org.id));
        await expected(rel.organization(org.id).installation.installation);
        await expected(rel.organization(org.id).member.user(user.id));
        await expected(rel.organization(org.id).owner.user(user.id));
    });

    it("should update additional members on organization", async () => {
        let user = await userDB.newUser();
        const user2 = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        await orgDB.addMemberToTeam(user2.id, org.id);
        user.organizationId = org.id;
        user = await userDB.storeUser(user);

        user = await migrate(user);

        await expected(rel.user(user.id).self.user(user.id));
        await expected(rel.user(user.id).container.organization(org.id));

        // we haven't called migrate on user2, so we don't expect any relationships
        await notExpected(rel.user(user2.id).container.installation);
        await notExpected(rel.user(user2.id).self.user(user2.id));

        // but on the org user2 is a member
        await expected(rel.organization(org.id).installation.installation);
        await expected(rel.organization(org.id).member.user(user.id));
        await expected(rel.organization(org.id).member.user(user2.id));
        await notExpected(rel.organization(org.id).owner.user(user2.id));
        await expected(rel.organization(org.id).owner.user(user.id));
    });

    it("should update orgs with projects", async () => {
        let user = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        const project = await projectDB.storeProject({
            id: v4(),
            name: "MyProject",
            appInstallationId: "123",
            cloneUrl: "https://github.com/gitpod-io/gitpod.git",
            teamId: org.id,
            creationTime: new Date().toISOString(),
        });
        user.organizationId = org.id;
        user = await userDB.storeUser(user);

        user = await migrate(user);

        // but on the org user2 is a member
        await expected(rel.project(project.id).org.organization(org.id));
    });

    async function expected(relation: v1.Relationship): Promise<void> {
        const rs = await authorizer.find(relation);
        const message = async () => {
            relation.subject = undefined;
            const result = await authorizer.find(relation);
            return `Expected ${JSON.stringify(relation)} to be present, but it was not. Found ${JSON.stringify(
                result,
            )}`;
        };
        expect(rs, await message()).to.not.be.undefined;
    }

    async function notExpected(relation: v1.Relationship): Promise<void> {
        const rs = await authorizer.find(relation);
        expect(rs).to.be.undefined;
    }

    async function migrate(user: User): Promise<User> {
        user = await migrator.migrate(user);
        expect(user.additionalData?.fgaRelationshipsVersion).to.equal(migrator.version);
        return user;
    }
});
