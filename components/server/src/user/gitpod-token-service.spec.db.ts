/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TypeORM } from "@gitpod/gitpod-db/lib";
import { GitpodTokenType, Organization, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { OrganizationService } from "../orgs/organization-service";
import { UserService } from "./user-service";
import { expectError } from "../test/expect-utils";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { GitpodTokenService } from "./gitpod-token-service";

const expect = chai.expect;

describe("GitpodTokenService", async () => {
    let container: Container;
    let gs: GitpodTokenService;

    let member: User;
    let stranger: User;
    let org: Organization;

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

        gs = container.get(GitpodTokenService);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("should generate a new gitpod token", async () => {
        const resp1 = await gs.getGitpodTokens(member.id, member.id);
        expect(resp1.length).to.equal(0);

        await gs.generateNewGitpodToken(member.id, member.id, { name: "token1", type: GitpodTokenType.API_AUTH_TOKEN });

        const resp2 = await gs.getGitpodTokens(member.id, member.id);
        expect(resp2.length).to.equal(1);

        await expectError(ErrorCodes.NOT_FOUND, gs.getGitpodTokens(stranger.id, member.id));
        await expectError(
            ErrorCodes.NOT_FOUND,
            gs.generateNewGitpodToken(stranger.id, member.id, { name: "token2", type: GitpodTokenType.API_AUTH_TOKEN }),
        );
    });

    it("should list gitpod tokens", async () => {
        await gs.generateNewGitpodToken(member.id, member.id, { name: "token1", type: GitpodTokenType.API_AUTH_TOKEN });
        await gs.generateNewGitpodToken(member.id, member.id, { name: "token2", type: GitpodTokenType.API_AUTH_TOKEN });

        const tokens = await gs.getGitpodTokens(member.id, member.id);
        expect(tokens.length).to.equal(2);
        expect(tokens.some((t) => t.name === "token1")).to.be.true;
        expect(tokens.some((t) => t.name === "token2")).to.be.true;

        await expectError(ErrorCodes.NOT_FOUND, gs.getGitpodTokens(stranger.id, member.id));
    });

    it("should return gitpod token", async () => {
        await gs.generateNewGitpodToken(member.id, member.id, {
            name: "token1",
            type: GitpodTokenType.API_AUTH_TOKEN,
            scopes: ["user:email", "read:user"],
        });

        const tokens = await gs.getGitpodTokens(member.id, member.id);
        expect(tokens.length).to.equal(1);

        const token = await gs.findGitpodToken(member.id, member.id, tokens[0].tokenHash);
        expect(token).to.not.be.undefined;

        await expectError(ErrorCodes.NOT_FOUND, gs.findGitpodToken(stranger.id, member.id, tokens[0].tokenHash));
    });

    it("should delete gitpod tokens", async () => {
        await gs.generateNewGitpodToken(member.id, member.id, {
            name: "token1",
            type: GitpodTokenType.API_AUTH_TOKEN,
        });
        await gs.generateNewGitpodToken(member.id, member.id, {
            name: "token2",
            type: GitpodTokenType.API_AUTH_TOKEN,
        });

        const tokens = await gs.getGitpodTokens(member.id, member.id);
        expect(tokens.length).to.equal(2);

        await gs.deleteGitpodToken(member.id, member.id, tokens[0].tokenHash);

        const tokens2 = await gs.getGitpodTokens(member.id, member.id);
        expect(tokens2.length).to.equal(1);

        await expectError(ErrorCodes.NOT_FOUND, gs.deleteGitpodToken(stranger.id, member.id, tokens[1].tokenHash));
    });
});
