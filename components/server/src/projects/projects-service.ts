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
    User,
    PrebuildEvent,
} from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { RepoURL } from "../repohost";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { PartialProject, ProjectSettings, ProjectUsage } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { URL } from "url";
import { Authorizer } from "../authorization/authorizer";
import { TransactionalContext } from "@gitpod/gitpod-db/lib/typeorm/transactional-db-impl";
import { ScmService } from "./scm-service";

@injectable()
export class ProjectsService {
    public static PROJECT_SETTINGS_DEFAULTS: ProjectSettings = {
        enablePrebuilds: false,
        prebuildDefaultBranchOnly: true,
    };

    constructor(
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(TracedWorkspaceDB) private readonly workspaceDb: DBWithTracing<WorkspaceDB>,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(WebhookEventDB) private readonly webhookEventDB: WebhookEventDB,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(ScmService) private readonly scmService: ScmService,
    ) {}

    async getProject(userId: string, projectId: string): Promise<Project> {
        await this.auth.checkPermissionOnProject(userId, "read_info", projectId);
        const project = await this.projectDB.findProjectById(projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }
        return project;
    }

    async getProjects(userId: string, orgId: string): Promise<Project[]> {
        await this.auth.checkPermissionOnOrganization(userId, "read_info", orgId);
        const projects = await this.projectDB.findProjects(orgId);
        return await this.filterByReadAccess(userId, projects);
    }

    async findProjects(
        userId: string,
        searchOptions: {
            offset?: number;
            limit?: number;
            orderBy?: keyof Project;
            orderDir?: "ASC" | "DESC";
            searchTerm?: string;
        },
    ): Promise<{ total: number; rows: Project[] }> {
        const projects = await this.projectDB.findProjectsBySearchTerm(
            searchOptions.offset || 0,
            searchOptions.limit || 1000,
            searchOptions.orderBy || "creationTime",
            searchOptions.orderDir || "ASC",
            searchOptions.searchTerm || "",
        );
        const rows = await this.filterByReadAccess(userId, projects.rows);
        const total = projects.total;
        return {
            total,
            rows,
        };
    }

    private async filterByReadAccess(userId: string, projects: Project[]) {
        const filteredProjects: Project[] = [];
        const filter = async (project: Project) => {
            if (await this.auth.hasPermissionOnProject(userId, "read_info", project.id)) {
                return project;
            }
            return undefined;
        };

        for (const projectPromise of projects.map(filter)) {
            const project = await projectPromise;
            if (project) {
                filteredProjects.push(project);
            }
        }
        return filteredProjects;
    }

    async findProjectsByCloneUrl(userId: string, cloneUrl: string): Promise<Project[]> {
        // TODO (se): currently we only allow one project per cloneUrl
        const project = await this.projectDB.findProjectByCloneUrl(cloneUrl);
        if (project && (await this.auth.hasPermissionOnProject(userId, "read_info", project.id))) {
            return [project];
        }
        return [];
    }

    async markActive(
        userId: string,
        projectId: string,
        kind: keyof ProjectUsage = "lastWorkspaceStart",
    ): Promise<void> {
        await this.auth.checkPermissionOnProject(userId, "read_info", projectId);
        await this.projectDB.updateProjectUsage(projectId, {
            [kind]: new Date().toISOString(),
        });
    }

    /**
     * @deprecated this is a temporary method until we allow mutliple projects per cloneURL
     */
    async getProjectsByCloneUrls(
        userId: string,
        cloneUrls: string[],
    ): Promise<(Project & { teamOwners?: string[] })[]> {
        //FIXME we intentionally allow to query for projects that the user does not have access to
        const projects = await this.projectDB.findProjectsByCloneUrls(cloneUrls);
        return projects;
    }

    async getProjectOverview(user: User, projectId: string): Promise<Project.Overview> {
        const project = await this.getProject(user.id, projectId);
        await this.auth.checkPermissionOnProject(user.id, "read_info", project.id);
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
        await this.auth.checkPermissionOnProject(user.id, "read_info", project.id);

        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        if (!parsedUrl) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, `Invalid clone URL on project ${project.id}.`);
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
        projectSettingsDefaults: ProjectSettings = ProjectsService.PROJECT_SETTINGS_DEFAULTS,
    ): Promise<Project> {
        await this.auth.checkPermissionOnOrganization(installer.id, "create_project", teamId);

        if (cloneUrl.length >= 1000) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be less than 1k characters.");
        }

        try {
            new URL(cloneUrl);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be a valid URL.");
        }

        const parsedUrl = RepoURL.parseRepoUrl(cloneUrl);
        if (!parsedUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be a valid URL.");
        }

        const projects = await this.getProjectsByCloneUrls(installer.id, [cloneUrl]);
        if (projects.length > 0) {
            throw new Error("Project for repository already exists.");
        }
        const project = Project.create({
            name,
            cloneUrl,
            teamId,
            appInstallationId,
            settings: projectSettingsDefaults,
        });

        try {
            await this.projectDB.transaction(async (db) => {
                await db.storeProject(project);

                await this.auth.addProjectToOrg(installer.id, teamId, project.id);
                await this.auth.setProjectVisibility(installer.id, project.id, teamId, "org-public");
            });
        } catch (err) {
            await this.auth.removeProjectFromOrg(installer.id, teamId, project.id);
            throw err;
        }

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

    public async setVisibility(userId: string, projectId: string, visibility: Project.Visibility): Promise<void> {
        await this.auth.checkPermissionOnProject(userId, "write_info", projectId);
        const project = await this.getProject(userId, projectId);
        //TODO store this information in the DB
        await this.auth.setProjectVisibility(userId, projectId, project.teamId, visibility);
    }

    async deleteProject(userId: string, projectId: string, transactionCtx?: TransactionalContext): Promise<void> {
        await this.auth.checkPermissionOnProject(userId, "delete", projectId);

        let orgId: string | undefined = undefined;
        try {
            await this.projectDB.transaction(transactionCtx, async (db) => {
                const project = await db.findProjectById(projectId);
                if (!project) {
                    throw new Error("Project does not exist");
                }
                orgId = project.teamId;
                await db.markDeleted(projectId);

                await this.auth.removeProjectFromOrg(userId, orgId, projectId);
            });
            this.analytics.track({
                userId,
                event: "project_deleted",
                properties: {
                    project_id: projectId,
                },
            });
        } catch (err) {
            if (orgId) {
                await this.auth.addProjectToOrg(userId, orgId, projectId);
            }
            throw err;
        }
    }

    async findPrebuilds(userId: string, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        const { projectId, prebuildId } = params;
        await this.auth.checkPermissionOnProject(userId, "read_prebuild", projectId);
        const project = await this.projectDB.findProjectById(projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        if (!parsedUrl) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, `Invalid clone URL on project ${projectId}.`);
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
            const branch = params.branch;
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

    async updateProject(user: User, partialProject: PartialProject): Promise<void> {
        await this.auth.checkPermissionOnProject(user.id, "write_info", partialProject.id);

        const partial: PartialProject = { id: partialProject.id };
        if (partialProject.name) {
            partialProject.name = partialProject.name.trim();
            // check it is between 0 and 32 characters
            if (partialProject.name.length > 32) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Project name must be less than 32 characters.");
            }
            if (partialProject.name.length === 0) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Project name must not be empty.");
            }
        }
        const allowedFields: (keyof Project)[] = ["settings", "name"];
        for (const f of allowedFields) {
            if (f in partialProject) {
                (partial as any)[f] = partialProject[f];
            }
        }
        await this.handleEnablePrebuild(user, partialProject);
        return this.projectDB.updateProject(partialProject);
    }

    private async handleEnablePrebuild(user: User, partialProject: PartialProject): Promise<void> {
        const enablePrebuildsNew = partialProject?.settings?.enablePrebuilds;
        if (typeof enablePrebuildsNew === "boolean") {
            const project = await this.projectDB.findProjectById(partialProject.id);
            if (!project) {
                return;
            }
            const enablePrebuildsPrev = !!project.settings?.enablePrebuilds;
            const installWebhook = enablePrebuildsNew && !enablePrebuildsPrev;
            const uninstallWebhook = !enablePrebuildsNew && enablePrebuildsPrev;
            if (installWebhook) {
                await this.scmService.installWebhookForPrebuilds(project, user);
            }
            if (uninstallWebhook) {
                // TODO
                // await this.scmService.uninstallWebhookForPrebuilds(project, user);
            }
        }
    }

    async isProjectConsideredInactive(userId: string, projectId: string): Promise<boolean> {
        await this.auth.checkPermissionOnProject(userId, "read_info", projectId);
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
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project with ${cloneUrl} not found.`);
        }
        try {
            await this.auth.checkPermissionOnProject(userId, "read_info", project.id);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project with ${cloneUrl} not found.`);
        }
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
            message: we.message,
        }));
    }
}
