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
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { Authorizer, SYSTEM_USER, SYSTEM_USER_ID } from "./authorizer";
import { OrganizationService } from "../orgs/organization-service";
import { WorkspaceService } from "../workspace/workspace-service";
import { UserService } from "../user/user-service";
import { ConfigProvider } from "../workspace/config-provider";
import { v1 } from "@authzed/authzed-node";
import { RequestLocalZedTokenCache } from "./spicedb-authorizer";

const expect = chai.expect;

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
        Experiments.configureTestingClient({});
        userSvc = container.get<UserService>(UserService);
        orgSvc = container.get<OrganizationService>(OrganizationService);
        workspaceSvc = container.get<WorkspaceService>(WorkspaceService);
        authorizer = container.get<Authorizer>(Authorizer);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));

        await container.unbindAllAsync();
    });

    it("should avoid new-enemy after removal", async () => {
        // userB and userC are members of org1, userA is owner.
        // All users are installation owned.
        const userA = await withTestCtx(SYSTEM_USER, () =>
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "123",
                    authName: "userA",
                },
            }),
        );
        const org1 = await withTestCtx(userA, () => orgSvc.createOrganization(userA.id, "org1"));
        await withTestCtx(SYSTEM_USER, () => orgSvc.addOrUpdateMember(SYSTEM_USER_ID, org1.id, userA.id, "owner"));
        const userB = await withTestCtx(SYSTEM_USER, () =>
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "456",
                    authName: "userB",
                },
            }),
        );
        await withTestCtx(SYSTEM_USER, () => orgSvc.addOrUpdateMember(SYSTEM_USER_ID, org1.id, userB.id, "member"));
        const userC = await withTestCtx(SYSTEM_USER, () =>
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "789",
                    authName: "userC",
                },
            }),
        );
        await withTestCtx(SYSTEM_USER, () => orgSvc.addOrUpdateMember(SYSTEM_USER_ID, org1.id, userC.id, "member"));

        // userA creates a workspace when userB is still member of the org
        // All members have "read_info" (derived from membership)
        const ws1 = await withTestCtx(userA, () => createTestWorkspace(org1, userA));

        expect(
            await withTestCtx(userB, () => authorizer.hasPermissionOnWorkspace(userB.id, "read_info", ws1.id)),
            "userB should have read_info after removal",
        ).to.be.true;
        expect(
            await withTestCtx(userA, () => authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withTestCtx(userC, () => authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
            "userC should have read_info after removal of userB",
        ).to.be.true;

        // userB is removed from the org
        await withTestCtx(SYSTEM_USER, () => orgSvc.removeOrganizationMember(SYSTEM_USER_ID, org1.id, userB.id));

        expect(
            await withTestCtx(userB, () => authorizer.hasPermissionOnWorkspace(userB.id, "read_info", ws1.id)),
            "userB should have read_info after removal",
        ).to.be.false;
        expect(
            await withTestCtx(userA, () => authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withTestCtx(userC, () => authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
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
            undefined,
        );
        return ws;
    }

    it("should avoid read-your-writes problem when adding a new user", async () => {
        // userB and userC are members of org1, userA is owner.
        // All users are installation owned.
        const userA = await withTestCtx(SYSTEM_USER, () =>
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "123",
                    authName: "userA",
                },
            }),
        );
        const org1 = await withTestCtx(userA, () => orgSvc.createOrganization(userA.id, "org1"));
        await withTestCtx(SYSTEM_USER, () => orgSvc.addOrUpdateMember(SYSTEM_USER_ID, org1.id, userA.id, "owner"));
        const userC = await withTestCtx(SYSTEM_USER, () =>
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "789",
                    authName: "userC",
                },
            }),
        );
        await withTestCtx(SYSTEM_USER, () => orgSvc.addOrUpdateMember(SYSTEM_USER_ID, org1.id, userC.id, "member"));

        // userA creates a workspace before userB is member of the org
        const ws1 = await withTestCtx(userA, () => createTestWorkspace(org1, userA));

        expect(
            await withTestCtx(SYSTEM_USER, () => authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withTestCtx(userC, () => authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
            "userC should have read_info after removal of userB",
        ).to.be.true;

        // userB is added to the org
        const userB = await withTestCtx(SYSTEM_USER, () =>
            userSvc.createUser({
                organizationId: undefined,
                identity: {
                    authProviderId: "github",
                    authId: "456",
                    authName: "userB",
                },
            }),
        );
        await withTestCtx(SYSTEM_USER, () => orgSvc.addOrUpdateMember(SYSTEM_USER_ID, org1.id, userB.id, "member"));

        expect(
            await withTestCtx(userB, () => authorizer.hasPermissionOnWorkspace(userB.id, "read_info", ws1.id)),
            "userB should have read_info after removal",
        ).to.be.true;
        expect(
            await withTestCtx(userA, () => authorizer.hasPermissionOnWorkspace(userA.id, "read_info", ws1.id)),
            "userA should have read_info after removal of userB",
        ).to.be.true;
        expect(
            await withTestCtx(userC, () => authorizer.hasPermissionOnWorkspace(userC.id, "read_info", ws1.id)),
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

    function fullyConsistent() {
        return v1.Consistency.create({
            requirement: {
                oneofKind: "fullyConsistent",
                fullyConsistent: true,
            },
        });
    }

    function atLeastAsFreshAs(zedToken: string) {
        return v1.Consistency.create({
            requirement: {
                oneofKind: "atLeastAsFresh",
                atLeastAsFresh: v1.ZedToken.create({
                    token: zedToken,
                }),
            },
        });
    }

    beforeEach(async () => {
        cache = new RequestLocalZedTokenCache();
    });

    it("should store token", async () => {
        await withTestCtx(SYSTEM_USER, async () => {
            expect(await cache.get(ws1)).to.be.undefined;
            await cache.set([ws1, rawToken1]);
            expect(await cache.get(ws1)).to.equal(rawToken1);
        });
    });

    it("should return newest token", async () => {
        await withTestCtx(SYSTEM_USER, async () => {
            await cache.set([ws1, rawToken1]);
            await cache.set([ws1, rawToken2]);
            expect(await cache.get(ws1)).to.equal(rawToken2);
            await cache.set([ws1, rawToken3]);
            expect(await cache.get(ws1)).to.equal(rawToken3);
        });
    });

    it("should return proper consistency", async () => {
        await withTestCtx(SYSTEM_USER, async () => {
            expect(await cache.consistency(ws1)).to.deep.equal(fullyConsistent());
            await cache.set([ws1, rawToken1]);
            expect(await cache.consistency(ws1)).to.deep.equal(atLeastAsFreshAs(rawToken1));
        });
    });

    it("should clear cache", async () => {
        await withTestCtx(SYSTEM_USER, async () => {
            await cache.set([ws1, rawToken1]);
            expect(await cache.get(ws1)).to.equal(rawToken1);
            await cache.set([ws1, undefined]); // this should trigger a clear
            expect(await cache.get(ws1)).to.be.undefined;
        });
    });
});
