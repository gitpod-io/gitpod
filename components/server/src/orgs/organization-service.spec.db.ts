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

    it("should check deleteOrganization", async () => {
        await expectError(ErrorCodes.PERMISSION_DENIED, () => os.deleteOrganization(member.id, org.id));
        await expectError(ErrorCodes.NOT_FOUND, () => os.deleteOrganization(stranger.id, org.id));

        await os.deleteOrganization(owner.id, org.id);
    });

    it("should check getOrCreateInvite and resetInvite", async () => {
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

    it("should check listMembers", async () => {
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

    it("should check setOrganizationMemberRole and removeOrganizationMember", async () => {
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
});
