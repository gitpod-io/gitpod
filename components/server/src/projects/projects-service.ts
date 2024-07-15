/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { DBWithTracing, ProjectDB, TracedWorkspaceDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    Branch,
    PrebuildWithStatus,
    CreateProjectParams,
    FindPrebuildsParams,
    Project,
    User,
} from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { RepoURL } from "../repohost";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    PartialProject,
    PrebuildSettings,
    ProjectSettings,
    ProjectUsage,
} from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { URL } from "url";
import { Authorizer, SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";
import { TransactionalContext } from "@gitpod/gitpod-db/lib/typeorm/transactional-db-impl";
import { daysBefore, isDateSmaller } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import deepmerge from "deepmerge";
import { runWithSubjectId } from "../util/request-context";
import { InstallationService } from "../auth/installation-service";
import { IDEService } from "../ide-service";
import type { PrebuildManager } from "../prebuilds/prebuild-manager";

// to resolve circular dependency issues
export const LazyPrebuildManager = Symbol("LazyPrebuildManager");
export type LazyPrebuildManager = () => PrebuildManager;

const MAX_PROJECT_NAME_LENGTH = 100;

@injectable()
export class ProjectsService {
    constructor(
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(TracedWorkspaceDB) private readonly workspaceDb: DBWithTracing<WorkspaceDB>,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(IDEService) private readonly ideService: IDEService,
        @inject(LazyPrebuildManager) private readonly prebuildManager: LazyPrebuildManager,

        @inject(InstallationService) private readonly installationService: InstallationService,
    ) {}

    async getProject(userId: string, projectId: string): Promise<Project> {
        await this.auth.checkPermissionOnProject(userId, "read_info", projectId);
        const project = await this.projectDB.findProjectById(projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }
        return this.migratePrebuildSettingsOnDemand(project);
    }

    async getProjects(userId: string, orgId: string): Promise<Project[]> {
        await this.auth.checkPermissionOnOrganization(userId, "read_info", orgId);
        const projects = await this.projectDB.findProjects(orgId);
        const filteredProjects = await this.filterByReadAccess(userId, projects);
        return Promise.all(filteredProjects.map((p) => this.migratePrebuildSettingsOnDemand(p)));
    }

    async findProjects(
        userId: string,
        searchOptions: {
            offset?: number;
            limit?: number;
            orderBy?: keyof Project;
            orderDir?: "ASC" | "DESC";
            searchTerm?: string;
            organizationId?: string;
            prebuildsEnabled?: boolean;
        },
    ): Promise<{ total: number; rows: Project[] }> {
        if (searchOptions.organizationId) {
            await this.auth.checkPermissionOnOrganization(userId, "read_info", searchOptions.organizationId);
        } else {
            // If no org is provided need to check that user has installation admin scope
        }

        const projects = await this.projectDB.findProjectsBySearchTerm({
            offset: searchOptions.offset || 0,
            limit: searchOptions.limit || 1000,
            orderBy: searchOptions.orderBy || "creationTime",
            orderDir: searchOptions.orderDir || "ASC",
            searchTerm: searchOptions.searchTerm || "",
            organizationId: searchOptions.organizationId,
            prebuildsEnabled: searchOptions.prebuildsEnabled,
        });
        // TODO: adjust this to not filter entities, but log errors if any are not accessible for current user
        const rows = await this.filterByReadAccess(userId, projects.rows);
        const total = projects.total;
        return {
            total,
            rows: await Promise.all(rows.map((p) => this.migratePrebuildSettingsOnDemand(p))),
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

    async findProjectsByCloneUrl(userId: string, cloneUrl: string, organizationId?: string): Promise<Project[]> {
        const projects = await this.projectDB.findProjectsByCloneUrl(cloneUrl, organizationId);
        const result: Project[] = [];
        for (const project of projects) {
            if (await this.auth.hasPermissionOnProject(userId, "read_info", project.id)) {
                result.push(project);
            }
        }
        return Promise.all(result.map((p) => this.migratePrebuildSettingsOnDemand(p)));
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
        projectSettingsDefaults: ProjectSettings = { prebuilds: Project.PREBUILD_SETTINGS_DEFAULTS },
    ): Promise<Project> {
        await this.auth.checkPermissionOnOrganization(installer.id, "create_project", teamId);

        if (cloneUrl.length >= 1000) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be less than 1k characters.");
        }

        if (name.length > MAX_PROJECT_NAME_LENGTH) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                `Project name cannot be longer than ${MAX_PROJECT_NAME_LENGTH} characters.`,
            );
        }

        try {
            new URL(cloneUrl);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be a valid URL.");
        }

        const parsedUrl = RepoURL.parseRepoUrl(cloneUrl);
        if (!parsedUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be a repository URL.");
        }

        // Verify current user can reach the provided repo
        const hostContext = this.hostContextProvider.get(parsedUrl.host);
        if (!hostContext || !hostContext.services) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "No GIT provider has been configured for the provided repository.",
            );
        }
        const repoProvider = hostContext.services.repositoryProvider;
        if (!repoProvider) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "No GIT provider has been configured for the provided repository.",
            );
        }
        const canRead = await repoProvider.hasReadAccess(installer, parsedUrl.owner, parsedUrl.repo);
        if (!canRead) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "Repository URL seems to be inaccessible, or admin permissions are missing.",
            );
        }

        const project = Project.create({
            // Default to repository name
            name: name || parsedUrl.repo.substring(0, MAX_PROJECT_NAME_LENGTH),
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

                // delete env vars
                const envVars = await db.getProjectEnvironmentVariables(projectId);
                for (const envVar of envVars) {
                    await db.deleteProjectEnvironmentVariable(envVar.id);
                }

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
            const r = await this.prebuildManager().getPrebuild({}, userId, prebuildId);
            if (r) {
                result.push(r);
            }
        } else {
            let limit = params.limit !== undefined ? params.limit : 30;
            if (params.latest) {
                limit = 1;
            }
            const branch = params.branch;
            const prebuilds = await this.prebuildManager().listPrebuilds(
                {},
                userId,
                project.teamId,
                { limit, offset: 0 },
                { configuration: { id: project.id, branch } },
                { field: "creationTime", order: "DESC" },
            );
            result.push(...prebuilds);
        }
        return result;
    }

    async updateProject(user: User, partialProject: PartialProject): Promise<Project> {
        await this.auth.checkPermissionOnProject(user.id, "write_info", partialProject.id);

        if (typeof partialProject.name !== "undefined") {
            partialProject.name = partialProject.name.trim();
            if (partialProject.name.length > MAX_PROJECT_NAME_LENGTH) {
                throw new ApplicationError(
                    ErrorCodes.BAD_REQUEST,
                    `Project name must be less than ${MAX_PROJECT_NAME_LENGTH} characters.`,
                );
            }
            if (partialProject.name.length === 0) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Project name must not be empty.");
            }
        }

        const existingProject = await this.projectDB.findProjectById(partialProject.id);
        if (!existingProject) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${partialProject.id} not found.`);
        }

        // Merge settings so that clients don't need to pass previous value all the time
        // (not update setting field if undefined)
        if (partialProject.settings) {
            const toBeMerged: ProjectSettings = existingProject.settings ?? {};
            if (partialProject.settings.restrictedWorkspaceClasses) {
                // deepmerge will try append array, so once data is defined, ignore previous value
                toBeMerged.restrictedWorkspaceClasses = undefined;
            }
            if (partialProject.settings.restrictedEditorNames) {
                // deepmerge will try append array, so once data is defined, ignore previous value
                toBeMerged.restrictedEditorNames = undefined;
            }
            partialProject.settings = deepmerge(toBeMerged, partialProject.settings);
            await this.checkProjectSettings(user.id, partialProject.settings);
        }
        if (partialProject?.settings?.prebuilds?.enable) {
            const enablePrebuildsPrev = !!existingProject.settings?.prebuilds?.enable;
            if (!enablePrebuildsPrev) {
                // new default
                partialProject.settings.prebuilds.triggerStrategy = "activity-based";
            }
        }
        return this.projectDB.updateProject(partialProject);
    }
    private async checkProjectSettings(userId: string, settings?: PartialProject["settings"]) {
        if (!settings) {
            return;
        }
        if (settings.restrictedWorkspaceClasses) {
            const classList = settings.restrictedWorkspaceClasses.filter((cls) => !!cls) as string[];
            if (classList.length > 0) {
                // We don't check organization-level workspace classes since the field `restrictedWorkspaceClasses` in repository-level is a NOT ALLOW LIST
                const allClasses = await this.installationService.getInstallationWorkspaceClasses(userId);
                const notAllowedList = classList.filter((cls) => !allClasses.find((i) => i.id === cls));
                if (notAllowedList.length > 0) {
                    throw new ApplicationError(
                        ErrorCodes.BAD_REQUEST,
                        `Workspace classes ${notAllowedList.join(", ")} not allowed in installation`,
                    );
                }
            }
            settings.restrictedWorkspaceClasses = classList;
        }
        if (settings.restrictedEditorNames) {
            const options = settings.restrictedEditorNames.filter((e) => !!e) as string[];
            await this.ideService.checkEditorsAllowed(userId, options);
            settings.restrictedEditorNames = options;
        }
    }

    async isProjectConsideredInactive(userId: string, projectId: string): Promise<boolean> {
        const isOlderThan7Days = (d1: string) => isDateSmaller(d1, daysBefore(new Date().toISOString(), 7));

        await this.auth.checkPermissionOnProject(userId, "read_info", projectId);
        const usage = await this.projectDB.getProjectUsage(projectId);
        if (!usage?.lastWorkspaceStart) {
            const project = await this.projectDB.findProjectById(projectId);
            return !project || isOlderThan7Days(project.creationTime);
        }
        return isOlderThan7Days(usage.lastWorkspaceStart);
    }

    private async migratePrebuildSettingsOnDemand(project: Project): Promise<Project> {
        if (!!project.settings?.prebuilds) {
            return project; // already migrated
        }
        const projectSettings = project.settings as OldProjectSettings | undefined;
        try {
            const logCtx: any = { oldSettings: { ...projectSettings } };
            const newPrebuildSettings: PrebuildSettings = { enable: false, ...Project.PREBUILD_SETTINGS_DEFAULTS };

            // if workspaces were running in the past week
            const isInactive = await runWithSubjectId(SYSTEM_USER, async () =>
                this.isProjectConsideredInactive(SYSTEM_USER_ID, project.id),
            );
            logCtx.isInactive = isInactive;
            if (!isInactive) {
                const sevenDaysAgo = new Date(daysBefore(new Date().toISOString(), 7));
                const count = await this.workspaceDb.trace({}).countUnabortedPrebuildsSince(project.id, sevenDaysAgo);
                logCtx.count = count;
                if (count > 0) {
                    const defaults = Project.PREBUILD_SETTINGS_DEFAULTS;
                    newPrebuildSettings.enable = true;
                    newPrebuildSettings.prebuildInterval = Math.max(
                        projectSettings?.prebuildEveryNthCommit || 0,
                        defaults.prebuildInterval,
                    );

                    newPrebuildSettings.branchStrategy = !!projectSettings?.prebuildBranchPattern
                        ? "matched-branches"
                        : defaults.branchStrategy;
                    newPrebuildSettings.branchMatchingPattern =
                        projectSettings?.prebuildBranchPattern || defaults.branchMatchingPattern;
                    newPrebuildSettings.workspaceClass = projectSettings?.workspaceClasses?.prebuild;
                }
            }

            // update new settings
            project = (await this.projectDB.findProjectById(project.id))!;
            if (!project) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Not found");
            }
            if (!!projectSettings?.prebuilds) {
                return project; // already migrated
            }
            const newSettings = { ...projectSettings };
            newSettings.prebuilds = newPrebuildSettings;
            delete newSettings.enablePrebuilds;
            delete newSettings.prebuildBranchPattern;
            delete newSettings.prebuildDefaultBranchOnly;
            delete newSettings.prebuildEveryNthCommit;
            delete newSettings.allowUsingPreviousPrebuilds;
            delete newSettings.keepOutdatedPrebuildsRunning;
            delete newSettings.useIncrementalPrebuilds;
            delete newSettings.workspaceClasses?.prebuild;
            await this.projectDB.updateProject({
                id: project.id,
                settings: newSettings,
            });
            project.settings = newSettings;
            logCtx.newPrebuildSettings = newPrebuildSettings;
            log.info("Prebuild settings migrated.", { projectId: project.id, logCtx });

            return project;
        } catch (error) {
            log.error("Prebuild settings migration failed", error, {
                projectId: project.id,
            });
            return project;
        }
    }
}

/**
 * @deprecated
 */
export interface OldProjectSettings extends ProjectSettings {
    /** @deprecated see `Project.settings.prebuilds.enabled` instead. */
    enablePrebuilds?: boolean;
    /**
     * Wether prebuilds (if enabled) should only be started on the default branch.
     * Defaults to `true` on project creation.
     *
     * @deprecated see `Project.settings.prebuilds.branchStrategy` instead.
     */
    prebuildDefaultBranchOnly?: boolean;
    /**
     * Use this pattern to match branch names to run prebuilds on.
     * The pattern matching will only be applied if prebuilds are enabled and
     * they are not limited to the default branch.
     *
     * @deprecated see `Project.settings.prebuilds.branchMatchingPattern` instead.
     */
    prebuildBranchPattern?: string;
    /**
     * how many commits in the commit history a prebuild is good (undefined and 0 means every commit is prebuilt)
     *
     * @deprecated see `Project.settings.prebuilds.intervall` instead.
     */
    prebuildEveryNthCommit?: number;

    /**
     * @deprecated always false
     */
    useIncrementalPrebuilds?: boolean;

    /**
     * @deprecated always true (we should kill dangling prebuilds)
     */
    keepOutdatedPrebuildsRunning?: boolean;
    // whether new workspaces can start on older prebuilds and incrementally update
    /**
     * @deprecated always true
     */
    allowUsingPreviousPrebuilds?: boolean;
}
