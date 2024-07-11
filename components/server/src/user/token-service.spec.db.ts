/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import "mocha";
import { Container } from "inversify";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { OrganizationService } from "../orgs/organization-service";
import { SYSTEM_USER } from "../authorization/authorizer";
import { UserService } from "./user-service";
import { Organization, Token, User } from "@gitpod/gitpod-protocol";
import { TokenService } from "./token-service";
import { TokenProvider } from "./token-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { AuthProvider } from "../auth/auth-provider";
import { HostContext } from "../auth/host-context";

const expect = chai.expect;

describe("TokenService", async () => {
    const githubAuthProviderId = "Public-GitHub";
    const githubAuthProviderHost = "github.com";
    const githubUserAuthId = "github-authid";
    const bbsAuthProviderId = "bitbucket-example-org";
    const bbsAuthProviderHost = "bitbucket.example.org";
    const bbsUserAuthId = "bbs-authid";

    let container: Container;
    let tokenService: TokenService;
    let userService: UserService;
    let userDB: UserDB;
    let orgService: OrganizationService;
    let org: Organization;
    let owner: User;
    let user: User;

    let token: Token;

    const date0h = new Date("2020-01-01T00:00:00.000Z");
    const date1h30m = new Date("2020-01-01T01:30:00.000Z");
    const date1h = new Date("2020-01-01T01:00:00.000Z");
    const date2h = new Date("2020-01-01T02:00:00.000Z");
    const date3h = new Date("2020-01-01T03:00:00.000Z");
    // const date4h = new Date("2020-01-01T04:00:00.000Z");

    let mockedDate: Date;
    let globalDateCtor: DateConstructor;
    class MockDate extends Date {
        constructor(value: number | string | Date | undefined) {
            if (!value) {
                super(mockedDate);
            } else {
                super(value);
            }
        }

        now() {
            return mockedDate.getTime();
        }
    }

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});

        // re-overwrite the stuff mocked out in createTestContainer
        container.rebind(TokenProvider).toService(TokenService);
        container.rebind(HostContextProvider).toConstantValue({
            get: (host: string) => {
                switch (host) {
                    case githubAuthProviderHost: {
                        return <HostContext>{
                            authProvider: <AuthProvider>{
                                authProviderId: githubAuthProviderId,
                                info: {
                                    authProviderId: githubAuthProviderId,
                                    authProviderType: "GitHub",
                                    host: githubAuthProviderHost,
                                },
                                refreshToken: async (user: User, requestedLifetimeDate: Date) => {
                                    return refreshedToken(requestedLifetimeDate);
                                },
                            },
                            services: {
                                repositoryProvider: {
                                    hasReadAccess: async (user: any, owner: string, repo: string) => {
                                        return true;
                                    },
                                },
                            },
                        };
                    }
                    case bbsAuthProviderHost: {
                        return <HostContext>{
                            authProvider: <AuthProvider>{
                                authProviderId: bbsAuthProviderId,
                                info: {
                                    authProviderId: bbsAuthProviderId,
                                    authProviderType: "BitbucketServer",
                                    host: bbsAuthProviderHost,
                                },
                                refreshToken: async (user: User, requestedLifetimeDate: Date) => {
                                    return refreshedToken(requestedLifetimeDate);
                                },
                                requiresOpportunisticRefresh: () => {
                                    return true;
                                },
                            },
                            services: {
                                repositoryProvider: {
                                    hasReadAccess: async (user: any, owner: string, repo: string) => {
                                        return true;
                                    },
                                },
                            },
                        };
                    }
                }
            },
        });

        tokenService = container.get<TokenService>(TokenService);
        userDB = container.get<UserDB>(UserDB);
        userService = container.get<UserService>(UserService);
        orgService = container.get<OrganizationService>(OrganizationService);
        org = await orgService.createOrganization(BUILTIN_INSTLLATION_ADMIN_USER_ID, "myOrg");
        const invite = await orgService.getOrCreateInvite(BUILTIN_INSTLLATION_ADMIN_USER_ID, org.id);
        // first not builtin user join an org will be an owner
        owner = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });
        await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(owner.id, invite.id));

        user = await userService.createUser({
            organizationId: org.id,
            identity: {
                authId: githubUserAuthId,
                authName: "github-authname",
                authProviderId: githubAuthProviderId,
                primaryEmail: "yolo@yolo.com",
            },
        });
        user.identities.push({
            authId: bbsUserAuthId,
            authName: "bbs-authname",
            authProviderId: bbsAuthProviderId,
            primaryEmail: "yolo@yolo.com",
        });
        await userDB.storeUser(user);
        await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(user.id, invite.id));

        // test data
        token = <Token>{
            scopes: ["repo"],
            value: "token",
            updateDate: date0h.toISOString(),
            expiryDate: date2h.toISOString(),
            reservedUntilDate: undefined,
            refreshToken: "refresh-token",
            username: "username",
        };
        await userDB.storeSingleToken({ authId: githubUserAuthId, authProviderId: githubAuthProviderId }, token);
        await userDB.storeSingleToken({ authId: bbsUserAuthId, authProviderId: bbsAuthProviderId }, token);

        globalDateCtor = global.Date;
        global.Date = MockDate as any as DateConstructor;
        setTime(date0h);
    });

    function refreshedToken(requestedLifetimeDate: Date): Token {
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setTime(now.getTime() + 2 * 60 * 60 * 1000);
        return {
            scopes: ["repo"],
            value: "refreshed-token",
            updateDate: now.toISOString(),
            expiryDate: expiryDate.toISOString(),
            reservedUntilDate: requestedLifetimeDate.toISOString(),
            refreshToken: "refreshed-refresh-token",
            username: "refreshed-username",
        };
    }

    afterEach(async () => {
        const typeorm = container.get(TypeORM);
        await resetDB(typeorm);
        // Deactivate all services
        await container.unbindAllAsync();
        global.Date = globalDateCtor;
    });

    function setTime(date: Date) {
        mockedDate = date;
    }

    it("getTokenForHost - still valid", async () => {
        setTime(date1h);

        const actual = await tokenService.getTokenForHost(user, githubAuthProviderHost);
        const expectation = <Token>{
            scopes: ["repo"],
            value: "token",
            updateDate: "2020-01-01T00:00:00.000Z",
            expiryDate: "2020-01-01T02:00:00.000Z",
            reservedUntilDate: "2020-01-01T01:05:00.000Z",
            refreshToken: "refresh-token",
            username: "username",
        };
        expect(actual).to.deep.equal(expectation);
    });

    it("getTokenForHost - needs refresh", async () => {
        setTime(date3h);

        const actual = await tokenService.getTokenForHost(user, githubAuthProviderHost);
        const expectation = <Token>{
            scopes: ["repo"],
            value: "refreshed-token",
            updateDate: "2020-01-01T03:00:00.000Z",
            expiryDate: "2020-01-01T05:00:00.000Z",
            reservedUntilDate: "2020-01-01T03:05:00.000Z",
            refreshToken: "refreshed-refresh-token",
            username: "refreshed-username",
        };
        expect(actual).to.deep.equal(expectation);
    });

    it("getTokenForHost - still valid, with opportunistic refresh", async () => {
        setTime(date1h);

        // Bitbucket Server requires opportunistic refresh
        const actual = await tokenService.getTokenForHost(user, bbsAuthProviderHost);
        const expectation = <Token>{
            scopes: ["repo"],
            value: "refreshed-token",
            updateDate: "2020-01-01T01:00:00.000Z",
            expiryDate: "2020-01-01T03:00:00.000Z",
            reservedUntilDate: "2020-01-01T01:05:00.000Z",
            refreshToken: "refreshed-refresh-token",
            username: "refreshed-username",
        };
        expect(actual).to.deep.equal(expectation);
    });

    it("getTokenForHost - still valid and reserved, no opportunistic refresh", async () => {
        setTime(date1h);
        const te = await userDB.findTokenEntryForIdentity({
            authId: bbsUserAuthId,
            authName: "llala",
            authProviderId: bbsAuthProviderId,
        });
        // Token is reserved for 30 minutes
        await userDB.updateTokenEntry({ uid: te!.uid, reservedUntilDate: date1h30m.toISOString() });

        // Bitbucket Server requires opportunistic refresh
        const actual = await tokenService.getTokenForHost(user, bbsAuthProviderHost);
        const expectation = <Token>{
            scopes: ["repo"],
            value: "token",
            updateDate: "2020-01-01T00:00:00.000Z",
            expiryDate: "2020-01-01T02:00:00.000Z",
            reservedUntilDate: "2020-01-01T01:30:00.000Z",
            refreshToken: "refresh-token",
            username: "username",
        };
        expect(actual).to.deep.equal(expectation);
    });

    it("getTokenForHost - still valid and reserved, no opportunistic refresh, but extended reservation", async () => {
        setTime(date1h);
        const te = await userDB.findTokenEntryForIdentity({
            authId: bbsUserAuthId,
            authName: "llala",
            authProviderId: bbsAuthProviderId,
        });
        // Token is reserved for 3 minutes
        await userDB.updateTokenEntry({ uid: te!.uid, reservedUntilDate: "2020-01-01T01:03:00.000Z" });

        // Bitbucket Server requires opportunistic refresh
        const actual = await tokenService.getTokenForHost(user, bbsAuthProviderHost);
        const expectation = <Token>{
            scopes: ["repo"],
            value: "token",
            updateDate: "2020-01-01T00:00:00.000Z",
            expiryDate: "2020-01-01T02:00:00.000Z",
            reservedUntilDate: "2020-01-01T01:05:00.000Z", // reservation extended to 5 minutes
            refreshToken: "refresh-token",
            username: "username",
        };
        expect(actual).to.deep.equal(expectation);
    });
});
