/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, UserDB } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    EnvVar,
    ProjectEnvVar,
    ProjectEnvVarWithValue,
    UserEnvVar,
    UserEnvVarValue,
    WithEnvvarsContext,
    WorkspaceContext,
    WorkspaceType,
} from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/authorizer";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Config } from "../config";

export interface ResolvedEnvVars {
    // all project env vars, censored included always
    project: ProjectEnvVar[];
    // merged workspace env vars
    workspace: EnvVar[];
}

@injectable()
export class EnvVarService {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
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
        this.validateProjectEnvVar(envVar);
        await this.auth.checkPermissionOnProject(requestorId, "write_env_var", projectId);
        const existingVar = await this.projectDB.findProjectEnvironmentVariable(projectId, envVar);
        if (existingVar) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Project env var ${envVar.name} already exists`);
        }

        return await this.projectDB.addProjectEnvironmentVariable(projectId, envVar);
    }

    validateProjectEnvVar(envVar: Partial<ProjectEnvVarWithValue>) {
        if (!envVar.name) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Variable name cannot be empty");
        }
        if (!UserEnvVar.WhiteListFromReserved.includes(envVar.name) && envVar.name.startsWith("GITPOD_")) {
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
        this.validateProjectEnvVar(envVar);
        await this.auth.checkPermissionOnProject(requestorId, "write_env_var", projectId);
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

    async resolveEnvVariables(
        requestorId: string,
        projectId: string | undefined,
        wsType: WorkspaceType,
        wsContext: WorkspaceContext,
    ): Promise<ResolvedEnvVars> {
        await this.auth.checkPermissionOnUser(requestorId, "read_env_var", requestorId);
        if (projectId) {
            await this.auth.checkPermissionOnProject(requestorId, "read_env_var", projectId);
        }

        const workspaceEnvVars = new Map<String, EnvVar>();
        const merge = (envs: EnvVar[]) => {
            for (const env of envs) {
                workspaceEnvVars.set(env.name, env);
            }
        };

        const projectEnvVars = projectId
            ? (await ApplicationError.notFoundToUndefined(this.listProjectEnvVars(requestorId, projectId))) || []
            : [];

        if (wsType === "prebuild") {
            // prebuild does not have access to user env vars and cannot be started via prewfix URL
            const withValues = await this.projectDB.getProjectEnvironmentVariableValues(projectEnvVars);
            merge(withValues);
            return {
                project: projectEnvVars,
                workspace: [...workspaceEnvVars.values()],
            };
        }

        // 1. first merge user envs
        if (CommitContext.is(wsContext)) {
            // this is a commit context, thus we can filter the env vars
            const userEnvVars = await this.userDB.getEnvVars(requestorId);
            merge(UserEnvVar.filter(userEnvVars, wsContext.repository.owner, wsContext.repository.name));
        }

        // 2. then from the project
        if (projectEnvVars.length) {
            // Instead of using an access guard for Project environment variables, we let Project owners decide whether
            // a variable should be:
            //   - exposed in all workspaces (even for non-Project members when the repository is public), or
            //   - censored from all workspaces (even for Project members)
            const availablePrjEnvVars = projectEnvVars.filter((variable) => !variable.censored);
            const withValues = await this.projectDB.getProjectEnvironmentVariableValues(availablePrjEnvVars);
            merge(withValues);
        }

        // 3. then parsed from the context URL
        if (WithEnvvarsContext.is(wsContext)) {
            merge(wsContext.envvars);
        }

        return {
            project: projectEnvVars,
            workspace: [...workspaceEnvVars.values()],
        };
    }
}
