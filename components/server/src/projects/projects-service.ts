/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { DBWithTracing, ProjectDB, TracedWorkspaceDB, WebhookEventDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    Branch,
    PrebuildWithStatus,
    CreateProjectParams,
    FindPrebuildsParams,
    Project,
    ProjectEnvVar,
    User,
    PrebuildEvent,
} from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { RepoURL } from "../repohost";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { PartialProject } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { Config } from "../config";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { URL } from "url";
import { Authorizer } from "../authorization/authorizer";
import { ProjectPermission } from "../authorization/definitions";

@injectable()
export class ProjectsService {
    constructor(
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(TracedWorkspaceDB) private readonly workspaceDb: DBWithTracing<WorkspaceDB>,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(Config) private readonly config: Config,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(WebhookEventDB) private readonly webhookEventDB: WebhookEventDB,
        @inject(Authorizer) private readonly auth: Authorizer,
    ) {}

    async getProject(userId: string, projectId: string): Promise<Project | undefined> {
        const project = await this.projectDB.findProjectById(projectId);
        if (project && !(await this.auth.hasPermissionOnProject(userId, "read_info", project))) {
            return undefined;
        }
        return project;
    }

    async getProjects(userId: string, orgId: string): Promise<Project[]> {
        const projects = await this.projectDB.findProjects(orgId);
        return await this.filterProjectsByPermission(projects, userId, "read_info");
    }

    private async filterProjectsByPermission<T extends Project>(
        projects: T[],
        userId: string,
        permission: ProjectPermission,
    ): Promise<T[]> {
        const filteredProjects: T[] = [];
        const filter = async (project: Project) => {
            if (await this.auth.hasPermissionOnProject(userId, permission, project)) {
                return project;
            }
            return undefined;
        };

        for (const projectPromise of projects.map(filter)) {
            const project = await projectPromise;
            if (project) {
                filteredProjects.push(project as T);
            }
        }
        return filteredProjects;
    }

    async getProjectsByCloneUrls(
        userId: string,
        cloneUrls: string[],
    ): Promise<(Project & { teamOwners?: string[] })[]> {
        //FIXME we intentionally allow to query for projects that the user does not have access to
        const projects = await this.projectDB.findProjectsByCloneUrls(cloneUrls);
        return projects;
    }

    async getProjectOverviewCached(user: User, project: Project): Promise<Project.Overview | undefined> {
        if (!(await this.auth.hasPermissionOnProject(user.id, "read_info", project))) {
            return undefined;
        }
        // Check for a cached project overview (fast!)
        const cachedPromise = this.projectDB.findCachedProjectOverview(project.id);

        // ...but also refresh the cache on every request (asynchronously / in the background)
        const refreshPromise = this.getBranchDetails(user, project).then((branches) => {
            const overview = { branches };
            // No need to await here
            this.projectDB.storeCachedProjectOverview(project.id, overview).catch((error) => {
                log.error(`Could not store cached project overview: ${error}`, { cloneUrl: project.cloneUrl });
            });
            return overview;
        });

        const cachedOverview = await cachedPromise;
        if (cachedOverview) {
            return cachedOverview;
        }
        return await refreshPromise;
    }

    private getRepositoryProvider(project: Project) {
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        const repositoryProvider =
            parsedUrl && this.hostContextProvider.get(parsedUrl.host)?.services?.repositoryProvider;
        return repositoryProvider;
    }

    async getBranchDetails(user: User, project: Project, branchName?: string): Promise<Project.BranchDetails[]> {
        const canReadProjectInfo = await this.auth.hasPermissionOnProject(user.id, "read_info", project);
        if (!canReadProjectInfo) {
            return [];
        }

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
            });
        }
        result.sort((a, b) => (b.changeDate || "").localeCompare(a.changeDate || ""));
        return result;
    }

    async createProject(
        { name, slug, cloneUrl, teamId, appInstallationId }: CreateProjectParams,
        installer: User,
    ): Promise<Project> {
        const canCreateProject = await this.auth.hasPermissionOnOrganization(installer.id, "create_project", teamId);
        if (!canCreateProject) {
            const canReadOrgInfo = await this.auth.hasPermissionOnOrganization(installer.id, "read_info", teamId);
            if (!canReadOrgInfo) {
                // throw 404
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `Organization ${teamId} not found.`);
            }
            throw new ApplicationError(
                ErrorCodes.PERMISSION_DENIED,
                `You do not have permission to create a project on organization ${teamId}.`,
            );
        }

        if (cloneUrl.length >= 1000) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be less than 1k characters.");
        }

        try {
            new URL(cloneUrl);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be a valid URL.");
        }

        const projects = await this.getProjectsByCloneUrls(installer.id, [cloneUrl]);
        if (projects.length > 0) {
            throw new Error("Project for repository already exists.");
        }
        // If the desired project slug already exists in this team or user account, add a unique suffix to avoid collisions.
        let uniqueSlug = slug;
        let uniqueSuffix = 0;
        const existingProjects = await this.getProjects(installer.id, teamId!);
        while (existingProjects.some((p) => p.slug === uniqueSlug)) {
            uniqueSuffix++;
            uniqueSlug = `${slug}-${uniqueSuffix}`;
        }
        const project = Project.create({
            name,
            slug: uniqueSlug,
            cloneUrl,
            teamId,
            appInstallationId,
        });

        try {
            await this.projectDB.transaction(async (db) => {
                await db.storeProject(project);

                await this.auth.addProjectToOrg(teamId, project.id);
            });
        } catch (err) {
            await this.auth.removeProjectFromOrg(teamId, project.id);
            throw err;
        }
        await this.onDidCreateProject(project, installer);

        this.analytics.track({
            userId: installer.id,
            event: "project_created",
            properties: {
                project_id: project.id,
                name: name,
                clone_url: cloneUrl,
                owner_type: "team",
                owner_id: teamId,
                app_installation_id: appInstallationId,
            },
        });
        return project;
    }

    private async onDidCreateProject(project: Project, installer: User) {
        // Pre-fetch project details in the background -- don't await
        /** no await */ this.getProjectOverviewCached(installer, project).catch((err) => {
            /** ignore */
        });

        // Install the prebuilds webhook if possible
        let { userId, teamId, cloneUrl } = project;
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        const hostContext = parsedUrl?.host ? this.hostContextProvider.get(parsedUrl?.host) : undefined;
        const authProvider = hostContext && hostContext.authProvider.info;
        const type = authProvider && authProvider.authProviderType;
        if (
            type === "GitLab" ||
            type === "Bitbucket" ||
            type === "BitbucketServer" ||
            (type === "GitHub" && (authProvider?.host !== "github.com" || !this.config.githubApp?.enabled))
        ) {
            const repositoryService = hostContext?.services?.repositoryService;
            if (repositoryService) {
                // Note: For GitLab, we expect .canInstallAutomatedPrebuilds() to always return true, because earlier
                // in the project creation flow, we only propose repositories where the user is actually allowed to
                // install a webhook.
                if (await repositoryService.canInstallAutomatedPrebuilds(installer, cloneUrl)) {
                    log.info("Update prebuild installation for project.", {
                        cloneUrl,
                        teamId,
                        userId,
                        installerId: installer.id,
                    });
                    await repositoryService.installAutomatedPrebuilds(installer, cloneUrl);
                }
            }
        }
    }

    async deleteProject(userId: string, projectId: string): Promise<void> {
        //TODO we need the project for the auth check as we are using the orgid for the feature flag check. this lookup should be removed once we have removed the featureflag
        const project = await this.getProject(userId, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }
        if (!(await this.auth.hasPermissionOnProject(userId, "delete", project))) {
            throw new ApplicationError(
                ErrorCodes.PERMISSION_DENIED,
                `You do not have permission to delete project ${projectId}.`,
            );
        }
        let orgId: string | undefined = undefined;
        try {
            await this.projectDB.transaction(async (db) => {
                // TODO(gpl): This is a case where we'd need to extend the service + API to also accept the orgId as first parameter
                const project = await db.findProjectById(projectId);
                if (!project) {
                    throw new Error("Project does not exist");
                }
                orgId = project.teamId;
                await db.markDeleted(projectId);

                await this.auth.removeProjectFromOrg(orgId, projectId);
            });
        } catch (err) {
            if (orgId) {
                await this.auth.addProjectToOrg(orgId, projectId);
            }
            throw err;
        }
    }

    async findPrebuilds(userId: string, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
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
            const prebuilds = await this.workspaceDb
                .trace({})
                .findPrebuiltWorkspacesByProject(project.id, branch, limit);
            const infos = await this.workspaceDb.trace({}).findPrebuildInfos([...prebuilds.map((p) => p.id)]);
            result.push(
                ...infos.map((info) => {
                    const p = prebuilds.find((p) => p.id === info.id)!;
                    const r: PrebuildWithStatus = { info, status: p.state };
                    if (p.error) {
                        r.error = p.error;
                    }
                    return r;
                }),
            );
        }
        return result;
    }

    async updateProjectPartial(userId: string, partialProject: PartialProject): Promise<void> {
        return this.projectDB.updateProject(partialProject);
    }

    async setProjectEnvironmentVariable(
        userId: string,
        projectId: string,
        name: string,
        value: string,
        censored: boolean,
    ): Promise<void> {
        const project = await this.getProject(userId, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }
        await this.checkPermissionAndThrow(userId, "write_info", project);
        return this.projectDB.setProjectEnvironmentVariable(projectId, name, value, censored);
    }

    async getProjectEnvironmentVariables(userId: string, projectId: string): Promise<ProjectEnvVar[]> {
        const project = await this.getProject(userId, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }
        return this.projectDB.getProjectEnvironmentVariables(projectId);
    }

    async getProjectEnvironmentVariableById(userId: string, variableId: string): Promise<ProjectEnvVar | undefined> {
        const result = await this.projectDB.getProjectEnvironmentVariableById(variableId);
        if (result) {
            const project = await this.getProject(userId, result.projectId);
            if (!project) {
                return undefined;
            }
        }
        return result;
    }

    async deleteProjectEnvironmentVariable(userId: string, variableId: string): Promise<void> {
        const variable = await this.getProjectEnvironmentVariableById(userId, variableId);
        if (!variable) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Environment Variable ${variableId} not found.`);
        }
        const project = await this.getProject(userId, variable.projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Environment Variable ${variableId} not found.`);
        }
        await this.checkPermissionAndThrow(userId, "write_info", project);
        return this.projectDB.deleteProjectEnvironmentVariable(variableId);
    }

    async isProjectConsideredInactive(userId: string, projectId: string): Promise<boolean> {
        const project = await this.getProject(userId, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }
        const usage = await this.projectDB.getProjectUsage(projectId);
        if (!usage?.lastWorkspaceStart) {
            return false;
        }
        const now = Date.now();
        const lastUse = new Date(usage.lastWorkspaceStart).getTime();
        const inactiveProjectTime = 1000 * 60 * 60 * 24 * 7 * 1; // 1 week
        return now - lastUse > inactiveProjectTime;
    }

    async getPrebuildEvents(userId: string, cloneUrl: string): Promise<PrebuildEvent[]> {
        const project = await this.projectDB.findProjectByCloneUrl(cloneUrl);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${cloneUrl} not found.`);
        }
        await this.checkPermissionAndThrow(userId, "read_info", project);
        const events = await this.webhookEventDB.findByCloneUrl(cloneUrl, 100);
        return events.map((we) => ({
            id: we.id,
            creationTime: we.creationTime,
            cloneUrl: we.cloneUrl,
            branch: we.branch,
            commit: we.commit,
            prebuildId: we.prebuildId,
            projectId: we.projectId,
            status: we.prebuildStatus || we.status,
        }));
    }

    private async checkPermissionAndThrow(userId: string, permission: ProjectPermission, project: Project) {
        if (await this.auth.hasPermissionOnProject(userId, permission, project)) {
            return;
        }
        // check if the user has read permission
        if ("read_info" === permission || !(await this.auth.hasPermissionOnProject(userId, "read_info", project))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${project.id} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on project ${project.id}`,
        );
    }
}
