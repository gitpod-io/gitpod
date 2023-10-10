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
import { Authorizer } from "./authorizer";
import { OrganizationService } from "../orgs/organization-service";
import { WorkspaceService } from "../workspace/workspace-service";
import { UserService } from "../user/user-service";
import { ZedTokenCache } from "./caching-spicedb-authorizer";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { ConfigProvider } from "../workspace/config-provider";
import { runWithContext } from "../util/log-context";
import { SYSTEM_USER } from "./definitions";

const expect = chai.expect;

const withCtx = <T>(p: Promise<T>) => runWithContext("test", {}, () => p);

describe("CachingSpiceDBAuthorizer", async () => {
    let container: Container;
    let userSvc: UserService;
    let orgSvc: OrganizationService;
    let workspaceSvc: WorkspaceService;
    let authorizer: Authorizer;
    let zedTokenCache: ZedTokenCache;

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
        zedTokenCache = container.get<ZedTokenCache>(ZedTokenCache);
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

        // INTERNALS
        async function printTokens(): Promise<{ ws1Token: string | undefined; org1Token: string | undefined }> {
            const ws1Token = await zedTokenCache.get({ objectType: "workspace", objectId: ws1.id });
            log.info("ws1Token", ws1Token);
            const org1Token = await zedTokenCache.get({ objectType: "organization", objectId: org1.id });
            log.info("org1Token", org1Token);
            return { ws1Token, org1Token };
        }
        const { org1Token: org1TokenT1 } = await printTokens();

        // userB is removed from the org
        await withCtx(orgSvc.removeOrganizationMember(SYSTEM_USER, org1.id, userB.id));

        // INTERNALS
        const { org1Token: org1TokenT2 } = await printTokens();
        expect(org1TokenT1 === org1TokenT2 && org1TokenT1 !== undefined && org1TokenT2 !== undefined).to.be.false;

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
