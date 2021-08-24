/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { DBWithTracing, ProjectDB, TeamDB, TracedWorkspaceDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Branch, CommitInfo, CreateProjectParams, FindPrebuildsParams, PrebuildInfo, PrebuiltWorkspace, Project, ProjectConfig, User } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { parseRepoUrl } from "../repohost";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class ProjectsService {

    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    async getProject(projectId: string): Promise<Project | undefined> {
        return this.projectDB.findProjectById(projectId);
    }

    async getTeamProjects(teamId: string): Promise<Project[]> {
        return this.projectDB.findTeamProjects(teamId);
    }

    async getUserProjects(userId: string): Promise<Project[]> {
        return this.projectDB.findUserProjects(userId);
    }

    async getProjectsByCloneUrls(cloneUrls: string[]): Promise<Project[]> {
        return this.projectDB.findProjectsByCloneUrls(cloneUrls);
    }

    async getProjectOverview(user: User, project: Project): Promise<Project.Overview | undefined> {
        const branches = await this.getBranchDetails(user, project);
        return { branches };
    }

    protected getRepositoryProvider(project: Project) {
        const parsedUrl = parseRepoUrl(project.cloneUrl);
        const repositoryProvider = parsedUrl && this.hostContextProvider.get(parsedUrl.host)?.services?.repositoryProvider;
        return repositoryProvider;
    }

    async getBranchDetails(user: User, project: Project, branchName?: string): Promise<Project.BranchDetails[]> {
        const parsedUrl = parseRepoUrl(project.cloneUrl);
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

    async createProject({ name, cloneUrl, teamId, userId, appInstallationId }: CreateProjectParams): Promise<Project> {
        const project = Project.create({
            name,
            cloneUrl,
            ...(!!userId ? { userId } : { teamId }),
            appInstallationId
        });
        await this.projectDB.storeProject(project);
        await this.onDidCreateProject(project);
        return project;
    }

    protected async onDidCreateProject(project: Project) {
        let { userId, teamId, cloneUrl } = project;
        const parsedUrl = parseRepoUrl(project.cloneUrl);
        if ("gitlab.com" === parsedUrl?.host) {
            const repositoryService = this.hostContextProvider.get(parsedUrl?.host)?.services?.repositoryService;
            if (repositoryService) {
                if (teamId) {
                    const owner = (await this.teamDB.findMembersByTeam(teamId)).find(m => m.role === "owner");
                    userId = owner?.userId;
                }
                const user = userId && await this.userDB.findUserById(userId);
                if (user) {
                    if (await repositoryService.canInstallAutomatedPrebuilds(user, cloneUrl)) {
                        log.info("Update prebuild installation for project.", { cloneUrl, teamId, userId });
                        await repositoryService.installAutomatedPrebuilds(user, cloneUrl);
                    }
                } else {
                    log.error("Cannot find user for project.", { cloneUrl })
                }
            }
        }
    }

    async deleteProject(projectId: string): Promise<void> {
        return this.projectDB.markDeleted(projectId);
    }

    protected async getLastPrebuild(project: Project, branch: Branch): Promise<PrebuildInfo | undefined> {
        const prebuilds = await this.workspaceDb.trace({}).findPrebuiltWorkspacesByProject(project.id, branch?.name);
        const prebuild = prebuilds[prebuilds.length - 1];
        if (!prebuild) {
            return undefined;
        }
        return await this.toPrebuildInfo(project, prebuild, branch.commit);
    }

    async findPrebuilds(user: User, params: FindPrebuildsParams): Promise<PrebuildInfo[]> {
        const { projectId, prebuildId } = params;
        const project = await this.projectDB.findProjectById(projectId);
        if (!project) {
            return [];
        }
        const parsedUrl = parseRepoUrl(project.cloneUrl);
        if (!parsedUrl) {
            return [];
        }
        const { owner, repo, host } = parsedUrl;
        const repositoryProvider = this.hostContextProvider.get(host)?.services?.repositoryProvider;
        if (!repositoryProvider) {
            return [];
        }

        let prebuilds: PrebuiltWorkspace[] = [];
        const result: PrebuildInfo[] = [];

        if (prebuildId) {
            const pbws = await this.workspaceDb.trace({}).findPrebuiltWorkspacesById(prebuildId);
            if (pbws) {
                prebuilds.push(pbws);
            }
        } else {
            let limit = params.limit !== undefined ? params.limit : 30;
            if (params.latest) {
                limit = 1;
            }
            let branch = params.branch;
            prebuilds = await this.workspaceDb.trace({}).findPrebuiltWorkspacesByProject(project.id, branch, limit);
        }

        for (const prebuild of prebuilds) {
            try {
                const commit = await repositoryProvider.getCommitInfo(user, owner, repo, prebuild.commit);
                if (commit) {
                    result.push(await this.toPrebuildInfo(project, prebuild, commit));
                }
            } catch (error) {
                log.debug(`Could not fetch commit info.`, error, { owner, repo, prebuildCommit: prebuild.commit });
            }
        }
        return result;
    }

    protected async toPrebuildInfo(project: Project, prebuild: PrebuiltWorkspace, commit: CommitInfo): Promise<PrebuildInfo> {
        const { teamId, name: projectName } = project;

        return {
            id: prebuild.id,
            buildWorkspaceId: prebuild.buildWorkspaceId,
            startedAt: prebuild.creationTime,
            startedBy: "", // TODO
            startedByAvatar: "", // TODO
            teamId: teamId || "", // TODO
            projectName,
            branch: prebuild.branch || "unknown",
            cloneUrl: prebuild.cloneURL,
            status: prebuild.state,
            changeAuthor: commit.author,
            changeAuthorAvatar: commit.authorAvatarUrl,
            changeDate: commit.authorDate || "",
            changeHash: commit.sha,
            changeTitle: commit.commitMessage,
            // changePR
            // changeUrl
        };
    }

    async setProjectConfiguration(projectId: string, config: ProjectConfig) {
        return this.projectDB.setProjectConfiguration(projectId, config);
    }

}
