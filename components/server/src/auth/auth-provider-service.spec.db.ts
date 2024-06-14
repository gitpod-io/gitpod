/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM } from "@gitpod/gitpod-db/lib";
import { AuthProviderInfo, Organization, User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { UserService } from "../user/user-service";
import { AuthProviderService } from "./auth-provider-service";
import { Config } from "../config";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { expectError } from "../test/expect-utils";
import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { AuthProviderParams } from "./auth-provider";
import { OrganizationService } from "../orgs/organization-service";
import { SYSTEM_USER } from "../authorization/authorizer";

const expect = chai.expect;

describe("AuthProviderService", async () => {
    let service: AuthProviderService;
    let userService: UserService;
    let orgService: OrganizationService;
    let container: Container;
    let currentUser: User;
    let org: Organization;

    const newEntry = () =>
        <AuthProviderEntry.NewEntry>{
            host: "github.com",
            ownerId: currentUser.id,
            type: "GitHub",
            clientId: "123",
            clientSecret: "secret-123",
        };
    const expectedEntry = () =>
        <Partial<AuthProviderEntry>>{
            host: "github.com",
            oauth: {
                authorizationUrl: "https://github.com/login/oauth/authorize",
                callBackUrl: "https://gitpod.io/auth/callback",
                clientId: "123",
                clientSecret: "redacted",
                tokenUrl: "https://github.com/login/oauth/access_token",
            },
            organizationId: undefined,
            type: "GitHub",
            status: "pending",
            ownerId: currentUser.id,
        };
    const expectedParams = () =>
        <Partial<AuthProviderParams>>{
            builtin: false,
            disallowLogin: false,
            verified: false,
            ...expectedEntry(),
            oauth: { ...expectedEntry().oauth, clientSecret: "secret-123" },
        };

    const newOrgEntry = () =>
        <AuthProviderEntry.NewOrgEntry>{
            host: "github.com",
            ownerId: currentUser.id,
            type: "GitHub",
            clientId: "123",
            clientSecret: "secret-123",
            organizationId: org.id,
        };
    const expectedOrgEntry = () =>
        <Partial<AuthProviderEntry>>{
            host: "github.com",
            oauth: {
                authorizationUrl: "https://github.com/login/oauth/authorize",
                callBackUrl: "https://gitpod.io/auth/callback",
                clientId: "123",
                clientSecret: "redacted",
                tokenUrl: "https://github.com/login/oauth/access_token",
            },
            organizationId: org.id,
            type: "GitHub",
            status: "pending",
            ownerId: currentUser.id,
        };
    const expectedOrgParams = () =>
        <Partial<AuthProviderParams>>{
            builtin: false,
            disallowLogin: true,
            verified: false,
            ...expectedOrgEntry(),
            oauth: { ...expectedOrgEntry().oauth, clientSecret: "secret-123" },
        };

    const addBuiltInProvider = (host: string = "github.com") => {
        const config = container.get<Config>(Config);
        config.builtinAuthProvidersConfigured = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        config.authProviderConfigs.push((<Partial<AuthProviderParams>>{
            host,
            id: "Public-GitHub",
            verified: true,
        }) as any);
    };

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        service = container.get(AuthProviderService);
        userService = container.get<UserService>(UserService);
        currentUser = await userService.createUser({
            identity: {
                authId: "gh-user-1",
                authName: "user",
                authProviderId: "public-github",
            },
        });
        orgService = container.get<OrganizationService>(OrganizationService);
        org = await orgService.createOrganization(currentUser.id, "myorg");
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    describe("createAuthProviderOfUser", async () => {
        it("should create user-level provider", async () => {
            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            await service.createAuthProviderOfUser(currentUser.id, newEntry());

            const providers = await service.getAllAuthProviderParams();
            expect(providers).to.have.lengthOf(1);
            expect(providers[0]).to.deep.include(expectedParams());
        });

        it("should fail in case of conflict with built-in provider", async () => {
            addBuiltInProvider();

            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            await expectError(ErrorCodes.CONFLICT, service.createAuthProviderOfUser(currentUser.id, newEntry()));
        });
        it("should fail if host is not reachable", async () => {
            await expectError(
                ErrorCodes.BAD_REQUEST,
                service.createAuthProviderOfUser(currentUser.id, {
                    ...newEntry(),
                    host: "please-dont-register-this-domain.com:666",
                }),
            );
        });
        it("should fail if trying to register same host", async () => {
            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            await service.createAuthProviderOfUser(currentUser.id, newEntry());

            await expectError(ErrorCodes.CONFLICT, service.createAuthProviderOfUser(currentUser.id, newEntry()));
        });
    });

    describe("createOrgAuthProvider", async () => {
        it("should create org-level provider", async () => {
            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            await service.createOrgAuthProvider(currentUser.id, newOrgEntry());

            const providers = await service.getAllAuthProviderParams();
            expect(providers).to.have.lengthOf(1);
            expect(providers[0]).to.deep.include(expectedOrgParams());
        });
        it("should fail if host is not reachable", async () => {
            await expectError(
                ErrorCodes.BAD_REQUEST,
                service.createOrgAuthProvider(currentUser.id, {
                    ...newOrgEntry(),
                    host: "please-dont-register-this-domain.com:666",
                }),
            );
        });
        it("should fail if trying to register same host", async () => {
            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            await service.createOrgAuthProvider(currentUser.id, newOrgEntry());

            await expectError(ErrorCodes.CONFLICT, service.createAuthProviderOfUser(currentUser.id, newOrgEntry()));
        });
    });
    describe("getAuthProvider", async () => {
        it("should find org-level provider", async () => {
            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            const created = await service.createOrgAuthProvider(currentUser.id, newOrgEntry());

            const retrieved = await service.getAuthProvider(currentUser.id, created.id);
            expect(retrieved).to.deep.include(expectedOrgEntry());
        });
        it("should find user-level provider", async () => {
            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            const created = await service.createAuthProviderOfUser(currentUser.id, newEntry());

            const retrieved = await service.getAuthProvider(currentUser.id, created.id);
            expect(retrieved).to.deep.include(expectedEntry());
        });
        it("should not find org-level provider for non-members", async () => {
            const providersAtStart = await service.getAllAuthProviderParams();
            expect(providersAtStart).to.be.empty;

            const created = await service.createOrgAuthProvider(currentUser.id, newOrgEntry());

            const nonMember = await userService.createUser({
                identity: {
                    authId: "gh-user-2",
                    authName: "user2",
                    authProviderId: "public-github",
                },
            });

            // expecting 404, as Orgs shall not be enumerable to non-members
            await expectError(ErrorCodes.NOT_FOUND, service.getAuthProvider(nonMember.id, created.id));
        });
    });

    describe("getAuthProviderDescriptionsUnauthenticated", async () => {
        it("should find built-in provider", async () => {
            addBuiltInProvider();

            const providers = await service.getAuthProviderDescriptionsUnauthenticated();
            expect(providers).to.has.lengthOf(1);
            expect(providers[0].authProviderId).to.be.equal("Public-GitHub");
        });
        it("should find only built-in providers but no user-level providers", async () => {
            addBuiltInProvider("localhost");

            const created = await service.createAuthProviderOfUser(currentUser.id, newEntry());
            await service.markAsVerified({ userId: currentUser.id, id: created.id });

            const providers = await service.getAuthProviderDescriptionsUnauthenticated();
            expect(providers).to.has.lengthOf(1);
            expect(providers[0].host).to.be.equal("localhost");
        });
        it("should find user-level providers if no built-in providers present", async () => {
            const created = await service.createAuthProviderOfUser(currentUser.id, newEntry());
            await service.markAsVerified({ userId: currentUser.id, id: created.id });

            const providers = await service.getAuthProviderDescriptionsUnauthenticated();
            expect(providers).to.has.lengthOf(1);
            expect(providers[0]).to.deep.include(<Partial<AuthProviderInfo>>{
                authProviderId: created.id,
                authProviderType: created.type,
                host: created.host,
            });

            const privateProperties: (keyof AuthProviderEntry)[] = ["oauth", "organizationId", "ownerId"];
            for (const privateProperty of privateProperties) {
                expect(providers[0]).to.not.haveOwnProperty(privateProperty);
            }
        });
    });

    describe("getAuthProviderDescriptions", async () => {
        it("should find built-in provider", async () => {
            addBuiltInProvider();

            const providers = await service.getAuthProviderDescriptions(currentUser);
            expect(providers).to.has.lengthOf(1);
            expect(providers[0].authProviderId).to.be.equal("Public-GitHub");
        });
        it("should find built-in providers and _own_ user-level providers", async () => {
            addBuiltInProvider("localhost");

            const created = await service.createAuthProviderOfUser(currentUser.id, newEntry());
            await service.markAsVerified({ userId: currentUser.id, id: created.id });

            const providers = await service.getAuthProviderDescriptions(currentUser);
            expect(providers).to.has.lengthOf(2);
            expect(providers[0].host).to.be.equal(created.host);
            expect(providers[1].host).to.be.equal("localhost");
        });
        it("should find user-level providers if no built-in providers present", async () => {
            const created = await service.createAuthProviderOfUser(currentUser.id, newEntry());
            await service.markAsVerified({ userId: currentUser.id, id: created.id });

            const providers = await service.getAuthProviderDescriptions(currentUser);
            expect(providers).to.has.lengthOf(1);
            expect(providers[0]).to.deep.include(<Partial<AuthProviderInfo>>{
                authProviderId: created.id,
                authProviderType: created.type,
                host: created.host,
                organizationId: created.organizationId,
                ownerId: created.ownerId,
            });

            const oauthProperty: keyof AuthProviderEntry = "oauth";
            expect(providers[0]).to.not.haveOwnProperty(oauthProperty);
        });
        it("as regular member, should find org-level providers if no built-in providers present", async () => {
            const member = await userService.createUser({
                identity: {
                    authId: "gh-user-2",
                    authName: "user2",
                    authProviderId: "public-github",
                },
            });
            const invite = await orgService.getOrCreateInvite(currentUser.id, org.id);
            await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, invite.id));

            const created = await service.createOrgAuthProvider(currentUser.id, newOrgEntry());
            await service.markAsVerified({ userId: currentUser.id, id: created.id });

            const providers = await service.getAuthProviderDescriptions(member);

            expect(providers).to.has.lengthOf(1);
            expect(providers[0]).to.deep.include(<Partial<AuthProviderInfo>>{
                authProviderId: created.id,
                authProviderType: created.type,
                host: created.host,
                organizationId: created.organizationId,
                ownerId: created.ownerId,
            });

            const oauthProperty: keyof AuthProviderEntry = "oauth";
            expect(providers[0]).to.not.haveOwnProperty(oauthProperty);
        });
        it("as regular member, should find only built-in providers if present", async () => {
            addBuiltInProvider("localhost");

            const member = await userService.createUser({
                identity: {
                    authId: "gh-user-2",
                    authName: "user2",
                    authProviderId: "public-github",
                },
            });
            const invite = await orgService.getOrCreateInvite(currentUser.id, org.id);
            await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, invite.id));

            const created = await service.createOrgAuthProvider(currentUser.id, newOrgEntry());
            await service.markAsVerified({ userId: currentUser.id, id: created.id });

            const providers = await service.getAuthProviderDescriptions(member);

            expect(providers).to.has.lengthOf(1);
            expect(providers[0].host).to.be.equal("localhost");
        });
    });

    describe("updateAuthProvider", async () => {
        it("should update user-level provider", async () => {
            const created = await service.createAuthProviderOfUser(currentUser.id, newEntry());
            const someRandomString = String(Date.now());
            const updatedClientId = await service.updateAuthProviderOfUser(currentUser.id, {
                id: created.id,
                ownerId: currentUser.id,
                clientId: someRandomString,
            });
            expect(updatedClientId.oauth?.clientId).to.be.equal(someRandomString);
            expect(updatedClientId.oauthRevision).to.be.not.equal(created.oauthRevision);

            const updatedClientSecret = await service.updateAuthProviderOfUser(currentUser.id, {
                id: created.id,
                ownerId: currentUser.id,
                clientSecret: String(Date.now()),
            });
            expect(updatedClientSecret.oauthRevision).to.be.not.equal(updatedClientId.oauthRevision);
        });
        it("should fail if permissions do not permit", async () => {
            const created = await service.createAuthProviderOfUser(currentUser.id, newEntry());
            await expectError(
                ErrorCodes.NOT_FOUND,
                service.updateAuthProviderOfUser("some-stranger", {
                    id: created.id,
                    ownerId: currentUser.id,
                    clientId: "any",
                }),
            );
        });
        it("should update org-level provider", async () => {
            const created = await service.createOrgAuthProvider(currentUser.id, newOrgEntry());
            const someRandomString = String(Date.now());
            const updatedClientId = await service.updateOrgAuthProvider(currentUser.id, {
                id: created.id,
                organizationId: org.id,
                clientId: someRandomString,
            });
            expect(updatedClientId.oauth?.clientId).to.be.equal(someRandomString);
            expect(updatedClientId.oauthRevision).to.be.not.equal(created.oauthRevision);

            const updatedClientSecret = await service.updateOrgAuthProvider(currentUser.id, {
                id: created.id,
                organizationId: org.id,
                clientSecret: String(Date.now()),
            });
            expect(updatedClientSecret.oauthRevision).to.be.not.equal(updatedClientId.oauthRevision);
        });
        it("should fail if org-permissions do not permit", async () => {
            const created = await service.createOrgAuthProvider(currentUser.id, newOrgEntry());
            await expectError(
                ErrorCodes.NOT_FOUND,
                service.updateOrgAuthProvider("some-stranger", {
                    id: created.id,
                    organizationId: org.id,
                    clientId: "any",
                }),
            );
        });
    });
});
