/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
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
    ListOrganizationEnvironmentVariablesRequest,
    ListOrganizationEnvironmentVariablesResponse,
    UpdateOrganizationEnvironmentVariableRequest,
    UpdateOrganizationEnvironmentVariableResponse,
    CreateOrganizationEnvironmentVariableRequest,
    CreateOrganizationEnvironmentVariableResponse,
    DeleteOrganizationEnvironmentVariableRequest,
    DeleteOrganizationEnvironmentVariableResponse,
    ResolveWorkspaceEnvironmentVariablesResponse,
    ResolveWorkspaceEnvironmentVariablesRequest,
    EnvironmentVariable,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { inject, injectable } from "inversify";
import { EnvVarService } from "../user/env-var-service";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { ProjectEnvVarWithValue, UserEnvVarValue } from "@gitpod/gitpod-protocol";
import { WorkspaceService } from "../workspace/workspace-service";
import { ctxUserId } from "../util/request-context";
import { validate as uuidValidate } from "uuid";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

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
        _: HandlerContext,
    ): Promise<ListUserEnvironmentVariablesResponse> {
        const response = new ListUserEnvironmentVariablesResponse();
        const userEnvVars = await this.envVarService.listUserEnvVars(ctxUserId(), ctxUserId());
        response.environmentVariables = userEnvVars.map((i) => this.apiConverter.toUserEnvironmentVariable(i));

        return response;
    }

    async updateUserEnvironmentVariable(
        req: UpdateUserEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<UpdateUserEnvironmentVariableResponse> {
        if (!uuidValidate(req.environmentVariableId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        const response = new UpdateUserEnvironmentVariableResponse();

        const userEnvVars = await this.envVarService.listUserEnvVars(ctxUserId(), ctxUserId());
        const userEnvVarfound = userEnvVars.find((i) => i.id === req.environmentVariableId);
        if (userEnvVarfound) {
            const variable: UserEnvVarValue = {
                id: req.environmentVariableId,
                name: req.name ?? userEnvVarfound.name,
                value: req.value ?? userEnvVarfound.value,
                repositoryPattern: req.repositoryPattern ?? userEnvVarfound.repositoryPattern,
            };

            const updatedUsertEnvVar = await this.envVarService.updateUserEnvVar(ctxUserId(), ctxUserId(), variable);

            response.environmentVariable = this.apiConverter.toUserEnvironmentVariable(updatedUsertEnvVar);
            return response;
        }

        throw new ApplicationError(ErrorCodes.NOT_FOUND, "env variable not found");
    }

    async createUserEnvironmentVariable(
        req: CreateUserEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<CreateUserEnvironmentVariableResponse> {
        const response = new CreateUserEnvironmentVariableResponse();

        const variable: UserEnvVarValue = {
            name: req.name,
            value: req.value,
            repositoryPattern: req.repositoryPattern,
        };

        const result = await this.envVarService.addUserEnvVar(ctxUserId(), ctxUserId(), variable);
        response.environmentVariable = this.apiConverter.toUserEnvironmentVariable(result);

        return response;
    }

    async deleteUserEnvironmentVariable(
        req: DeleteUserEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<DeleteUserEnvironmentVariableResponse> {
        if (!uuidValidate(req.environmentVariableId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        const variable: UserEnvVarValue = {
            id: req.environmentVariableId,
            name: "",
            value: "",
            repositoryPattern: "",
        };

        await this.envVarService.deleteUserEnvVar(ctxUserId(), ctxUserId(), variable);

        const response = new DeleteUserEnvironmentVariableResponse();
        return response;
    }

    async listConfigurationEnvironmentVariables(
        req: ListConfigurationEnvironmentVariablesRequest,
        _: HandlerContext,
    ): Promise<ListConfigurationEnvironmentVariablesResponse> {
        if (!uuidValidate(req.configurationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }

        const response = new ListConfigurationEnvironmentVariablesResponse();
        const projectEnvVars = await this.envVarService.listProjectEnvVars(ctxUserId(), req.configurationId);
        response.environmentVariables = projectEnvVars.map((i) =>
            this.apiConverter.toConfigurationEnvironmentVariable(i),
        );

        return response;
    }

    async updateConfigurationEnvironmentVariable(
        req: UpdateConfigurationEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<UpdateConfigurationEnvironmentVariableResponse> {
        if (!uuidValidate(req.configurationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }
        if (!uuidValidate(req.environmentVariableId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        const updatedProjectEnvVar = await this.envVarService.updateProjectEnvVar(ctxUserId(), req.configurationId, {
            id: req.environmentVariableId,
            name: req.name,
            value: req.value,
            censored: req.admission ? req.admission === EnvironmentVariableAdmission.PREBUILD : undefined,
        });

        const response = new UpdateConfigurationEnvironmentVariableResponse();
        response.environmentVariable = this.apiConverter.toConfigurationEnvironmentVariable(updatedProjectEnvVar);
        return response;
    }

    async createConfigurationEnvironmentVariable(
        req: CreateConfigurationEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<CreateConfigurationEnvironmentVariableResponse> {
        const variable: ProjectEnvVarWithValue = {
            name: req.name,
            value: req.value,
            censored: req.admission === EnvironmentVariableAdmission.PREBUILD ? true : false,
        };

        const result = await this.envVarService.addProjectEnvVar(ctxUserId(), req.configurationId, variable);

        const response = new CreateConfigurationEnvironmentVariableResponse();
        response.environmentVariable = this.apiConverter.toConfigurationEnvironmentVariable(result);
        return response;
    }

    async deleteConfigurationEnvironmentVariable(
        req: DeleteConfigurationEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<DeleteConfigurationEnvironmentVariableResponse> {
        if (!uuidValidate(req.environmentVariableId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        await this.envVarService.deleteProjectEnvVar(ctxUserId(), req.environmentVariableId);

        const response = new DeleteConfigurationEnvironmentVariableResponse();
        return response;
    }

    async listOrganizationEnvironmentVariables(
        req: ListOrganizationEnvironmentVariablesRequest,
        _: HandlerContext,
    ): Promise<ListOrganizationEnvironmentVariablesResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const response = new ListOrganizationEnvironmentVariablesResponse();
        const orgEnvVars = await this.envVarService.listOrgEnvVars(ctxUserId(), req.organizationId);
        response.environmentVariables = orgEnvVars.map((i) => this.apiConverter.toOrganizationEnvironmentVariable(i));

        return response;
    }

    async updateOrganizationEnvironmentVariable(
        req: UpdateOrganizationEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<UpdateOrganizationEnvironmentVariableResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (!uuidValidate(req.environmentVariableId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        const updatedOrgEnvVar = await this.envVarService.updateOrgEnvVar(ctxUserId(), req.organizationId, {
            id: req.environmentVariableId,
            name: req.name,
            value: req.value,
        });

        const response = new UpdateOrganizationEnvironmentVariableResponse();
        response.environmentVariable = this.apiConverter.toOrganizationEnvironmentVariable(updatedOrgEnvVar);
        return response;
    }

    async createOrganizationEnvironmentVariable(
        req: CreateOrganizationEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<CreateOrganizationEnvironmentVariableResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const result = await this.envVarService.addOrgEnvVar(ctxUserId(), req.organizationId, {
            name: req.name,
            value: req.value,
        });

        const response = new CreateOrganizationEnvironmentVariableResponse();
        response.environmentVariable = this.apiConverter.toOrganizationEnvironmentVariable(result);
        return response;
    }

    async deleteOrganizationEnvironmentVariable(
        req: DeleteOrganizationEnvironmentVariableRequest,
        _: HandlerContext,
    ): Promise<DeleteOrganizationEnvironmentVariableResponse> {
        if (!uuidValidate(req.environmentVariableId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        await this.envVarService.deleteOrgEnvVar(ctxUserId(), req.environmentVariableId);

        const response = new DeleteOrganizationEnvironmentVariableResponse();
        return response;
    }

    async resolveWorkspaceEnvironmentVariables(
        req: ResolveWorkspaceEnvironmentVariablesRequest,
        _: HandlerContext,
    ): Promise<ResolveWorkspaceEnvironmentVariablesResponse> {
        const response = new ResolveWorkspaceEnvironmentVariablesResponse();

        const { workspace } = await this.workspaceService.getWorkspace(ctxUserId(), req.workspaceId);
        const envVars = await this.envVarService.resolveEnvVariables(
            workspace.ownerId,
            workspace.organizationId,
            workspace.projectId,
            workspace.type,
            workspace.context,
        );

        response.environmentVariables = envVars.workspace.map(
            (i) => new EnvironmentVariable({ name: i.name, value: i.value }),
        );

        return response;
    }
}
