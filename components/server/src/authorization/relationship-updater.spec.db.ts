/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, ProjectDB, TeamDB, TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { AdditionalUserData, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { Authorizer, Relationship, Resource, installation } from "./authorizer";
import { Relation } from "./definitions";
import { RelationshipUpdater } from "./relationship-updater";
import { v4 } from "uuid";

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

        await expected(user, "container", installation);
        await expected(user, "self", user);
        await notExpected(installation, "admin", user);
        await expected(installation, "member", user);
        await authorizer.removeAllRelationships("user", user.id);
    });

    it("should update an admin user", async () => {
        let user = await userDB.newUser();
        user.rolesOrPermissions = ["admin"];
        user = await migrate(user);

        await expected(user, "container", installation);
        await expected(user, "self", user);
        await expected(installation, "admin", user);
        await expected(installation, "member", user);

        // remove admin role
        user.rolesOrPermissions = [];
        // reset fgaRelationshipsVersion to force update
        AdditionalUserData.set(user, { fgaRelationshipsVersion: undefined });
        user = await userDB.storeUser(user);
        user = await migrate(user);
        await expected(user, "container", installation);
        await expected(user, "self", user);
        await notExpected(installation, "admin", user);
        await expected(installation, "member", user);
    });

    it("should update a simple user organization owned", async () => {
        let user = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        user.organizationId = org.id;
        user = await userDB.storeUser(user);

        user = await migrate(user);

        await expected(user, "container", org);
        await expected(user, "self", user);
        await expected(org, "installation", installation);
        await expected(org, "member", user);
        await expected(org, "owner", user);
    });

    it("should update additional members on organization", async () => {
        let user = await userDB.newUser();
        const user2 = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        await orgDB.addMemberToTeam(user2.id, org.id);
        user.organizationId = org.id;
        user = await userDB.storeUser(user);

        user = await migrate(user);

        await expected(user, "container", org);
        await expected(user, "self", user);

        // we haven't called migrate on user2, so we don't expect any relationships
        await notExpected(user2, "container", installation);
        await notExpected(user2, "self", user2);

        // but on the org user2 is a member
        await expected(org, "installation", installation);
        await expected(org, "member", user2);
        await notExpected(org, "owner", user2);
        await expected(org, "member", user);
        await expected(org, "owner", user);
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

        await expected(user, "container", org);
        await expected(user, "self", user);

        // but on the org user2 is a member
        await expected(org, "installation", installation);
        await expected(org, "member", user);
        await expected(org, "owner", user);

        await expected(project, "org", org);
    });

    async function expected(res: Resource, relation: Relation, target: Resource): Promise<void> {
        const expected = new Relationship(
            Resource.getType(res),
            res.id,
            relation,
            Resource.getType(target),
            target.id,
        ).toString();
        const rs = await authorizer.readRelationships(res, relation, target);
        const all = await authorizer.readRelationships(res, relation);
        expect(
            rs.length,
            `Expected ${expected} but got ${JSON.stringify(rs)} (all rs of this kind ${JSON.stringify(all)})`,
        ).to.equal(1);
        expect(rs[0].toString()).to.equal(expected);
    }

    async function notExpected(res: Resource, relation: Relation, target: Resource): Promise<void> {
        const rs = await authorizer.readRelationships(res, relation, target);
        const all = await authorizer.readRelationships(res, relation);
        expect(
            rs.length,
            `Expected nothing but got ${JSON.stringify(rs)} (all rs of this kind ${JSON.stringify(all)})`,
        ).to.equal(0);
    }

    async function migrate(user: User): Promise<User> {
        user = await migrator.migrate(user);
        expect(user.additionalData?.fgaRelationshipsVersion).to.equal(migrator.version);
        return user;
    }
});
