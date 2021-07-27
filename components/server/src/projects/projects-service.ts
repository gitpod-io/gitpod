/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { DBWithTracing, ProjectDB, TeamDB, TracedWorkspaceDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Branch, CommitInfo, CreateProjectParams, FindPrebuildsParams, PrebuildInfo, PrebuiltWorkspace, Project, User } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { parseRepoUrl } from "../repohost";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class ProjectsService {

    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    async getProject(projectId: string): Promise<Project | undefined> {
        return this.projectDB.findProjectById(projectId);
    }

    async getProjects(teamId: string): Promise<Project[]> {
        const projects = await this.projectDB.findProjectsByTeam(teamId);
        return projects;
    }

    async getProjectOverview(user: User, teamId: string, projectName: string): Promise<Project.Overview | undefined> {
        const project = await this.projectDB.findProjectByTeamAndName(teamId, projectName);
        if (!project) {
            return undefined;
        }
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
        return result.slice(0, 30);
    }

    async createProject({ name, cloneUrl, teamId, appInstallationId }: CreateProjectParams): Promise<Project> {
        return this.projectDB.storeProject(Project.create({ name, cloneUrl, teamId, appInstallationId }));
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
        const { teamId, projectName, prebuildId } = params;
        const project = await this.projectDB.findProjectByTeamAndName(teamId, projectName);
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
            const limit = params.latest ? 1 : undefined;
            let branch = params.branch;
            if (limit && !branch) {
                const repository = await repositoryProvider.getRepo(user, owner, repo);
                branch = repository.defaultBranch;
            }
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
            teamId,
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
            branchPrebuildNumber: "42"
        };
    }

}
