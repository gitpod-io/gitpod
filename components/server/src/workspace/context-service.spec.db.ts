/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, WorkspaceDB } from "@gitpod/gitpod-db/lib";
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
    Branch,
    CommitInfo,
    Repository,
    RepositoryInfo,
    WorkspaceConfig,
    PrebuiltWorkspaceState,
    PrebuiltWorkspace,
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
import { RepositoryProvider } from "../repohost";

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
    revision: "123456",
    title: "gitpod-io/empty - main",
};

// MockRepositoryProvider is a class implementing the RepositoryProvider interface, which allows to pass in commitHistory and commitInfo as needed

type NamedBranch = Omit<Branch, "commit">;
function toBranch(b: { branch: NamedBranch; commits: CommitInfo[] }): Branch {
    return {
        ...b.branch,
        commit: {
            sha: head(b.commits).sha,
            author: head(b.commits).author,
            commitMessage: head(b.commits).commitMessage,
        },
    };
}
class MockRepositoryProvider implements RepositoryProvider {
    branches: Map<string, { branch: NamedBranch; commits: CommitInfo[] }> = new Map();

    addBranch(branch: Omit<Branch, "commit">, commits: CommitInfo[]) {
        this.branches.set(branch.name, {
            branch,
            commits,
        });
    }

    pushCommit(branch: string, commit: CommitInfo) {
        const b = this.branches.get(branch);
        if (!b) {
            throw new Error("branch not found");
        }
        b.commits.unshift(commit);
    }

    async hasReadAccess(user: any, owner: string, repo: string): Promise<boolean> {
        return true;
    }
    async getBranch(user: User, owner: string, repo: string, branchName: string): Promise<Branch> {
        const branch = this.branches.get(branchName);
        if (!branch) {
            throw new Error("branch not found");
        }
        return toBranch(branch);
    }
    async getRepo(user: User, owner: string, repo: string): Promise<Repository> {
        return {
            host: "github.com",
            owner: "gitpod-io",
            name: "empty",
            cloneUrl: "https://github.com/gitpod-io/empty.git",
            defaultBranch: "main",
        };
    }
    async getCommitHistory(user: User, owner: string, repo: string, ref: string, maxDepth: number): Promise<string[]> {
        const branch = this.branches.get(ref);
        if (branch) {
            return branch.commits.map((c) => c.sha);
        }

        for (const b of this.branches.values()) {
            for (const [i, c] of b.commits.entries()) {
                if (c.sha === ref) {
                    // everything before `ref`
                    return b.commits.slice(i + 1).map((c) => c.sha);
                }
            }
        }
        throw new Error(`ref ${ref} not found`);
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        return headu(this.branches.get(ref)?.commits);
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        return Array.from(this.branches.values()).map((b) => toBranch(b));
    }

    async getUserRepos(user: User): Promise<RepositoryInfo[]> {
        return [];
    }
    async searchRepos(user: User, searchString: string, limit: number): Promise<RepositoryInfo[]> {
        return [];
    }
}

function headu<T>(arr: T[] | undefined): T | undefined {
    if (!arr || arr.length === 0) {
        return undefined;
    }
    return arr[0];
}

function head<T>(arr: T[]): T {
    if (arr.length === 0) {
        throw new Error("empty array");
    }
    return arr[0];
}

const SNAPSHOT_BUCKET = "https://gitpod.io/none-bucket";

describe("ContextService", async () => {
    let container: Container;
    let mockRepositoryProvider: MockRepositoryProvider;
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
            defaultConfig: async (organizationId?: string): Promise<WorkspaceConfig> => {
                return {
                    ports: [],
                    tasks: [],
                    image: "gitpod/workspace-base",
                    ideCredentials: "some-credentials",
                };
            },
            getDefaultImage: async (organizationId?: string): Promise<string> => {
                return "gitpod/workspace-base";
            },
        } as any as ConfigProvider);

        const bindContextParser = () => {
            container.rebind(ContextParser).toConstantValue({
                normalizeContextURL: function (contextURL: string): string {
                    return contextURL + "normalizeContextURL";
                },
                handle: async function (ctx: TraceContext, user: User, contextURL: string): Promise<WorkspaceContext> {
                    const url = contextURL.replace("normalizeContextURL", "");

                    const cases = new Map<string, () => WorkspaceContext>();
                    cases.set("https://github.com/gitpod-io/empty", () => {
                        return gitpodEmptyContext as any;
                    });

                    if (prebuild) {
                        cases.set(
                            `open-prebuild/${prebuild.prebuildId}/https://github.com/gitpod-io/empty/tree/main`,
                            () => {
                                return {
                                    ...gitpodEmptyContext,
                                    openPrebuildID: prebuild.prebuildId,
                                } as any;
                            },
                        );
                    }
                    if (snapshot) {
                        cases.set(`snapshot/${snapshot.id}`, () => {
                            return {
                                ...gitpodEmptyContext,
                                snapshotId: snapshot.id,
                                snapshotBucketId: SNAPSHOT_BUCKET,
                            } as any;
                        });
                    }
                    if (snapshot_stranger) {
                        cases.set(`snapshot/${snapshot_stranger.id}`, () => {
                            return {
                                ...gitpodEmptyContext,
                                snapshotId: snapshot_stranger.id,
                                snapshotBucketId: SNAPSHOT_BUCKET,
                            } as any;
                        });
                    }
                    const c = cases.get(url);
                    if (c) {
                        return c();
                    }

                    async function createCommitContextForBranch(branchName: string): Promise<CommitContext> {
                        const branch = await mockRepositoryProvider.getBranch(user, "gitpod-io", "empty", branchName);
                        const r: CommitContext = {
                            title: branch.commit.commitMessage,
                            ref: branch.name,
                            refType: "branch",
                            revision: branch.commit.sha,
                            repository: await mockRepositoryProvider.getRepo(user, "gitpod-io", "empty"),
                            normalizedContextURL: branch.htmlUrl,
                        };
                        return r;
                    }

                    const branches = await mockRepositoryProvider.getBranches(user, "gitpod-io", "empty");
                    for (const b of branches) {
                        if (b.htmlUrl === url) {
                            return createCommitContextForBranch(b.name);
                        }
                    }
                    for (const [_, b] of mockRepositoryProvider.branches) {
                        for (const commit of b.commits) {
                            const commitContextUrl = `https://github.com/gitpod-io/empty/commit/${commit.sha}`;
                            if (commitContextUrl === url) {
                                const r: CommitContext = {
                                    title: commit.commitMessage,
                                    ref: commit.sha,
                                    refType: "revision",
                                    revision: commit.sha,
                                    repository: await mockRepositoryProvider.getRepo(user, "gitpod-io", "empty"),
                                    normalizedContextURL: commitContextUrl,
                                };
                                return r;
                            }
                        }
                    }
                    return createCommitContextForBranch(gitpodEmptyContext.repository.defaultBranch);
                },
            } as any as ContextParser);
        };

        bindContextParser();

        mockRepositoryProvider = new MockRepositoryProvider();
        mockRepositoryProvider.addBranch({ name: "main", htmlUrl: "https://github.com/gitpod-io/empty/tree/main" }, [
            {
                sha: gitpodEmptyContext.revision,
                author: "some-dude",
                commitMessage: "some message",
            },
        ]);

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
                        repositoryProvider: mockRepositoryProvider,
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

    it("should ignore unfinished prebuild", async () => {
        // prepare test scenario: two prebuilds
        const revision1 = "000000";
        mockRepositoryProvider.addBranch(
            { name: "branch-with-history", htmlUrl: "https://github.com/gitpod-io/empty/tree/branch-with-history" },
            [
                {
                    sha: revision1,
                    author: "some-dude",
                    commitMessage: `commit ${revision1}`,
                },
            ],
        );

        // start two prebuilds: await 1st, fake 2nd to be building
        const prebuildManager = container.get(PrebuildManager);
        const workspaceDb: WorkspaceDB = container.get(WorkspaceDB);
        const prebuild1Result = await prebuildManager.triggerPrebuild({}, owner, project.id, "branch-with-history");
        const prebuild1 = await workspaceDb.findPrebuildByID(prebuild1Result.prebuildId);
        await workspaceDb.storePrebuiltWorkspace({
            ...prebuild1!,
            state: "available",
        });
        const wsAndI = await workspaceDb.findWorkspaceAndInstance(prebuild1!.buildWorkspaceId);
        await workspaceDb.updateInstancePartial(wsAndI!.instanceId, { status: { phase: "stopped" } });

        mockRepositoryProvider.pushCommit("branch-with-history", {
            sha: "111111",
            author: "some-dude",
            commitMessage: "commit 111111",
        });
        const prebuild2Result = await prebuildManager.triggerPrebuild({}, owner, project.id, "branch-with-history");
        // fake prebuild2 to not be done, yet
        const prebuild2 = await workspaceDb.findPrebuildByID(prebuild2Result.prebuildId);
        await workspaceDb.storePrebuiltWorkspace({
            ...prebuild2!,
            state: "building",
        });

        // request a context for the branch (effectively 2nd commit)
        const svc = container.get(ContextService);
        const ctx = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/tree/branch-with-history`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        expect(ctx.project?.id).to.equal(project.id);
        expect(PrebuiltWorkspaceContext.is(ctx.context)).to.equal(true);
        expect((ctx.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.id).to.equal(
            prebuild1Result.prebuildId,
        );
        expect((ctx.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.commit).to.equal(revision1);
    });

    it("should prefer perfect-match prebuild", async () => {
        // prepare test scenario: two prebuilds
        const revision1 = "000000";
        mockRepositoryProvider.addBranch(
            { name: "branch-with-history", htmlUrl: "https://github.com/gitpod-io/empty/tree/branch-with-history" },
            [
                {
                    sha: revision1,
                    author: "some-dude",
                    commitMessage: `commit ${revision1}`,
                },
            ],
        );

        // trigger and "await" prebuilds for both commits.
        const prebuildManager = container.get(PrebuildManager);
        const workspaceDb: WorkspaceDB = container.get(WorkspaceDB);
        const prebuild1Result = await prebuildManager.triggerPrebuild({}, owner, project.id, "branch-with-history");
        const prebuild1 = await workspaceDb.findPrebuildByID(prebuild1Result.prebuildId);
        await workspaceDb.storePrebuiltWorkspace({
            ...prebuild1!,
            state: "available",
        });
        const wsAndI1 = await workspaceDb.findWorkspaceAndInstance(prebuild1!.buildWorkspaceId);
        await workspaceDb.updateInstancePartial(wsAndI1!.instanceId, { status: { phase: "stopped" } });

        mockRepositoryProvider.pushCommit("branch-with-history", {
            sha: "111111",
            author: "some-dude",
            commitMessage: "commit 111111",
        });
        const prebuild2Result = await prebuildManager.triggerPrebuild({}, owner, project.id, "branch-with-history");
        const prebuild2 = await workspaceDb.findPrebuildByID(prebuild2Result.prebuildId);
        await workspaceDb.storePrebuiltWorkspace({
            ...prebuild2!,
            state: "available",
        });
        const wsAndI2 = await workspaceDb.findWorkspaceAndInstance(prebuild2!.buildWorkspaceId);
        await workspaceDb.updateInstancePartial(wsAndI2!.instanceId, { status: { phase: "stopped" } });

        // request context for the _first_ commit
        const svc = container.get(ContextService);
        const ctx = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/commit/000000`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        expect(ctx.project?.id).to.equal(project.id);
        expect(PrebuiltWorkspaceContext.is(ctx.context)).to.equal(true);
        expect((ctx.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.id).to.equal(
            prebuild1Result.prebuildId,
        );
        expect((ctx.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.commit).to.equal(revision1);
    });

    it("should handle triggering prebuilds out of order with respect to commits", async () => {
        const commit1 = {
            sha: "69420",
            author: "some-dude",
            commitMessage: `commit 69420`,
        };
        const commit2 = {
            sha: "69422",
            author: "some-dude",
            commitMessage: `commit 69422`,
        };
        const commit3 = {
            sha: "69423",
            author: "some-other-dude",
            commitMessage: "commit 69423",
        };
        const branchName = "branch-2";
        mockRepositoryProvider.addBranch(
            { name: branchName, htmlUrl: `https://github.com/gitpod-io/empty/tree/${branchName}` },
            [commit1],
        );
        mockRepositoryProvider.pushCommit(branchName, commit2);
        mockRepositoryProvider.pushCommit(branchName, commit3);

        // request context for both commits separately
        const svc = container.get(ContextService);
        let ctx1 = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/commit/${commit1.sha}`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        const ctx2 = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/commit/${commit2.sha}`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        let ctx3 = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/commit/${commit3.sha}`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });

        // trigger and "await" prebuilds for all commits in crazy order
        const prebuildManager = container.get(PrebuildManager);
        const workspaceDb: WorkspaceDB = container.get(WorkspaceDB);

        async function runPrebuild(
            commitInfo: CommitInfo,
            context: CommitContext,
            state: PrebuiltWorkspaceState,
        ): Promise<PrebuiltWorkspace> {
            const prebuildResult = await prebuildManager.startPrebuild(
                {},
                { user: owner, project, commitInfo, context },
            );
            const prebuild = await workspaceDb.findPrebuildByID(prebuildResult.prebuildId);
            await workspaceDb.storePrebuiltWorkspace({
                ...prebuild!,
                state,
            });
            const wsAndI = await workspaceDb.findWorkspaceAndInstance(prebuild!.buildWorkspaceId);
            await workspaceDb.updateInstancePartial(wsAndI!.instanceId, { status: { phase: "stopped" } });

            return prebuild!;
        }

        const prebuild3 = await runPrebuild(commit3, ctx3.context as CommitContext, "available");
        const prebuild1 = await runPrebuild(commit1, ctx1.context as CommitContext, "available");
        await runPrebuild(commit2, ctx2.context as CommitContext, "available");

        ctx1 = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/commit/${commit1.sha}`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        ctx3 = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/commit/${commit3.sha}`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });
        const ctxBranch = await svc.parseContext(owner, `https://github.com/gitpod-io/empty/tree/branch-2`, {
            projectId: project.id,
            organizationId: org.id,
            forceDefaultConfig: false,
        });

        expect(ctx1.project?.id).to.equal(project.id);
        expect(PrebuiltWorkspaceContext.is(ctx1.context)).to.equal(true);
        expect((ctx1.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.id).to.equal(prebuild1.id);
        expect(
            (ctx1.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.commit,
            "should point to commit1, ignoring others due to history",
        ).to.equal(commit1.sha);

        expect(ctx3.project?.id).to.equal(project.id);
        expect(PrebuiltWorkspaceContext.is(ctx3.context)).to.equal(true);
        expect((ctx3.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.id).to.equal(prebuild3.id);
        expect(
            (ctx3.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.commit,
            "should point to commit3, ignoring more recent prebuilds (1 + 2)",
        ).to.equal(commit3.sha);

        expect(ctxBranch.project?.id).to.equal(project.id);
        expect(PrebuiltWorkspaceContext.is(ctxBranch.context)).to.equal(true);
        expect((ctxBranch.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.id).to.equal(prebuild3.id);
        expect(
            (ctxBranch.context as any as PrebuiltWorkspaceContext).prebuiltWorkspace.commit,
            "should point to commit3, ingoring more the more recent incremental match prebuild2",
        ).to.equal(commit3.sha);
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
