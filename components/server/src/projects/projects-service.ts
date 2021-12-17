/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { DBWithTracing, ProjectDB, TeamDB, TracedWorkspaceDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Branch, CommitContext, PrebuildWithStatus, CreateProjectParams, FindPrebuildsParams, Project, User, WorkspaceConfig } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { HostContextProvider } from "../auth/host-context-provider";
import { FileProvider, RepoURL } from "../repohost";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { ContextParser } from "../workspace/context-parser-service";
import { ConfigInferrer } from "./config-inferrer";
import { PartialProject } from "@gitpod/gitpod-protocol/src/teams-projects-protocol";

@injectable()
export class ProjectsService {

    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(ContextParser) protected contextParser: ContextParser;

    async getProject(projectId: string): Promise<Project | undefined> {
        return this.projectDB.findProjectById(projectId);
    }

    async getTeamProjects(teamId: string): Promise<Project[]> {
        return this.projectDB.findTeamProjects(teamId);
    }

    async getUserProjects(userId: string): Promise<Project[]> {
        return this.projectDB.findUserProjects(userId);
    }

    async getProjectsByCloneUrls(cloneUrls: string[]): Promise<(Project & { teamOwners?: string[] })[]> {
        return this.projectDB.findProjectsByCloneUrls(cloneUrls);
    }

    async getProjectOverview(user: User, project: Project): Promise<Project.Overview | undefined> {
        const branches = await this.getBranchDetails(user, project);
        return { branches };
    }

    protected getRepositoryProvider(project: Project) {
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        const repositoryProvider = parsedUrl && this.hostContextProvider.get(parsedUrl.host)?.services?.repositoryProvider;
        return repositoryProvider;
    }

    async getBranchDetails(user: User, project: Project, branchName?: string): Promise<Project.BranchDetails[]> {
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        if (!parsedUrl) {
            return [];
        }
        const { owner, repo } = parsedUrl;
        const repositoryProvider = this.getRepositoryProvider(project);
        if (!repositoryProvider) {
            return [];
        }
        const repository = await repositoryProvider.getRepo(user, owner, repo);
        const branches: Branch[] = [];
        if (branchName) {
            const details = await repositoryProvider.getBranch(user, owner, repo, branchName);
            branches.push(details);
        } else {
            branches.push(...(await repositoryProvider.getBranches(user, owner, repo)));
        }

        const result: Project.BranchDetails[] = [];
        for (const branch of branches) {
            const { name, commit, htmlUrl } = branch;
            result.push({
                name,
                url: htmlUrl,
                changeAuthor: commit.author,
                changeDate: commit.authorDate,
                changeHash: commit.sha,
                changeTitle: commit.commitMessage,
                changeAuthorAvatar: commit.authorAvatarUrl,
                isDefault: repository.defaultBranch === branch.name,
                changePR: "changePR", // todo: compute in repositoryProvider
                changeUrl: "changeUrl", // todo: compute in repositoryProvider
            });
        }
        result.sort((a, b) => (b.changeDate || "").localeCompare(a.changeDate || ""));
        return result;
    }

    async createProject({ name, slug, cloneUrl, teamId, userId, appInstallationId }: CreateProjectParams, installer: User): Promise<Project> {
        const projects = await this.getProjectsByCloneUrls([cloneUrl]);
        if (projects.length > 0) {
            throw new Error("Project for repository already exists.");
        }
        // If the desired project slug already exists in this team or user account, add a unique suffix to avoid collisions.
        let uniqueSlug = slug;
        let uniqueSuffix = 0;
        const existingProjects = await (!!userId ? this.getUserProjects(userId) : this.getTeamProjects(teamId!));
        while (existingProjects.some(p => p.slug === uniqueSlug)) {
            uniqueSuffix++;
            uniqueSlug = `${slug}-${uniqueSuffix}`;
        }
        const project = Project.create({
            name,
            slug: uniqueSlug,
            cloneUrl,
            ...(!!userId ? { userId } : { teamId }),
            appInstallationId
        });
        await this.projectDB.storeProject(project);
        await this.onDidCreateProject(project, installer);
        return project;
    }

    protected async onDidCreateProject(project: Project, installer: User) {
        let { userId, teamId, cloneUrl } = project;
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        if ("gitlab.com" === parsedUrl?.host) {
            const repositoryService = this.hostContextProvider.get(parsedUrl?.host)?.services?.repositoryService;
            if (repositoryService) {
                // Note: For GitLab, we expect .canInstallAutomatedPrebuilds() to always return true, because earlier
                // in the project creation flow, we only propose repositories where the user is actually allowed to
                // install a webhook.
                if (await repositoryService.canInstallAutomatedPrebuilds(installer, cloneUrl)) {
                    log.info("Update prebuild installation for project.", { cloneUrl, teamId, userId, installerId: installer.id });
                    await repositoryService.installAutomatedPrebuilds(installer, cloneUrl);
                }
            }
        }
    }

    async deleteProject(projectId: string): Promise<void> {
        return this.projectDB.markDeleted(projectId);
    }

    async findPrebuilds(user: User, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        const { projectId, prebuildId } = params;
        const project = await this.projectDB.findProjectById(projectId);
        if (!project) {
            return [];
        }
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        if (!parsedUrl) {
            return [];
        }
        const result: PrebuildWithStatus[] = [];

        if (prebuildId) {
            const pbws = await this.workspaceDb.trace({}).findPrebuiltWorkspaceById(prebuildId);
            const info = (await this.workspaceDb.trace({}).findPrebuildInfos([prebuildId]))[0];
            if (info && pbws) {
                const r: PrebuildWithStatus = { info, status: pbws.state };
                if (pbws.error) {
                    r.error = pbws.error;
                }
                result.push(r);
            }
        } else {
            let limit = params.limit !== undefined ? params.limit : 30;
            if (params.latest) {
                limit = 1;
            }
            let branch = params.branch;
            const prebuilds = await this.workspaceDb.trace({}).findPrebuiltWorkspacesByProject(project.id, branch, limit);
            const infos = await this.workspaceDb.trace({}).findPrebuildInfos([...prebuilds.map(p => p.id)]);
            result.push(...infos.map(info => {
                const p = prebuilds.find(p => p.id === info.id)!;
                const r: PrebuildWithStatus = { info, status: p.state };
                if (p.error) {
                    r.error = p.error;
                }
                return r;
            }));
        }
        return result;
    }

    protected async getRepositoryFileProviderAndCommitContext(ctx: TraceContext, user: User, cloneUrl: string): Promise<{fileProvider: FileProvider, commitContext: CommitContext}> {
        const normalizedContextUrl = this.contextParser.normalizeContextURL(cloneUrl);
        const commitContext = (await this.contextParser.handle(ctx, user, normalizedContextUrl)) as CommitContext;
        const { host } = commitContext.repository;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext || !hostContext.services) {
            throw new Error(`Cannot fetch repository configuration for host: ${host}`);
        }
        const fileProvider = hostContext.services.fileProvider;
        return { fileProvider, commitContext };
    }

    async fetchRepositoryConfiguration(ctx: TraceContext, user: User, cloneUrl: string): Promise<string | undefined> {
        const { fileProvider, commitContext } = await this.getRepositoryFileProviderAndCommitContext(ctx, user, cloneUrl);
        const configString = await fileProvider.getGitpodFileContent(commitContext, user);
        return configString;
    }

    // a static cache used to prefetch inferrer related files in parallel in advance
    private requestedPaths = new Set<string>();

    async guessRepositoryConfiguration(ctx: TraceContext, user: User, cloneUrl: string): Promise<string | undefined> {
        const { fileProvider, commitContext } = await this.getRepositoryFileProviderAndCommitContext(ctx, user, cloneUrl);
        const cache: { [path: string]: Promise<string | undefined> } = {};
        const readFile = async (path: string) => {
            if (path in cache) {
                return await cache[path];
            }
            this.requestedPaths.add(path);
            const content = fileProvider.getFileContent(commitContext, user, path);
            cache[path] = content;
            return await content;
        }
        // eagerly fetch for all files that the inferrer usually asks for.
        this.requestedPaths.forEach(path => !(path in cache) && readFile(path));
        const config: WorkspaceConfig = await new ConfigInferrer().getConfig({
            config: {},
            read: readFile,
            exists: async (path: string) => !!(await readFile(path)),
        });
        if (!config.tasks) {
            return;
        }
        const configString = `tasks:\n  - ${config.tasks.map(task => Object.entries(task).map(([phase, command]) => `${phase}: ${command}`).join('\n    ')).join('\n  - ')}`;
        return configString;
    }

    async updateProjectPartial(partialProject: PartialProject): Promise<void> {
        return this.projectDB.updateProject(partialProject);
    }

}
