/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import {
    CommitContext,
    Organization,
    Project,
    User,
    Workspace as ProtocolWorkspace,
    Snapshot,
    WorkspaceContext,
    StartPrebuildResult,
    SnapshotContext,
    PrebuiltWorkspaceContext,
} from "@gitpod/gitpod-protocol";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { OrganizationService } from "../orgs/organization-service";
import { createTestContainer, withTestCtx } from "../test/service-testing-container-module";
import { WorkspaceService } from "./workspace-service";
import { ProjectsService } from "../projects/projects-service";
import { UserService } from "../user/user-service";
import { SnapshotService } from "./snapshot-service";
import { ContextService } from "./context-service";
import { ContextParser } from "./context-parser-service";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { ConfigProvider } from "./config-provider";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { HostContextProvider } from "../auth/host-context-provider";
import { AuthProvider } from "../auth/auth-provider";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { SYSTEM_USER } from "../authorization/authorizer";

const expect = chai.expect;

const gitpodEmptyContext = {
    ref: "main",
    refType: "branch",
    path: "",
    isFile: false,
    repo: "",
    repository: {
        host: "github.com",
        owner: "gitpod-io",
        name: "empty",
        cloneUrl: "https://github.com/gitpod-io/empty.git",
        defaultBranch: "main",
        private: false,
    },
    normalizedContextURL: "https://github.com/gitpod-io/empty",
    revision: "asdf",
    title: "gitpod-io/empty - main",
};

const SNAPSHOT_BUCKET = "https://gitpod.io/none-bucket";

describe("ContextService", async () => {
    let container: Container;
    let owner: User;
    let member: User;
    let stranger: User;
    let org: Organization;
    let org2: Organization;
    let project: Project;
    let workspace: ProtocolWorkspace;
    let snapshot: Snapshot;
    let snapshot_stranger: Snapshot;
    let prebuild: StartPrebuildResult;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        container.rebind(ConfigProvider).toConstantValue({
            fetchConfig: () => {
                return {
                    config: {
                        image: "gitpod/workspace-base",
                    },
                };
            },
        } as any as ConfigProvider);

        const bindContextParser = () => {
            container.rebind(ContextParser).toConstantValue({
                normalizeContextURL: function (contextURL: string): string {
                    return contextURL + "normalizeContextURL";
                },
                handle: function (ctx: TraceContext, user: User, contextURL: string): Promise<WorkspaceContext> {
                    const url = contextURL.replace("normalizeContextURL", "");
                    switch (url) {
                        case "https://github.com/gitpod-io/empty":
                            return gitpodEmptyContext as any;
                        case `open-prebuild/${prebuild.prebuildId}/https://github.com/gitpod-io/empty/tree/main`:
                            return {
                                ...gitpodEmptyContext,
                                openPrebuildID: prebuild.prebuildId,
                            } as any;
                        case `snapshot/${snapshot.id}`: {
                            return {
                                ...gitpodEmptyContext,
                                snapshotId: snapshot.id,
                                snapshotBucketId: SNAPSHOT_BUCKET,
                            } as any;
                        }
                        case `snapshot/${snapshot_stranger.id}`: {
                            return {
                                ...gitpodEmptyContext,
                                snapshotId: snapshot_stranger.id,
                                snapshotBucketId: SNAPSHOT_BUCKET,
                            } as any;
                        }
                        default:
                            return {
                                ref: "master",
                            } as any;
                    }
                },
            } as any as ContextParser);
        };

        bindContextParser();

        container.rebind(HostContextProvider).toConstantValue({
            get: () => {
                const authProviderId = "Public-GitHub";
                return {
                    authProvider: <AuthProvider>{
                        authProviderId,
                        info: {
                            authProviderId,
                            authProviderType: "GitHub",
                        },
                    },
                    services: {
                        repositoryProvider: {
                            hasReadAccess: async (user: any, owner: string, repo: string) => {
                                return true;
                            },
                            getBranch: () => {
                                return {
                                    url: "https://github.com/gitpod-io/empty.git",
                                    name: "main",
                                    htmlUrl: "https://github.com/gitpod-io/empty",
                                    commit: {},
                                };
                            },
                            getRepo: () => {
                                return {
                                    defaultBranch: "main",
                                };
                            },
                            getCommitHistory: () => {
                                return [];
                            },
                            getCommitInfo: () => {
                                return undefined;
                            },
                        },
                    },
                };
            },
        });

        const dataInit = async () => {
            const userService = container.get(UserService);
            // create the owner
            owner = await userService.createUser({
                identity: {
                    authId: "33891423",
                    authName: "owner",
                    authProviderId: "Public-GitHub",
                },
            });

            // create the org
            const orgService = container.get(OrganizationService);
            org = await orgService.createOrganization(owner.id, "my-org");

            // create and add a member
            member = await userService.createUser({
                identity: {
                    authId: "33891424",
                    authName: "member",
                    authProviderId: "Public-GitHub",
                },
            });
            const invite = await orgService.getOrCreateInvite(owner.id, org.id);
            await withTestCtx(SYSTEM_USER, () => orgService.joinOrganization(member.id, invite.id));

            // create a project
            const projectService = container.get(ProjectsService);
            project = await projectService.createProject(
                {
                    name: "my-project",
                    slug: "my-project",
                    teamId: org.id,
                    cloneUrl: "https://github.com/gitpod-io/empty",
                    appInstallationId: "noid",
                },
                owner,
                {
                    prebuilds: {
                        enable: true,
                        branchMatchingPattern: "**",
                        prebuildInterval: 20,
                        branchStrategy: "all-branches",
                    },
                },
            );

            // create a stranger
            stranger = await userService.createUser({
                identity: {
                    authId: "33891425",
                    authName: "stranger",
                    authProviderId: "Public-GitHub",
                },
            });
            org2 = await orgService.createOrganization(stranger.id, "stranger-org");

            // create a workspace
            const workspaceService = container.get(WorkspaceService);
            workspace = await createTestWorkspace(workspaceService, org, owner, project);

            // take a snapshot
            const snapshotService = container.get(SnapshotService);
            snapshot = await snapshotService.createSnapshot({ workspaceId: workspace.id }, SNAPSHOT_BUCKET);

            // trigger prebuild
            const prebuildManager = container.get(PrebuildManager);
            prebuild = await prebuildManager.triggerPrebuild({}, owner, project.id, "main");

            // create a workspace and snapshot for another user
            const anotherWorkspace = await createTestWorkspace(workspaceService, org2, stranger, project);
            snapshot_stranger = await snapshotService.createSnapshot(
                { workspaceId: anotherWorkspace.id },
                SNAPSHOT_BUCKET,
            );
        };

        await dataInit();

        bindContextParser();
    });

    afterEach(async () => {
        await resetDB(container.get(TypeORM));
        await container.unbindAllAsync();
    });

    it("should parse normal context", async () => {
        const svc = container.get(ContextService);

        const ctx = await svc.parseContext(owner, "https://github.com/gitpod-io/empty", {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        expect(ctx.project?.id).to.equal(project.id);
        expect(CommitContext.is(ctx.context)).to.equal(true);

        expect(ctx.context.ref).to.equal(gitpodEmptyContext.ref);
        expect((ctx.context as CommitContext).revision).to.equal(gitpodEmptyContext.revision);
    });

    it("should parse prebuild context", async () => {
        const svc = container.get(ContextService);
        const ctx = await svc.parseContext(
            owner,
            `open-prebuild/${prebuild.prebuildId}/https://github.com/gitpod-io/empty/tree/main`,
            {
                projectId: project.id,
                organizationId: org.id,
                forceDefaultConfig: false,
            },
        );
        expect(ctx.project?.id).to.equal(project.id);
        expect(PrebuiltWorkspaceContext.is(ctx.context)).to.equal(true);
    });

    it("should parse snapshot context", async () => {
        const svc = container.get(ContextService);
        const ctx = await svc.parseContext(owner, `snapshot/${snapshot.id}`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        expect(ctx.project?.id).to.equal(project.id);
        expect(SnapshotContext.is(ctx.context)).to.equal(true);
    });

    it("it can start workspace base on stranger's snapshot", async () => {
        const svc = container.get(ContextService);
        const ctx = await svc.parseContext(owner, `snapshot/${snapshot_stranger.id}`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        expect(ctx.project?.id).to.equal(project.id);
        expect(SnapshotContext.is(ctx.context)).to.equal(true);
    });
});

async function createTestWorkspace(svc: WorkspaceService, org: Organization, owner: User, project: Project) {
    const ws = await svc.createWorkspace(
        {},
        owner,
        org.id,
        project,
        gitpodEmptyContext as any as CommitContext,
        "github.com/gitpod-io/empty",
        undefined,
    );
    return ws;
}
