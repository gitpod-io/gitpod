/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { TypeORM } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { CommitContext, Organization, Project, User, WorkspaceConfig } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { Authorizer, SYSTEM_USER } from "./authorizer";
import { OrganizationService } from "../orgs/organization-service";
import { WorkspaceService } from "../workspace/workspace-service";
import { UserService } from "../user/user-service";
import { ConfigProvider } from "../workspace/config-provider";
import { v1 } from "@authzed/authzed-node";
import { runWithContext } from "../util/request-context";
import { HierachicalZedTokenCache, RequestLocalZedTokenCache } from "./spicedb-authorizer";
import { Redis } from "ioredis";
import { InstallationID } from "./definitions";

const expect = chai.expect;

const withCtx = <T>(p: Promise<T>) => runWithContext("test", {}, () => p);

describe("CachingSpiceDBAuthorizer", async () => {
    let container: Container;
    let userSvc: UserService;
    let orgSvc: OrganizationService;
    let workspaceSvc: WorkspaceService;
    let authorizer: Authorizer;

    beforeEach(async () => {
        container = createTestContainer();
        // TODO(gpl) Ideally we should be able to factor this out into the API. But to start somewhere, we'll mock it out here.
        container.rebind(ConfigProvider).toConstantValue({
            fetchConfig: () => ({
                config: <WorkspaceConfig>{
                    image: "gitpod/workspace-full:latest",
                },
            }),
        } as any as ConfigProvider);
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        userSvc = container.get<UserService>(UserService);
        orgSvc = container.get<OrganizationService>(OrganizationService);
        workspaceSvc = container.get<WorkspaceService>(WorkspaceService);
        authorizer = container.get<Authorizer>(Authorizer);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));

        container.unbindAll();
    });

    it("should avoid new-enemy after removal", async () => {
        // userB and userC are members of org1, userA is owner.
        // All users are installation owned.
        const org1 = await withCtx(orgSvc.createOrganization(SYSTEM_USER, "org1"));
        const userA = await withCtx(
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "123",
                    authName: "userA",
                },
            }),
        );
        await withCtx(orgSvc.addOrUpdateMember(SYSTEM_USER, org1.id, userA.id, "owner"));
        const userB = await withCtx(
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "456",
                    authName: "userB",
                },
            }),
        );
        await withCtx(orgSvc.addOrUpdateMember(SYSTEM_USER, org1.id, userB.id, "member"));
        const userC = await withCtx(
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "789",
                    authName: "userC",
                },
            }),
        );
        await withCtx(orgSvc.addOrUpdateMember(SYSTEM_USER, org1.id, userC.id, "member"));

        // userA creates a workspace when userB is still member of the org
        // All members have "read_info" (derived from membership)
        const ws1 = await withCtx(createTestWorkspace(org1, userA));

        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userB.id, "read_info", ws1.id)),
            "userB should have read_info after removal",
        ).to.be.true;
        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
            "userC should have read_info after removal of userB",
        ).to.be.true;

        // userB is removed from the org
        await withCtx(orgSvc.removeOrganizationMember(SYSTEM_USER, org1.id, userB.id));

        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userB.id, "read_info", ws1.id)),
            "userB should have read_info after removal",
        ).to.be.false;
        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
            "userC should have read_info after removal of userB",
        ).to.be.true;
    });

    async function createTestWorkspace(org: Organization, owner: User, project?: Project) {
        const ws = await workspaceSvc.createWorkspace(
            {},
            owner,
            org.id,
            project,
            <CommitContext>{
                title: "gitpod",
                repository: {
                    host: "github.com",
                    owner: "gitpod-io",
                    name: "gitpod",
                    cloneUrl: "https://github.com/gitpod-io/gitpod.git",
                },
                revision: "asdf",
            },
            "github.com/gitpod-io/gitpod",
        );
        return ws;
    }

    it("should avoid read-your-writes problem when adding a new user", async () => {
        // userB and userC are members of org1, userA is owner.
        // All users are installation owned.
        const org1 = await withCtx(orgSvc.createOrganization(SYSTEM_USER, "org1"));
        const userA = await withCtx(
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "123",
                    authName: "userA",
                },
            }),
        );
        await withCtx(orgSvc.addOrUpdateMember(SYSTEM_USER, org1.id, userA.id, "owner"));
        const userC = await withCtx(
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "789",
                    authName: "userC",
                },
            }),
        );
        await withCtx(orgSvc.addOrUpdateMember(SYSTEM_USER, org1.id, userC.id, "member"));

        // userA creates a workspace before userB is member of the org
        const ws1 = await withCtx(createTestWorkspace(org1, userA));

        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
            "userC should have read_info after removal of userB",
        ).to.be.true;

        // userB is added to the org
        const userB = await withCtx(
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "456",
                    authName: "userB",
                },
            }),
        );
        await withCtx(orgSvc.addOrUpdateMember(SYSTEM_USER, org1.id, userB.id, "member"));

        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userB.id, "read_info", ws1.id)),
            "userB should have read_info after removal",
        ).to.be.true;
        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withCtx(authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
            "userC should have read_info after removal of userB",
        ).to.be.true;
    });
});

describe("RequestLocalZedTokenCache", async () => {
    let cache: RequestLocalZedTokenCache;

    const rawToken1 = "GhUKEzE2OTY0MjI3NzY1Njc3Mzc0MjQ=";
    const rawToken2 = "GhUKEzE2OTY5Mjg1Nzg1NjIyNjYzMTE=";
    const rawToken3 = "GhUKEzE2OTY5Mjg1Nzg1NjgwMTE3MzM=";
    const ws1 = v1.ObjectReference.create({
        objectType: "workspace",
        objectId: "ws1",
    });

    beforeEach(async () => {
        cache = new RequestLocalZedTokenCache();
    });

    it("should store token", async () => {
        await runWithContext("test", {}, async () => {
            expect(await cache.get(undefined, ws1)).to.be.undefined;
            await cache.set([ws1, rawToken1]);
            expect(await cache.get(undefined, ws1)).to.equal(rawToken1);
        });
    });

    it("should return newest token", async () => {
        await runWithContext("test", {}, async () => {
            await cache.set([ws1, rawToken1]);
            await cache.set([ws1, rawToken2]);
            expect(await cache.get(undefined, ws1)).to.equal(rawToken2);
            await cache.set([ws1, rawToken3]);
            expect(await cache.get(undefined, ws1)).to.equal(rawToken3);
        });
    });

    it("should clear cache", async () => {
        await runWithContext("test", {}, async () => {
            await cache.set([ws1, rawToken1]);
            expect(await cache.get(undefined, ws1)).to.equal(rawToken1);
            await cache.set([ws1, undefined]); // this should trigger a clear
            expect(await cache.get(undefined, ws1)).to.be.undefined;
        });
    });
});

describe("HierachicalZedTokenCache", async () => {
    let container: Container;
    let cut: HierachicalZedTokenCache;

    const rawToken1 = "GhUKEzE2OTY0MjI3NzY1Njc3Mzc0MjQ=";
    const rawToken2 = "GhUKEzE2OTY5Mjg1Nzg1NjIyNjYzMTE=";
    const rawToken3 = "GhUKEzE2OTY5Mjg1Nzg1NjgwMTE3MzM=";

    const installation1 = v1.ObjectReference.create({
        objectType: "installation",
        objectId: InstallationID,
    });
    const org1 = v1.ObjectReference.create({
        objectType: "organization",
        objectId: "org1",
    });
    const ws1 = v1.ObjectReference.create({
        objectType: "workspace",
        objectId: "ws1",
    });
    const ws2 = v1.ObjectReference.create({
        objectType: "workspace",
        objectId: "ws2",
    });
    const ws3 = v1.ObjectReference.create({
        objectType: "workspace",
        objectId: "ws3",
    });
    const ws4 = v1.ObjectReference.create({
        objectType: "workspace",
        objectId: "ws4",
    });

    beforeEach(async () => {
        container = createTestContainer();
        const redis = container.get<Redis>(Redis);
        cut = new HierachicalZedTokenCache(redis);
    });

    afterEach(async () => {
        container.unbindAll();
    });

    it("should store token with proper consistency guarantee", async () => {
        expect(await cut.set([ws1, rawToken1])).to.be.true;
        expect(await cut.set([ws2, rawToken2])).to.be.true;
        expect(await cut.set([ws3, rawToken3])).to.be.true;
        expect(await cut.set([ws4, rawToken3])).to.be.true;
    });

    it("should not return a token if consistency is not guaranteed", async () => {
        await cut.set([ws1, rawToken1]);
        expect(await cut.get(undefined, org1)).to.be.undefined;
        await cut.set([ws1, rawToken1]);
        expect(await cut.get(undefined, org1)).to.be.undefined;
    });

    it("should return a token only if consistency is guaranteed", async () => {
        // prep the cache to the fully hierarchy is known
        await cut.set([installation1, rawToken1]);
        await cut.set([org1, rawToken2]);
        await cut.set([ws1, rawToken3]);

        expect(await cut.get(undefined, ws1), "unqualified get must always fail").to.be.undefined;
        expect(await cut.get(org1, ws1), "qualified read should succeed now").to.eq(rawToken3);
    });

    it("should handle member added", async () => {
        await cut.set([installation1, rawToken1]);
        await cut.set([org1, rawToken1]);
        await cut.set([ws1, rawToken1]);

        // can read ws1? Yes.
        expect(await cut.get(org1, ws1)).to.eq(rawToken1);

        // member list is updated: this should make sure we never access child resources with rawToken1 again
        await cut.set([org1, rawToken2]);
        expect(await cut.get(org1, ws1)).to.not.eq(rawToken1);
    });
});
