/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TypeORM } from "@gitpod/gitpod-db/lib";
import { Organization, SSHPublicKeyValue, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { SSHKeyService } from "./sshkey-service";
import { OrganizationService } from "../orgs/organization-service";
import { UserService } from "./user-service";
import { expectError } from "../test/expect-utils";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

const expect = chai.expect;

describe("SSHKeyService", async () => {
    let container: Container;
    let ss: SSHKeyService;

    let member: User;
    let stranger: User;
    let org: Organization;

    const testSSHkeys: SSHPublicKeyValue[] = [
        {
            name: "foo",
            key: "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBN+Mh3U/3We4VYtV1QmWUFIzFLTUeegl1Ao5/QGtCRGAZn8bxX9KlCrrWISIjSYAwCajIEGSPEZwPNMBoK8XD8Q= test@gitpod",
        },
        {
            name: "bar",
            key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK0wmN/Cr3JXqmLW7u+g9pTh+wyqDHpSQEIQczXkVx9q bar@gitpod",
        },
    ];

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});

        const orgService = container.get<OrganizationService>(OrganizationService);
        org = await orgService.createOrganization(BUILTIN_INSTLLATION_ADMIN_USER_ID, "myOrg");

        const userService = container.get<UserService>(UserService);
        member = await orgService.createOrgOwnedUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });
        stranger = await userService.createUser({
            identity: {
                authId: "foo2",
                authName: "bar2",
                authProviderId: "github",
            },
        });

        ss = container.get(SSHKeyService);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        await container.unbindAllAsync();
    });

    it("should add ssh key", async () => {
        const resp1 = await ss.hasSSHPublicKey(member.id, member.id);
        expect(resp1).to.be.false;

        await ss.addSSHPublicKey(member.id, member.id, testSSHkeys[0]);

        const resp2 = await ss.hasSSHPublicKey(member.id, member.id);
        expect(resp2).to.be.true;

        await expectError(ErrorCodes.NOT_FOUND, ss.hasSSHPublicKey(stranger.id, member.id));
        await expectError(ErrorCodes.NOT_FOUND, ss.addSSHPublicKey(stranger.id, member.id, testSSHkeys[0]));
    });

    it("should list ssh keys", async () => {
        await ss.addSSHPublicKey(member.id, member.id, testSSHkeys[0]);
        await ss.addSSHPublicKey(member.id, member.id, testSSHkeys[1]);

        const keys = await ss.getSSHPublicKeys(member.id, member.id);
        expect(keys.length).to.equal(2);
        expect(testSSHkeys.some((k) => k.name === keys[0].name && k.key === keys[0].key)).to.be.true;
        expect(testSSHkeys.some((k) => k.name === keys[1].name && k.key === keys[1].key)).to.be.true;

        await expectError(ErrorCodes.NOT_FOUND, ss.getSSHPublicKeys(stranger.id, member.id));
    });

    it("should delete ssh keys", async () => {
        await ss.addSSHPublicKey(member.id, member.id, testSSHkeys[0]);
        await ss.addSSHPublicKey(member.id, member.id, testSSHkeys[1]);

        const keys = await ss.getSSHPublicKeys(member.id, member.id);
        expect(keys.length).to.equal(2);

        await ss.deleteSSHPublicKey(member.id, member.id, keys[0].id);

        const keys2 = await ss.getSSHPublicKeys(member.id, member.id);
        expect(keys2.length).to.equal(1);

        await expectError(ErrorCodes.NOT_FOUND, ss.deleteSSHPublicKey(stranger.id, member.id, keys[0].id));
    });
});
