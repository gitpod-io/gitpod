/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser, TypeORM, UserDB, testContainer } from "@gitpod/gitpod-db/lib";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { User } from "@gitpod/ide-service-api/lib/ide.pb";
import { fail } from "assert";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { serviceTestingContainerModule } from "../test/service-testing-container-module";
import { OrganizationService } from "./organization-service";

const expect = chai.expect;

describe("OrganizationService", async () => {
    let container: Container;
    let owner: User;
    let member: User;
    let stranger: User;

    beforeEach(async () => {
        container = testContainer.createChild();
        container.load(serviceTestingContainerModule);
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        const userDB = container.get<UserDB>(UserDB);
        owner = await userDB.newUser();
        member = await userDB.newUser();
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

    it("should allow only owners to an org", async () => {
        const os = container.get(OrganizationService);
        const org = await os.createOrganization(owner.id, "myorg");
        expect(org.name).to.equal("myorg");

        const invite = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite).to.not.be.undefined;
        await os.joinOrganization(member.id, invite.id);

        try {
            await os.deleteOrganization(member.id, org.id);
            fail("should not be allowed");
        } catch (err) {
            expect(err).instanceOf(ApplicationError);
            expect((err as ApplicationError).code).to.equal(ErrorCodes.PERMISSION_DENIED);
        }

        try {
            await os.deleteOrganization(stranger.id, org.id);
            fail("should not be allowed");
        } catch (err) {
            expect(err).instanceOf(ApplicationError);
            expect((err as ApplicationError).code).to.equal(ErrorCodes.NOT_FOUND);
        }

        await os.deleteOrganization(owner.id, org.id);
    });

    it("should allow owners to get an invite", async () => {
        const os = container.get(OrganizationService);
        const org = await os.createOrganization(owner.id, "myorg");
        expect(org.name).to.equal("myorg");

        const invite = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite).to.not.be.undefined;

        const invite2 = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite2.id).to.equal(invite.id);

        const invite3 = await os.resetInvite(owner.id, org.id);
        expect(invite3.id).to.not.equal(invite.id);
    });

    it("check strangers cannot do much", async () => {
        const os = container.get(OrganizationService);
        const org = await os.createOrganization(owner.id, "myorg");
        expect(org.name).to.equal("myorg");

        try {
            await os.getOrCreateInvite(stranger.id, org.id);
            fail("should have thrown");
        } catch (e) {
            expect(e.message).to.contain("not found");
        }

        // let's make sure an invite is created by the owner
        const invite = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite).to.not.be.undefined;

        // still the invite should not be accessible to strangers
        try {
            await os.getOrCreateInvite(stranger.id, org.id);
            fail("should have thrown");
        } catch (e) {
            expect(e.message).to.contain("not found");
        }
    });

    it("check change and remove members", async () => {
        const os = container.get(OrganizationService);
        const org = await os.createOrganization(owner.id, "myorg");
        expect(org.name).to.equal("myorg");

        const invite = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite).to.not.be.undefined;

        const result = await os.joinOrganization(member.id, invite.id);
        expect(result.added).to.be.true;

        try {
            // try downgrade the owner to member
            await os.setOrganizationMemberRole(member.id, org.id, owner.id, "member");
            expect.fail("should have thrown");
        } catch (e) {
            expect(ApplicationError.hasErrorCode(e) && e.code).to.equal(ErrorCodes.PERMISSION_DENIED);
        }

        try {
            // try upgrade the member to owner
            await os.setOrganizationMemberRole(member.id, org.id, member.id, "owner");
            expect.fail("should have thrown");
        } catch (e) {
            expect(ApplicationError.hasErrorCode(e) && e.code).to.equal(ErrorCodes.PERMISSION_DENIED);
        }

        try {
            // try removing the owner
            await os.removeOrganizationMember(member.id, org.id, owner.id);
            expect.fail("should have thrown");
        } catch (e) {
            expect(ApplicationError.hasErrorCode(e) && e.code).to.equal(ErrorCodes.PERMISSION_DENIED);
        }

        // owners can upgrade members
        await os.setOrganizationMemberRole(owner.id, org.id, member.id, "owner");

        // owner can downgrade themselves
        await os.setOrganizationMemberRole(owner.id, org.id, owner.id, "member");

        // owner and member have switched roles now
        const previouslyMember = member;
        member = owner;
        owner = previouslyMember;

        // owner can downgrade themselves only if they are not the last owner
        try {
            await os.setOrganizationMemberRole(owner.id, org.id, owner.id, "member");
            expect.fail("should have thrown");
        } catch (error) {
            expect(ApplicationError.hasErrorCode(error) && error.code, error.message).to.equal(ErrorCodes.CONFLICT);
        }

        // owner can delete themselves only if they are not the last owner
        try {
            await os.setOrganizationMemberRole(owner.id, org.id, owner.id, "member");
            expect.fail("should have thrown");
        } catch (error) {
            expect(ApplicationError.hasErrorCode(error) && error.code).to.equal(ErrorCodes.CONFLICT);
        }

        // members can remove themselves
        await os.removeOrganizationMember(member.id, org.id, member.id);

        try {
            // try remove the member again
            await os.removeOrganizationMember(member.id, org.id, member.id);
            expect.fail("should have thrown");
        } catch (e) {
            expect(ApplicationError.hasErrorCode(e) && e.code).to.equal(ErrorCodes.NOT_FOUND);
        }
    });
});
