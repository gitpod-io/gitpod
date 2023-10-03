/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import "mocha";
import { Container } from "inversify";
import { createTestContainer } from "../test/service-testing-container-module";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TypeORM } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { OrganizationService } from "../orgs/organization-service";
import { Authorizer } from "../authorization/authorizer";
import { UserService } from "./user-service";
import { Organization, User } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { expectError } from "../test/expect-utils";

const expect = chai.expect;

describe("UserService", async () => {
    let container: Container;
    let userService: UserService;
    let auth: Authorizer;
    let org: Organization;
    let user: User;
    let user2: User;
    let nonOrgUser: User;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        userService = container.get<UserService>(UserService);
        auth = container.get(Authorizer);
        const orgService = container.get<OrganizationService>(OrganizationService);
        org = await orgService.createOrganization(BUILTIN_INSTLLATION_ADMIN_USER_ID, "myOrg");
        const invite = await orgService.getOrCreateInvite(BUILTIN_INSTLLATION_ADMIN_USER_ID, org.id);
        user = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });
        await orgService.joinOrganization(user.id, invite.id);

        user2 = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });
        await orgService.joinOrganization(user2.id, invite.id);

        nonOrgUser = await userService.createUser({
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });
    });

    afterEach(async () => {
        const typeorm = container.get(TypeORM);
        await resetDB(typeorm);
    });

    it("createUser", async () => {
        expect(await auth.hasPermissionOnUser(user.id, "read_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(user.id, "write_info", user.id)).to.be.true;

        expect(await auth.hasPermissionOnUser(user2.id, "read_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(user2.id, "write_info", user.id)).to.be.false;

        expect(await auth.hasPermissionOnUser(nonOrgUser.id, "read_info", user.id)).to.be.false;
        expect(await auth.hasPermissionOnUser(nonOrgUser.id, "write_info", user.id)).to.be.false;

        expect(await auth.hasPermissionOnUser(BUILTIN_INSTLLATION_ADMIN_USER_ID, "read_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(BUILTIN_INSTLLATION_ADMIN_USER_ID, "write_info", user.id)).to.be.false;
    });

    it("updateLoggedInUser_avatarUrlNotUpdatable", async () => {
        const update = {
            id: user.id,
            avatarUrl: "evil-payload",
            additionalData: {
                disabledClosedTimeout: true,
            },
        };
        await expectError(ErrorCodes.NOT_FOUND, userService.updateUser(nonOrgUser.id, update));
        await expectError(ErrorCodes.PERMISSION_DENIED, userService.updateUser(user2.id, update));
        const updated = await userService.updateUser(user.id, update);

        // The update to avatarUrl is not applied
        expect(updated.avatarUrl).is.undefined;
        expect(updated.additionalData?.disabledClosedTimeout).to.be.true;
    });

    it("should updateWorkspaceTimeoutSetting", async () => {
        await userService.updateWorkspaceTimeoutSetting(user.id, user.id, {
            disabledClosedTimeout: true,
        });
        let updated = await userService.findUserById(user.id, user.id);
        expect(updated.additionalData?.disabledClosedTimeout).to.be.true;

        await userService.updateWorkspaceTimeoutSetting(user.id, user.id, {
            workspaceTimeout: "60m",
        });
        updated = await userService.findUserById(user.id, user.id);
        expect(updated.additionalData?.workspaceTimeout).to.eq("60m");

        await expectError(
            ErrorCodes.BAD_REQUEST,
            userService.updateWorkspaceTimeoutSetting(user.id, user.id, {
                workspaceTimeout: "invalid",
            }),
        );

        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            userService.updateWorkspaceTimeoutSetting(user2.id, user.id, {
                workspaceTimeout: "10m",
            }),
        );

        await expectError(
            ErrorCodes.NOT_FOUND,
            userService.updateWorkspaceTimeoutSetting(nonOrgUser.id, user.id, {
                workspaceTimeout: "10m",
            }),
        );
    });

    it("should updateRoleOrPermission", async () => {
        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            userService.updateRoleOrPermission(user.id, user.id, [
                {
                    role: "admin",
                    add: false,
                },
            ]),
        );

        await userService.updateRoleOrPermission(BUILTIN_INSTLLATION_ADMIN_USER_ID, user.id, [
            {
                role: "admin",
                add: true,
            },
        ]);

        let updated = await userService.findUserById(user.id, user.id);
        expect(new Set(updated.rolesOrPermissions).has("admin")).to.be.true;

        // can remove role themselves now
        await userService.updateRoleOrPermission(user.id, user.id, [
            {
                role: "admin",
                add: false,
            },
        ]);

        updated = await userService.findUserById(user.id, user.id);
        expect(new Set(updated.rolesOrPermissions).has("admin")).to.be.false;

        // but not add again
        await expectError(
            ErrorCodes.PERMISSION_DENIED,
            userService.updateRoleOrPermission(user.id, user.id, [
                {
                    role: "admin",
                    add: true,
                },
            ]),
        );
    });

    it("should listUsers", async () => {
        let users = await userService.listUsers(user.id, {});
        expect(users.total).to.eq(2);
        expect(users.rows.some((u) => u.id === user.id)).to.be.true;
        expect(users.rows.some((u) => u.id === user2.id)).to.be.true;

        users = await userService.listUsers(BUILTIN_INSTLLATION_ADMIN_USER_ID, {});
        expect(users.total).to.eq(4);
        expect(users.rows.some((u) => u.id === user.id)).to.be.true;
        expect(users.rows.some((u) => u.id === user2.id)).to.be.true;
        expect(users.rows.some((u) => u.id === nonOrgUser.id)).to.be.true;
        expect(users.rows.some((u) => u.id === BUILTIN_INSTLLATION_ADMIN_USER_ID)).to.be.true;

        users = await userService.listUsers(nonOrgUser.id, {});
        expect(users.total).to.eq(1);
        expect(users.rows.some((u) => u.id === nonOrgUser.id)).to.be.true;
    });
});
