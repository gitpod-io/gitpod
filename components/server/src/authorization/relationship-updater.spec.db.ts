/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { v1 } from "@authzed/authzed-node";
import {
    BUILTIN_INSTLLATION_ADMIN_USER_ID,
    ProjectDB,
    TeamDB,
    TypeORM,
    UserDB,
    WorkspaceDB,
} from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { User, Workspace } from "@gitpod/gitpod-protocol";
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
    let workspaceDB: WorkspaceDB;
    let migrator: RelationshipUpdater;
    let authorizer: Authorizer;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        BUILTIN_INSTLLATION_ADMIN_USER_ID;
        userDB = container.get<UserDB>(UserDB);
        orgDB = container.get<TeamDB>(TeamDB);
        projectDB = container.get<ProjectDB>(ProjectDB);
        workspaceDB = container.get<WorkspaceDB>(WorkspaceDB);
        migrator = container.get<RelationshipUpdater>(RelationshipUpdater);
        authorizer = container.get<Authorizer>(Authorizer);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("should update a simple user", async () => {
        let user = await userDB.newUser();
        await notExpected(rel.user(user.id).installation.installation);
        await notExpected(rel.user(user.id).self.user(user.id));
        await notExpected(rel.installation.member.user(user.id));

        user = await migrate(user);

        await expected(rel.user(user.id).installation.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await notExpected(rel.installation.admin.user(user.id));
        await expected(rel.installation.member.user(user.id));
    });

    it("should correctly update a simple user after it moves between org and installation level", async () => {
        let user = await userDB.newUser();
        user = await migrate(user);

        await expected(rel.user(user.id).installation.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await notExpected(rel.installation.admin.user(user.id));
        await expected(rel.installation.member.user(user.id));

        // lets move the user to an org
        const org = await orgDB.createTeam(user.id, "MyOrg");
        user.organizationId = org.id;
        user = await userDB.storeUser(user);
        user = await migrate(user);

        await notExpected(rel.user(user.id).installation.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await notExpected(rel.installation.member.user(user.id));
        await expected(rel.user(user.id).organization.organization(org.id));
        await expected(rel.organization(org.id).member.user(user.id));
        await expected(rel.organization(org.id).owner.user(user.id));

        // and back to no org
        user.organizationId = "";
        user = await userDB.storeUser(user);
        user = await migrate(user);

        await expected(rel.user(user.id).installation.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await expected(rel.installation.member.user(user.id));
        await notExpected(rel.user(user.id).organization.organization(org.id));
        // user is still an owner of the org
        await expected(rel.organization(org.id).member.user(user.id));
        await expected(rel.organization(org.id).owner.user(user.id));
    });

    it("should update an admin user", async () => {
        let user = await userDB.newUser();
        user.rolesOrPermissions = ["admin"];
        user = await userDB.storeUser(user);
        user = await migrate(user);

        await expected(rel.user(user.id).installation.installation);
        await expected(rel.user(user.id).self.user(user.id));
        await expected(rel.installation.admin.user(user.id));
        await expected(rel.installation.member.user(user.id));

        // remove admin role
        user.rolesOrPermissions = [];
        user = await userDB.storeUser(user);
        user = await migrate(user);

        await expected(rel.user(user.id).installation.installation);
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
        await expected(rel.user(user.id).organization.organization(org.id));
        await expected(rel.organization(org.id).installation.installation);
        await expected(rel.organization(org.id).member.user(user.id));
        await expected(rel.organization(org.id).owner.user(user.id));
    });

    it("should update additional members on organization", async () => {
        let user = await userDB.newUser();
        let user2 = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        await orgDB.addMemberToTeam(user2.id, org.id);
        user.organizationId = org.id;
        user = await userDB.storeUser(user);

        user = await migrate(user);

        await expected(rel.user(user.id).self.user(user.id));
        await expected(rel.user(user.id).organization.organization(org.id));

        // we haven't called migrate on user2, so we don't expect any relationships
        await notExpected(rel.user(user2.id).installation.installation);
        await notExpected(rel.user(user2.id).self.user(user2.id));

        // but on the org user2 is a member
        await expected(rel.organization(org.id).installation.installation);
        await expected(rel.organization(org.id).member.user(user.id));
        await expected(rel.organization(org.id).member.user(user2.id));
        await notExpected(rel.organization(org.id).owner.user(user2.id));
        await expected(rel.organization(org.id).owner.user(user.id));

        user2 = await migrate(user2);

        await expected(rel.user(user2.id).installation.installation);
        await expected(rel.user(user2.id).self.user(user2.id));

        // rest should be the same
        await expected(rel.organization(org.id).installation.installation);
        await expected(rel.organization(org.id).member.user(user.id));
        await expected(rel.organization(org.id).member.user(user2.id));
        await notExpected(rel.organization(org.id).owner.user(user2.id));
        await expected(rel.organization(org.id).owner.user(user.id));
    });

    it("should remove members when rerunning migrate", async () => {
        let user = await userDB.newUser();
        let user2 = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        await orgDB.addMemberToTeam(user2.id, org.id);
        await orgDB.setTeamMemberRole(user2.id, org.id, "owner");
        user.organizationId = org.id;
        user = await userDB.storeUser(user);

        user = await migrate(user);

        await expected(rel.organization(org.id).member.user(user2.id));
        await expected(rel.organization(org.id).owner.user(user2.id));

        // downgrade to member
        await orgDB.setTeamMemberRole(user2.id, org.id, "member");

        user2 = await migrate(user2);

        await expected(rel.organization(org.id).member.user(user2.id));
        await notExpected(rel.organization(org.id).owner.user(user2.id));

        // remove user2 from org
        await orgDB.removeMemberFromTeam(user2.id, org.id);

        user2 = await migrate(user2);
        await notExpected(rel.organization(org.id).member.user(user2.id));
        await notExpected(rel.organization(org.id).owner.user(user2.id));
    });

    it("should remove projects when rerunning migrate", async () => {
        let user = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        const project1 = await projectDB.storeProject({
            id: v4(),
            name: "MyProject",
            appInstallationId: "123",
            cloneUrl: "https://github.com/gitpod-io/gitpod.git",
            teamId: org.id,
            creationTime: new Date().toISOString(),
        });
        const project2 = await projectDB.storeProject({
            id: v4(),
            name: "MyProject",
            appInstallationId: "123",
            cloneUrl: "https://github.com/gitpod-io/gitpod.git",
            teamId: org.id,
            creationTime: new Date().toISOString(),
        });

        user = await migrate(user);

        await expected(rel.project(project1.id).org.organization(org.id));
        await expected(rel.project(project2.id).org.organization(org.id));

        // remove project2
        await projectDB.markDeleted(project2.id);

        user = await migrate(user);

        await expected(rel.project(project1.id).org.organization(org.id));
        await notExpected(rel.project(project2.id).org.organization(org.id));
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

    it("should create relationships for all user workspaces", async function () {
        const user = await userDB.newUser();
        const org = await orgDB.createTeam(user.id, "MyOrg");
        const totalWorkspaces = 50;
        const expectedWorkspaces: Workspace[] = [];
        for (let i = 0; i < totalWorkspaces; i++) {
            const workspace = await workspaceDB.store({
                id: v4(),
                creationTime: new Date().toISOString(),
                organizationId: org.id,
                ownerId: user.id,
                contextURL: "myContext",
                type: "regular",
                description: "myDescription",
                context: {
                    title: "myTitle",
                },
                shareable: i % 5 === 0,
                config: {},
            });
            expectedWorkspaces.push(workspace);
        }

        await migrate(user);
        for (const workspace of expectedWorkspaces) {
            await expected(rel.workspace(workspace.id).org.organization(org.id));
            await expected(rel.workspace(workspace.id).owner.user(user.id));
            if (workspace.shareable) {
                await expected(rel.workspace(workspace.id).shared.anyUser);
            }
        }
    });

    async function expected(relation: v1.Relationship): Promise<void> {
        const rs = await authorizer.find(relation);
        const message = async () => {
            const expected = JSON.stringify(relation);
            relation.subject = undefined;
            const result = await authorizer.find(relation);
            return `Expected ${expected} to be present, but it was not. Found ${JSON.stringify(result)}`;
        };
        expect(rs, await message()).to.not.be.undefined;
    }

    async function notExpected(relation: v1.Relationship): Promise<void> {
        const rs = await authorizer.find(relation);
        expect(
            rs,
            `Unexpected relation: ${rs?.subject?.object?.objectType}:${rs?.subject?.object?.objectId}#${rs?.relation}@${rs?.resource?.objectType}:${rs?.resource?.objectId}`,
        ).to.be.undefined;
    }

    async function migrate(user: User): Promise<User> {
        // reset fgaRelationshipsVersion to force update
        user.fgaRelationshipsVersion = undefined;
        await userDB.updateUserPartial({ id: user.id, fgaRelationshipsVersion: user.fgaRelationshipsVersion });
        user = await migrator.migrate(user, true);
        expect(user.fgaRelationshipsVersion).to.equal(RelationshipUpdater.version);
        return user;
    }
});
