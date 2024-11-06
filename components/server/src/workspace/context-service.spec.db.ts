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
    Branch,
    CommitInfo,
    Repository,
    RepositoryInfo,
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
class MockRepositoryProvider implements RepositoryProvider {
    branches: Map<string, { branch: Branch; commits: CommitInfo[] }> = new Map();

    addBranch(branch: Omit<Branch, "commit">, commits: CommitInfo[]) {
        this.branches.set(branch.name, {
            branch: {
                ...branch,
                commit: {
                    sha: head(commits).sha,
                    author: head(commits).author,
                    commitMessage: head(commits).commitMessage,
                },
            },
            commits,
        });
    }

    async hasReadAccess(user: any, owner: string, repo: string): Promise<boolean> {
        return true;
    }
    async getBranch(user: User, owner: string, repo: string, branchName: string): Promise<Branch> {
        const branch = this.branches.get(branchName);
        if (!branch) {
            throw new Error("branch not found");
        }
        return branch.branch;
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
                    // this commit, and everything before it
                    return b.commits.slice(0, i + 1).map((c) => c.sha);
                }
            }
        }
        throw new Error(`ref ${ref} not found`);
    }
    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        return headu(this.branches.get(ref)?.commits);
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        return Array.from(this.branches.values()).map((b) => b.branch);
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
    return arr[arr.length - 1];
}

function head<T>(arr: T[]): T {
    if (arr.length === 0) {
        throw new Error("empty array");
    }
    return arr[arr.length - 1];
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

                    const mainBranch = await mockRepositoryProvider.getBranch(user, "gitpod-io", "empty", "main");
                    const r: CommitContext = {
                        title: mainBranch.commit.commitMessage,
                        ref: mainBranch.name,
                        refType: "branch",
                        revision: mainBranch.commit.sha,
                        repository: await mockRepositoryProvider.getRepo(user, "gitpod-io", "empty"),
                        normalizedContextURL: mainBranch.htmlUrl,
                    };
                    return r;
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
