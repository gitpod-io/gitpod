/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { EnvironmentVariableService as EnvironmentVariableServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/envvar_connect";
import {
    ListUserEnvironmentVariablesRequest,
    ListUserEnvironmentVariablesResponse,
    UpdateUserEnvironmentVariableRequest,
    UpdateUserEnvironmentVariableResponse,
    DeleteUserEnvironmentVariableRequest,
    DeleteUserEnvironmentVariableResponse,
    CreateUserEnvironmentVariableRequest,
    CreateUserEnvironmentVariableResponse,
    ListConfigurationEnvironmentVariablesRequest,
    ListConfigurationEnvironmentVariablesResponse,
    UpdateConfigurationEnvironmentVariableRequest,
    UpdateConfigurationEnvironmentVariableResponse,
    EnvironmentVariableAdmission,
    CreateConfigurationEnvironmentVariableRequest,
    CreateConfigurationEnvironmentVariableResponse,
    DeleteConfigurationEnvironmentVariableRequest,
    DeleteConfigurationEnvironmentVariableResponse,
    ResolveWorkspaceEnvironmentVariablesResponse,
    ResolveWorkspaceEnvironmentVariablesRequest,
    ResolveWorkspaceEnvironmentVariablesResponse_EnvironmentVariable,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { inject, injectable } from "inversify";
import { EnvVarService } from "../user/env-var-service";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { ProjectEnvVarWithValue, UserEnvVar, UserEnvVarValue } from "@gitpod/gitpod-protocol";
import { WorkspaceService } from "../workspace/workspace-service";

@injectable()
export class EnvironmentVariableServiceAPI implements ServiceImpl<typeof EnvironmentVariableServiceInterface> {
    @inject(EnvVarService)
    private readonly envVarService: EnvVarService;

    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService;

    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    async listUserEnvironmentVariables(
        req: ListUserEnvironmentVariablesRequest,
        context: HandlerContext,
    ): Promise<ListUserEnvironmentVariablesResponse> {
        const response = new ListUserEnvironmentVariablesResponse();
        const userEnvVars = await this.envVarService.listUserEnvVars(context.user.id, context.user.id);
        response.environmentVariables = userEnvVars.map((i) => this.apiConverter.toUserEnvironmentVariable(i));

        return response;
    }

    async updateUserEnvironmentVariable(
        req: UpdateUserEnvironmentVariableRequest,
        context: HandlerContext,
    ): Promise<UpdateUserEnvironmentVariableResponse> {
        if (!req.envVarId) {
            throw new ConnectError("envVarId is not set", Code.InvalidArgument);
        }

        const response = new UpdateUserEnvironmentVariableResponse();

        const userEnvVars = await this.envVarService.listUserEnvVars(context.user.id, context.user.id);
        const userEnvVarfound = userEnvVars.find((i) => i.id === req.envVarId);
        if (userEnvVarfound) {
            const variable: UserEnvVarValue = {
                name: req.name ?? userEnvVarfound.name,
                value: req.value ?? userEnvVarfound.value,
                repositoryPattern: req.repositoryPattern ?? userEnvVarfound.repositoryPattern,
            };
            variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);

            await this.envVarService.updateUserEnvVar(context.user.id, context.user.id, variable);

            const updatedUserEnvVars = await this.envVarService.listUserEnvVars(context.user.id, context.user.id);
            const updatedUserEnvVar = updatedUserEnvVars.find((i) => i.id === req.envVarId);
            if (!updatedUserEnvVar) {
                throw new ConnectError("could not update env variable", Code.Internal);
            }

            response.environmentVariable = this.apiConverter.toUserEnvironmentVariable(updatedUserEnvVar);
            return response;
        }

        throw new ConnectError("env variable not found", Code.InvalidArgument);
    }

    async createUserEnvironmentVariable(
        req: CreateUserEnvironmentVariableRequest,
        context: HandlerContext,
    ): Promise<CreateUserEnvironmentVariableResponse> {
        const response = new CreateUserEnvironmentVariableResponse();

        const variable: UserEnvVarValue = {
            name: req.name,
            value: req.value,
            repositoryPattern: req.repositoryPattern,
        };
        variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);

        await this.envVarService.addUserEnvVar(context.user.id, context.user.id, variable);

        const updatedUserEnvVars = await this.envVarService.listUserEnvVars(context.user.id, context.user.id);
        const updatedUserEnvVar = updatedUserEnvVars.find(
            (v) => v.name === variable.name && v.repositoryPattern === variable.repositoryPattern,
        );
        if (!updatedUserEnvVar) {
            throw new ConnectError("could not create env variable", Code.Internal);
        }

        response.environmentVariable = this.apiConverter.toUserEnvironmentVariable(updatedUserEnvVar);

        return response;
    }

    async deleteUserEnvironmentVariable(
        req: DeleteUserEnvironmentVariableRequest,
        context: HandlerContext,
    ): Promise<DeleteUserEnvironmentVariableResponse> {
        const variable: UserEnvVarValue = {
            id: req.envVarId,
            name: "",
            value: "",
            repositoryPattern: "",
        };

        await this.envVarService.deleteUserEnvVar(context.user.id, context.user.id, variable);

        const response = new DeleteUserEnvironmentVariableResponse();
        return response;
    }

    async listConfigurationEnvironmentVariables(
        req: ListConfigurationEnvironmentVariablesRequest,
        context: HandlerContext,
    ): Promise<ListConfigurationEnvironmentVariablesResponse> {
        const response = new ListConfigurationEnvironmentVariablesResponse();
        const projectEnvVars = await this.envVarService.listProjectEnvVars(context.user.id, req.configurationId);
        response.environmentVariables = projectEnvVars.map((i) =>
            this.apiConverter.toConfigurationEnvironmentVariable(i),
        );

        return response;
    }

    async updateConfigurationEnvironmentVariable(
        req: UpdateConfigurationEnvironmentVariableRequest,
        context: HandlerContext,
    ): Promise<UpdateConfigurationEnvironmentVariableResponse> {
        const response = new UpdateConfigurationEnvironmentVariableResponse();

        const projectEnvVars = await this.envVarService.listProjectEnvVars(context.user.id, req.configurationId);
        const projectEnvVarfound = projectEnvVars.find((i) => i.id === req.envVarId);
        if (projectEnvVarfound) {
            const variable: ProjectEnvVarWithValue = {
                name: req.name ?? projectEnvVarfound.name,
                value: "",
                censored:
                    (req.admission === EnvironmentVariableAdmission.PREBUILD ? true : false) ??
                    projectEnvVarfound.censored,
            };

            await this.envVarService.updateProjectEnvVar(context.user.id, req.configurationId, variable);

            const updatedProjectEnvVars = await this.envVarService.listProjectEnvVars(
                context.user.id,
                req.configurationId,
            );
            const updatedProjectEnvVar = updatedProjectEnvVars.find((i) => i.id === req.envVarId);
            if (!updatedProjectEnvVar) {
                throw new ConnectError("could not update env variable", Code.Internal);
            }

            response.environmentVariable = this.apiConverter.toConfigurationEnvironmentVariable(updatedProjectEnvVar);
            return response;
        }

        throw new ConnectError("env variable not found", Code.InvalidArgument);
    }

    async createConfigurationEnvironmentVariable(
        req: CreateConfigurationEnvironmentVariableRequest,
        context: HandlerContext,
    ): Promise<CreateConfigurationEnvironmentVariableResponse> {
        const response = new CreateConfigurationEnvironmentVariableResponse();

        const variable: ProjectEnvVarWithValue = {
            name: req.name,
            value: req.value,
            censored: req.admission === EnvironmentVariableAdmission.PREBUILD ? true : false,
        };

        await this.envVarService.addProjectEnvVar(context.user.id, req.configurationId, variable);

        const updatedProjectEnvVars = await this.envVarService.listProjectEnvVars(context.user.id, req.configurationId);
        const updatedProjectEnvVar = updatedProjectEnvVars.find((v) => v.name === variable.name);
        if (!updatedProjectEnvVar) {
            throw new ConnectError("could not create env variable", Code.Internal);
        }

        response.environmentVariable = this.apiConverter.toConfigurationEnvironmentVariable(updatedProjectEnvVar);

        return response;
    }

    async deleteConfigurationEnvironmentVariable(
        req: DeleteConfigurationEnvironmentVariableRequest,
        context: HandlerContext,
    ): Promise<DeleteConfigurationEnvironmentVariableResponse> {
        await this.envVarService.deleteProjectEnvVar(context.user.id, req.envVarId);

        const response = new DeleteConfigurationEnvironmentVariableResponse();
        return response;
    }

    async resolveWorkspaceEnvironmentVariables(
        req: ResolveWorkspaceEnvironmentVariablesRequest,
        context: HandlerContext,
    ): Promise<ResolveWorkspaceEnvironmentVariablesResponse> {
        const response = new ResolveWorkspaceEnvironmentVariablesResponse();

        const { workspace } = await this.workspaceService.getWorkspace(context.user.id, req.workspaceId);
        const envVars = await this.envVarService.resolveEnvVariables(
            workspace.ownerId,
            workspace.projectId,
            workspace.type,
            workspace.context,
        );

        response.environmentVariables = envVars.workspace.map(
            (i) =>
                new ResolveWorkspaceEnvironmentVariablesResponse_EnvironmentVariable({ name: i.name, value: i.value }),
        );

        return response;
    }
}
