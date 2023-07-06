/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser, TypeORM, UserDB, testContainer } from "@gitpod/gitpod-db/lib";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { User } from "@gitpod/ide-service-api/lib/ide.pb";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { serviceTestingContainerModule } from "../test/service-testing-container-module";
import { OrganizationService } from "./organization-service";
import { expectError } from "../projects/projects-service.spec.db";
import { Organization } from "@gitpod/gitpod-protocol";

const expect = chai.expect;

describe("OrganizationService", async () => {
    let container: Container;
    let os: OrganizationService;

    let owner: User;
    let member: User;
    let stranger: User;
    let org: Organization;

    beforeEach(async () => {
        container = testContainer.createChild();
        container.load(serviceTestingContainerModule);
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        os = container.get(OrganizationService);
        const userDB = container.get<UserDB>(UserDB);
        owner = await userDB.newUser();
        org = await os.createOrganization(owner.id, "myorg");
        const invite = await os.getOrCreateInvite(owner.id, org.id);

        member = await userDB.newUser();
        await os.joinOrganization(member.id, invite.id);

        stranger = await userDB.newUser();
    });

    afterEach(async () => {
        // Clean-up database
        const typeorm = container.get(TypeORM);
        const dbConn = await typeorm.getConnection();
        await dbConn.getRepository(DBTeam).delete({});
        const repo = (await typeorm.getConnection()).getRepository(DBUser);
        await repo.delete(owner.id);
        await repo.delete(member.id);
        await repo.delete(stranger.id);
    });

    it("should deleteOrganization", async () => {
        await expectError(ErrorCodes.PERMISSION_DENIED, () => os.deleteOrganization(member.id, org.id));
        await expectError(ErrorCodes.NOT_FOUND, () => os.deleteOrganization(stranger.id, org.id));

        await os.deleteOrganization(owner.id, org.id);
    });

    it("should getOrCreateInvite and resetInvite", async () => {
        expect(org.name).to.equal("myorg");

        const invite = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite).to.not.be.undefined;

        const invite2 = await os.getOrCreateInvite(member.id, org.id);
        expect(invite2.id).to.equal(invite.id);

        const invite3 = await os.resetInvite(owner.id, org.id);
        expect(invite3.id).to.not.equal(invite.id);

        const invite4 = await os.resetInvite(member.id, org.id);
        expect(invite4.id).to.not.equal(invite3.id);

        await expectError(ErrorCodes.NOT_FOUND, () => os.getOrCreateInvite(stranger.id, org.id));
        await expectError(ErrorCodes.NOT_FOUND, () => os.resetInvite(stranger.id, org.id));
    });

    it("should listMembers", async () => {
        let members = await os.listMembers(owner.id, org.id);
        expect(members.length).to.eq(2);
        expect(members.some((m) => m.userId === owner.id)).to.be.true;
        expect(members.some((m) => m.userId === member.id)).to.be.true;

        members = await os.listMembers(member.id, org.id);
        expect(members.length).to.eq(2);
        expect(members.some((m) => m.userId === owner.id)).to.be.true;
        expect(members.some((m) => m.userId === member.id)).to.be.true;

        await expectError(ErrorCodes.NOT_FOUND, () => os.listMembers(stranger.id, org.id));
    });

    it("should setOrganizationMemberRole and removeOrganizationMember", async () => {
        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            os.setOrganizationMemberRole(member.id, org.id, owner.id, "member"),
        );

        // try upgrade the member to owner
        await expectError(ErrorCodes.PERMISSION_DENIED, () =>
            os.setOrganizationMemberRole(member.id, org.id, member.id, "owner"),
        );

        // try removing the owner
        await expectError(ErrorCodes.PERMISSION_DENIED, () => os.removeOrganizationMember(member.id, org.id, owner.id));

        // owners can upgrade members
        await os.setOrganizationMemberRole(owner.id, org.id, member.id, "owner");

        // owner can downgrade themselves
        await os.setOrganizationMemberRole(owner.id, org.id, owner.id, "member");

        // owner and member have switched roles now
        const previouslyMember = member;
        member = owner;
        owner = previouslyMember;

        // owner can downgrade themselves only if they are not the last owner
        await expectError(ErrorCodes.CONFLICT, () =>
            os.setOrganizationMemberRole(owner.id, org.id, owner.id, "member"),
        );

        // owner can delete themselves only if they are not the last owner
        await expectError(ErrorCodes.CONFLICT, () => os.removeOrganizationMember(owner.id, org.id, owner.id));

        // members can remove themselves
        await os.removeOrganizationMember(member.id, org.id, member.id);

        // try remove the member again
        await expectError(ErrorCodes.NOT_FOUND, () => os.removeOrganizationMember(member.id, org.id, member.id));
    });

    it("should listOrganizationsByMember", async () => {
        await os.createOrganization(owner.id, "org1");
        await os.createOrganization(owner.id, "org2");
        let orgs = await os.listOrganizationsByMember(owner.id, owner.id);
        expect(orgs.length).to.eq(3);
        orgs = await os.listOrganizationsByMember(member.id, owner.id);
        expect(orgs.length).to.eq(1);
        orgs = await os.listOrganizationsByMember(stranger.id, owner.id);
        expect(orgs.length).to.eq(0);
    });

    it("should getOrganization", async () => {
        const foundOrg = await os.getOrganization(owner.id, org.id);
        expect(foundOrg.name).to.equal(org.name);

        const foundByMember = await os.getOrganization(member.id, org.id);
        expect(foundByMember.name).to.equal(org.name);

        await expectError(ErrorCodes.NOT_FOUND, () => os.getOrganization(stranger.id, org.id));
    });

    it("should updateOrganization", async () => {
        org.name = "newName";
        await os.updateOrganization(owner.id, org.id, org);
        const updated = await os.getOrganization(owner.id, org.id);
        expect(updated.name).to.equal(org.name);

        await expectError(ErrorCodes.PERMISSION_DENIED, () => os.updateOrganization(member.id, org.id, org));
        await expectError(ErrorCodes.NOT_FOUND, () => os.updateOrganization(stranger.id, org.id, org));
    });

    it("should getSettings and updateSettings", async () => {
        const settings = await os.getSettings(owner.id, org.id);
        expect(settings).to.not.be.undefined;
        expect(settings).to.not.be.null;

        settings.workspaceSharingDisabled = true;

        await os.updateSettings(owner.id, org.id, settings);
        const updated = await os.getSettings(owner.id, org.id);
        expect(updated.workspaceSharingDisabled).to.be.true;

        await expectError(ErrorCodes.PERMISSION_DENIED, () => os.updateSettings(member.id, org.id, settings));
        await expectError(ErrorCodes.NOT_FOUND, () => os.updateSettings(stranger.id, org.id, settings));
    });
});
