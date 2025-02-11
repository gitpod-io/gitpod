/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    EnvVar,
    EnvVarWithValue,
    OrgEnvVar,
    OrgEnvVarWithValue,
    Project,
    ProjectEnvVar,
    ProjectEnvVarWithValue,
    UserEnvVar,
    UserEnvVarValue,
    WithEnvvarsContext,
    WorkspaceConfig,
    WorkspaceContext,
    WorkspaceType,
} from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/authorizer";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Config } from "../config";

export interface ResolvedEnvVars {
    /**
     * Credentials for private Docker registries, if it was present in the `workspace` env vars.
     * Always be filled, even if project settings hide it from workspaces.
     */
    gitpodImageAuth?: Map<string, string>;

    /**
     * Merged workspace env vars (incl. org, user, project)
     * Will exactly contain the env vars a workspace can/should be able to access.
     */
    workspace: EnvVarWithValue[];
}

@injectable()
export class EnvVarService {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(TeamDB) private readonly orgDB: TeamDB,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
    ) {}

    async listUserEnvVars(
        requestorId: string,
        userId: string,
        oldPermissionCheck?: (envvar: UserEnvVar) => Promise<boolean>, // @deprecated
    ): Promise<UserEnvVarValue[]> {
        await this.auth.checkPermissionOnUser(requestorId, "read_env_var", userId);
        const result: UserEnvVarValue[] = [];
        for (const value of await this.userDB.getEnvVars(userId)) {
            if (oldPermissionCheck && !(await oldPermissionCheck(value))) {
                continue;
            }
            result.push({
                id: value.id,
                name: value.name,
                value: value.value,
                repositoryPattern: value.repositoryPattern,
            });
        }
        return result;
    }

    async addUserEnvVar(
        requestorId: string,
        userId: string,
        variable: UserEnvVarValue,
        oldPermissionCheck?: (envvar: UserEnvVar) => Promise<void>, // @deprecated
    ): Promise<UserEnvVarValue> {
        const validationError = UserEnvVar.validate(variable);
        if (validationError) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, validationError);
        }
        await this.auth.checkPermissionOnUser(requestorId, "write_env_var", userId);

        variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);

        const existingVar = await this.userDB.findEnvVar(userId, variable);
        if (existingVar) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Env var ${variable.name} already exists`);
        }

        // this is a new variable - make sure the user does not have too many (don't DOS our database using gp env)
        const allEnvVars = await this.userDB.getEnvVars(userId);
        if (allEnvVars.length > this.config.maxEnvvarPerUserCount) {
            throw new ApplicationError(
                ErrorCodes.PERMISSION_DENIED,
                `cannot have more than ${this.config.maxEnvvarPerUserCount} environment variables`,
            );
        }

        if (oldPermissionCheck) {
            await oldPermissionCheck({ ...variable, userId, id: "" });
        }
        this.analytics.track({ event: "envvar-set", userId });

        return await this.userDB.addEnvVar(userId, variable);
    }

    async updateUserEnvVar(
        requestorId: string,
        userId: string,
        variable: UserEnvVarValue,
        oldPermissionCheck?: (envvar: UserEnvVar) => Promise<void>, // @deprecated
    ): Promise<UserEnvVarValue> {
        const validationError = UserEnvVar.validate(variable);
        if (validationError) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, validationError);
        }
        await this.auth.checkPermissionOnUser(requestorId, "write_env_var", userId);

        variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);

        if (oldPermissionCheck) {
            await oldPermissionCheck({ ...variable, userId, id: variable.id! });
        }
        this.analytics.track({ event: "envvar-set", userId });

        const result = await this.userDB.updateEnvVar(userId, variable);
        if (!result) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Env var ${variable.name} does not exists`);
        }

        return result;
    }

    async deleteUserEnvVar(
        requestorId: string,
        userId: string,
        variable: UserEnvVarValue,
        oldPermissionCheck?: (envvar: UserEnvVar) => Promise<void>, // @deprecated
    ): Promise<void> {
        await this.auth.checkPermissionOnUser(requestorId, "write_env_var", userId);
        let envVarId = variable.id;
        if (!variable.id && variable.name && variable.repositoryPattern) {
            variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);
            const existingVar = await this.userDB.findEnvVar(userId, variable);
            envVarId = existingVar?.id;
        }

        if (!envVarId) {
            throw new ApplicationError(
                ErrorCodes.NOT_FOUND,
                `cannot delete '${variable.name}' in scope '${variable.repositoryPattern}'`,
            );
        }

        const envvar: UserEnvVar = {
            ...variable,
            id: envVarId,
            userId,
        };
        if (oldPermissionCheck) {
            await oldPermissionCheck(envvar);
        }
        this.analytics.track({ event: "envvar-deleted", userId });

        await this.userDB.deleteEnvVar(envvar);
    }

    async listProjectEnvVars(requestorId: string, projectId: string): Promise<ProjectEnvVar[]> {
        await this.auth.checkPermissionOnProject(requestorId, "read_env_var", projectId);
        return this.projectDB.getProjectEnvironmentVariables(projectId);
    }

    async getProjectEnvVarById(requestorId: string, variableId: string): Promise<ProjectEnvVar> {
        const result = await this.projectDB.getProjectEnvironmentVariableById(variableId);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Environment Variable ${variableId} not found.`);
        }
        try {
            await this.auth.checkPermissionOnProject(requestorId, "read_env_var", result.projectId);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Environment Variable ${variableId} not found.`);
        }
        return result;
    }

    async addProjectEnvVar(
        requestorId: string,
        projectId: string,
        envVar: ProjectEnvVarWithValue,
    ): Promise<ProjectEnvVar> {
        await this.auth.checkPermissionOnProject(requestorId, "write_env_var", projectId);
        this.validateProjectOrOrgEnvVar(envVar);
        const existingVar = await this.projectDB.findProjectEnvironmentVariableByName(projectId, envVar.name);
        if (existingVar) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Project env var ${envVar.name} already exists`);
        }

        return await this.projectDB.addProjectEnvironmentVariable(projectId, envVar);
    }

    validateProjectOrOrgEnvVar(envVar: Partial<ProjectEnvVarWithValue>) {
        if (!envVar.name) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Variable name cannot be empty");
        }
        if (!EnvVar.WhiteListFromReserved.includes(envVar.name) && envVar.name.startsWith("GITPOD_")) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Variable name with prefix 'GITPOD_' is reserved");
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(envVar.name)) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "Please choose a variable name containing only letters, numbers, or _, and which doesn't start with a number",
            );
        }
    }

    async updateProjectEnvVar(
        requestorId: string,
        projectId: string,
        envVar: Partial<ProjectEnvVarWithValue>,
    ): Promise<ProjectEnvVar> {
        await this.auth.checkPermissionOnProject(requestorId, "write_env_var", projectId);
        this.validateProjectOrOrgEnvVar(envVar);
        const result = await this.projectDB.updateProjectEnvironmentVariable(projectId, envVar);
        if (!result) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Project env var ${envVar.name} does not exists`);
        }

        return result;
    }

    async deleteProjectEnvVar(requestorId: string, variableId: string): Promise<void> {
        const variable = await this.getProjectEnvVarById(requestorId, variableId);
        await this.auth.checkPermissionOnProject(requestorId, "write_env_var", variable.projectId);
        return this.projectDB.deleteProjectEnvironmentVariable(variableId);
    }

    async listOrgEnvVars(requestorId: string, orgId: string): Promise<OrgEnvVar[]> {
        await this.auth.checkPermissionOnOrganization(requestorId, "read_env_var", orgId);
        return this.orgDB.getOrgEnvironmentVariables(orgId);
    }

    async listOrgEnvVarsWithValues(requestorId: string, orgId: string): Promise<OrgEnvVarWithValue[]> {
        const envVars = (await ApplicationError.notFoundToUndefined(this.listOrgEnvVars(requestorId, orgId))) ?? [];
        const envVarValues = await this.orgDB.getOrgEnvironmentVariableValues(envVars);

        return envVarValues;
    }

    async getOrgEnvVarById(requestorId: string, id: string): Promise<OrgEnvVar> {
        const result = await this.orgDB.getOrgEnvironmentVariableById(id);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Environment Variable ${id} not found.`);
        }
        try {
            await this.auth.checkPermissionOnOrganization(requestorId, "read_env_var", result.orgId);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Environment Variable ${id} not found.`);
        }
        return result;
    }

    async addOrgEnvVar(requestorId: string, orgId: string, envVar: OrgEnvVarWithValue): Promise<OrgEnvVar> {
        await this.auth.checkPermissionOnOrganization(requestorId, "write_env_var", orgId);
        this.validateProjectOrOrgEnvVar(envVar);

        // gpl: We only intent to use org-level env vars for this very specific use case right now.
        // If we every want to use it more generically, just lift this restriction
        if (envVar.name !== EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "Can only update GITPOD_IMAGE_AUTH env var on org level",
            );
        }

        const existingVar = await this.orgDB.findOrgEnvironmentVariableByName(orgId, envVar.name);
        if (existingVar) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Organization env var ${envVar.name} already exists`);
        }

        return await this.orgDB.addOrgEnvironmentVariable(orgId, envVar);
    }

    async updateOrgEnvVar(requestorId: string, orgId: string, envVar: Partial<OrgEnvVarWithValue>): Promise<OrgEnvVar> {
        await this.auth.checkPermissionOnOrganization(requestorId, "write_env_var", orgId);
        this.validateProjectOrOrgEnvVar(envVar);

        const result = await this.orgDB.updateOrgEnvironmentVariable(orgId, envVar);
        if (!result) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Organization env var ${envVar.name} does not exists`);
        }

        return result;
    }

    async deleteOrgEnvVar(requestorId: string, variableId: string): Promise<void> {
        const variable = await this.getOrgEnvVarById(requestorId, variableId);
        await this.auth.checkPermissionOnOrganization(requestorId, "write_env_var", variable.orgId);
        return this.orgDB.deleteOrgEnvironmentVariable(variableId);
    }

    async resolveEnvVariables(
        requestorId: string,
        organizationId: string,
        projectId: string | undefined,
        wsType: WorkspaceType,
        wsContext: WorkspaceContext,
        wsConfig?: WorkspaceConfig,
    ): Promise<ResolvedEnvVars> {
        const isPrebuild = wsType === "prebuild";
        if (!isPrebuild) {
            await this.auth.checkPermissionOnUser(requestorId, "read_env_var", requestorId);
        }
        if (projectId) {
            await this.auth.checkPermissionOnProject(requestorId, "read_env_var", projectId);
            await this.auth.checkPermissionOnOrganization(requestorId, "read_env_var", organizationId);
        }

        const workspaceEnvVars = new Map<String, EnvVar>();
        const merge = (envs: EnvVar[]) => {
            for (const env of envs) {
                workspaceEnvVars.set(env.name, env);
            }
        };

        // 1. first merge the `env` in the .gitpod.yml
        if (wsConfig?.env) {
            const configEnvVars = Object.entries(wsConfig.env as Record<string, string>).map(([name, value]) => ({
                name,
                value,
            }));
            merge(configEnvVars);
        }

        // 2. then org env vars (if applicable)
        if (projectId) {
            // !!! Important: Only apply the org env vars if the workspace is part of a project
            // This is to prevent leaking org env vars to workspaces randomly started in an organization (safety feature)
            const orgEnvVars =
                (await ApplicationError.notFoundToUndefined(this.listOrgEnvVars(requestorId, organizationId))) || [];
            const withValues: OrgEnvVarWithValue[] = await this.orgDB.getOrgEnvironmentVariableValues(orgEnvVars);
            merge(withValues);
        }

        // 3. then user envs (if not a prebuild)
        if (!isPrebuild && CommitContext.is(wsContext)) {
            // this is a commit context, thus we can filter the env vars
            const userEnvVars = await this.userDB.getEnvVars(requestorId);
            merge(UserEnvVar.filter(userEnvVars, wsContext.repository.owner, wsContext.repository.name));
        }

        // 4. then from the project
        const projectEnvVars = projectId
            ? (await ApplicationError.notFoundToUndefined(this.listProjectEnvVars(requestorId, projectId))) || []
            : [];
        if (projectEnvVars.length) {
            let availablePrjEnvVars = projectEnvVars;
            if (!isPrebuild) {
                // If "censored", a variable is only visible in Prebuilds, so we have to filter it out for other workspace types
                availablePrjEnvVars = availablePrjEnvVars.filter((variable) => !variable.censored);
            }
            const withValues = await this.projectDB.getProjectEnvironmentVariableValues(availablePrjEnvVars);
            merge(withValues);
        }

        // 5. then parsed from the context URL
        if (WithEnvvarsContext.is(wsContext)) {
            merge(wsContext.envvars);
        }

        // GITPOD_IMAGE_AUTH is a special case: it is only passed into the workspace if the project settings allow it
        const credentials = EnvVar.getGitpodImageAuth([...workspaceEnvVars.values()]);
        let project: Project | undefined;
        if (projectId) {
            project = await this.projectDB.findProjectById(projectId);
        }
        if (!project?.settings?.enableDockerdAuthentication) {
            workspaceEnvVars.delete(EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME);
        }

        return {
            gitpodImageAuth: credentials,
            workspace: [...workspaceEnvVars.values()],
        };
    }
}
