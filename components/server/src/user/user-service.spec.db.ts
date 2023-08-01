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
    let admin: User;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        userService = container.get<UserService>(UserService);
        auth = container.get(Authorizer);
        const orgService = container.get<OrganizationService>(OrganizationService);
        org = await orgService.createOrganization(BUILTIN_INSTLLATION_ADMIN_USER_ID, "myOrg");
        user = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        user2 = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        nonOrgUser = await userService.createUser({
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        admin = await userService.findUserById(BUILTIN_INSTLLATION_ADMIN_USER_ID, BUILTIN_INSTLLATION_ADMIN_USER_ID);
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

        expect(await auth.hasPermissionOnUser(admin.id, "read_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(admin.id, "write_info", user.id)).to.be.false;
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
});
