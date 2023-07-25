/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import { createTestContainer } from "../test/service-testing-container-module";
import { UserService } from "./user-service";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TypeORM } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { OrganizationService } from "../orgs/organization-service";
import { Authorizer } from "../authorization/authorizer";

const expect = chai.expect;

describe("UserService", async () => {
    let container: Container;
    let userService: UserService;
    let auth: Authorizer;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        userService = container.get<UserService>(UserService);
        auth = container.get(Authorizer);
    });

    afterEach(async () => {
        const typeorm = container.get(TypeORM);
        await resetDB(typeorm);
    });

    it("createUser", async () => {
        const orgService = container.get<OrganizationService>(OrganizationService);
        const org = await orgService.createOrganization(BUILTIN_INSTLLATION_ADMIN_USER_ID, "myOrg");
        const user = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        const user2 = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        const nonOrgUser = await userService.createUser({
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        expect(await auth.hasPermissionOnUser(user.id, "read_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(user.id, "write_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(user.id, "suspend", user.id)).to.be.true;

        expect(await auth.hasPermissionOnUser(BUILTIN_INSTLLATION_ADMIN_USER_ID, "read_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(BUILTIN_INSTLLATION_ADMIN_USER_ID, "write_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(BUILTIN_INSTLLATION_ADMIN_USER_ID, "suspend", user.id)).to.be.true;

        expect(await auth.hasPermissionOnUser(user2.id, "read_info", user.id)).to.be.true;
        expect(await auth.hasPermissionOnUser(user2.id, "write_info", user.id)).to.be.false;
        expect(await auth.hasPermissionOnUser(user2.id, "suspend", user.id)).to.be.false;

        expect(await auth.hasPermissionOnUser(nonOrgUser.id, "read_info", user.id)).to.be.false;
        expect(await auth.hasPermissionOnUser(nonOrgUser.id, "write_info", user.id)).to.be.false;
        expect(await auth.hasPermissionOnUser(nonOrgUser.id, "suspend", user.id)).to.be.false;
    });

    it("updateLoggedInUser_avatarUrlNotUpdatable", async () => {
        const user = await userService.createUser({
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        const updated = await userService.updateUser(user.id, {
            avatarUrl: "evil-payload",
        });

        // The update to avatarUrl is not applied
        expect(updated.avatarUrl).is.undefined;
    });
});
