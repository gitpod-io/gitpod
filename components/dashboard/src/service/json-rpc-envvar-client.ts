/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { EnvironmentVariableService } from "@gitpod/public-api/lib/gitpod/v1/envvar_connect";
import {
    CreateConfigurationEnvironmentVariableRequest,
    CreateConfigurationEnvironmentVariableResponse,
    CreateOrganizationEnvironmentVariableRequest,
    CreateOrganizationEnvironmentVariableResponse,
    CreateUserEnvironmentVariableRequest,
    CreateUserEnvironmentVariableResponse,
    DeleteConfigurationEnvironmentVariableRequest,
    DeleteConfigurationEnvironmentVariableResponse,
    DeleteOrganizationEnvironmentVariableRequest,
    DeleteOrganizationEnvironmentVariableResponse,
    DeleteUserEnvironmentVariableRequest,
    DeleteUserEnvironmentVariableResponse,
    EnvironmentVariableAdmission,
    ListConfigurationEnvironmentVariablesRequest,
    ListConfigurationEnvironmentVariablesResponse,
    ListOrganizationEnvironmentVariablesRequest,
    ListOrganizationEnvironmentVariablesResponse,
    ListUserEnvironmentVariablesRequest,
    ListUserEnvironmentVariablesResponse,
    ResolveWorkspaceEnvironmentVariablesRequest,
    ResolveWorkspaceEnvironmentVariablesResponse,
    UpdateConfigurationEnvironmentVariableRequest,
    UpdateConfigurationEnvironmentVariableResponse,
    UpdateOrganizationEnvironmentVariableRequest,
    UpdateOrganizationEnvironmentVariableResponse,
    UpdateUserEnvironmentVariableRequest,
    UpdateUserEnvironmentVariableResponse,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { converter } from "./public-api";
import { getGitpodService } from "./service";
import { UserEnvVar, UserEnvVarValue } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export class JsonRpcEnvvarClient implements PromiseClient<typeof EnvironmentVariableService> {
    async listUserEnvironmentVariables(
        req: PartialMessage<ListUserEnvironmentVariablesRequest>,
    ): Promise<ListUserEnvironmentVariablesResponse> {
        const result = new ListUserEnvironmentVariablesResponse();
        const userEnvVars = await getGitpodService().server.getAllEnvVars();
        result.environmentVariables = userEnvVars.map((i) => converter.toUserEnvironmentVariable(i));

        return result;
    }

    async updateUserEnvironmentVariable(
        req: PartialMessage<UpdateUserEnvironmentVariableRequest>,
    ): Promise<UpdateUserEnvironmentVariableResponse> {
        if (!req.environmentVariableId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        const response = new UpdateUserEnvironmentVariableResponse();

        const userEnvVars = await getGitpodService().server.getAllEnvVars();
        const userEnvVarfound = userEnvVars.find((i) => i.id === req.environmentVariableId);
        if (userEnvVarfound) {
            const variable: UserEnvVarValue = {
                id: req.environmentVariableId,
                name: req.name ?? userEnvVarfound.name,
                value: req.value ?? userEnvVarfound.value,
                repositoryPattern: req.repositoryPattern ?? userEnvVarfound.repositoryPattern,
            };
            variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);

            await getGitpodService().server.setEnvVar(variable);

            const updatedUserEnvVars = await getGitpodService().server.getAllEnvVars();
            const updatedUserEnvVar = updatedUserEnvVars.find((i) => i.id === req.environmentVariableId);
            if (!updatedUserEnvVar) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "could not update env variable");
            }

            response.environmentVariable = converter.toUserEnvironmentVariable(updatedUserEnvVar);
            return response;
        }

        throw new ApplicationError(ErrorCodes.NOT_FOUND, "env variable not found");
    }

    async createUserEnvironmentVariable(
        req: PartialMessage<CreateUserEnvironmentVariableRequest>,
    ): Promise<CreateUserEnvironmentVariableResponse> {
        if (!req.name || !req.value || !req.repositoryPattern) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "name, value and repositoryPattern are required");
        }

        const response = new CreateUserEnvironmentVariableResponse();

        const variable: UserEnvVarValue = {
            name: req.name,
            value: req.value,
            repositoryPattern: req.repositoryPattern,
        };
        variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);

        await getGitpodService().server.setEnvVar(variable);

        const updatedUserEnvVars = await getGitpodService().server.getAllEnvVars();
        const updatedUserEnvVar = updatedUserEnvVars.find(
            (v) => v.name === variable.name && v.repositoryPattern === variable.repositoryPattern,
        );
        if (!updatedUserEnvVar) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "could not update env variable");
        }

        response.environmentVariable = converter.toUserEnvironmentVariable(updatedUserEnvVar);

        return response;
    }

    async deleteUserEnvironmentVariable(
        req: PartialMessage<DeleteUserEnvironmentVariableRequest>,
    ): Promise<DeleteUserEnvironmentVariableResponse> {
        if (!req.environmentVariableId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        const variable: UserEnvVarValue = {
            id: req.environmentVariableId,
            name: "",
            value: "",
            repositoryPattern: "",
        };

        await getGitpodService().server.deleteEnvVar(variable);

        const response = new DeleteUserEnvironmentVariableResponse();
        return response;
    }

    async listConfigurationEnvironmentVariables(
        req: PartialMessage<ListConfigurationEnvironmentVariablesRequest>,
    ): Promise<ListConfigurationEnvironmentVariablesResponse> {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }

        const result = new ListConfigurationEnvironmentVariablesResponse();
        const projectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(req.configurationId);
        result.environmentVariables = projectEnvVars.map((i) => converter.toConfigurationEnvironmentVariable(i));

        return result;
    }

    async updateConfigurationEnvironmentVariable(
        req: PartialMessage<UpdateConfigurationEnvironmentVariableRequest>,
    ): Promise<UpdateConfigurationEnvironmentVariableResponse> {
        if (!req.environmentVariableId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }

        const response = new UpdateConfigurationEnvironmentVariableResponse();

        const projectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(req.configurationId);
        const projectEnvVarfound = projectEnvVars.find((i) => i.id === req.environmentVariableId);
        if (projectEnvVarfound) {
            await getGitpodService().server.setProjectEnvironmentVariable(
                req.configurationId,
                req.name ?? projectEnvVarfound.name,
                req.value ?? "",
                req.admission === EnvironmentVariableAdmission.UNSPECIFIED
                    ? projectEnvVarfound.censored
                    : req.admission === EnvironmentVariableAdmission.PREBUILD,
                req.environmentVariableId,
            );

            const updatedProjectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(
                req.configurationId,
            );
            const updatedProjectEnvVar = updatedProjectEnvVars.find((i) => i.id === req.environmentVariableId);
            if (!updatedProjectEnvVar) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "could not update env variable");
            }

            response.environmentVariable = converter.toConfigurationEnvironmentVariable(updatedProjectEnvVar);
            return response;
        }

        throw new ApplicationError(ErrorCodes.NOT_FOUND, "env variable not found");
    }

    async createConfigurationEnvironmentVariable(
        req: PartialMessage<CreateConfigurationEnvironmentVariableRequest>,
    ): Promise<CreateConfigurationEnvironmentVariableResponse> {
        if (!req.configurationId || !req.name || !req.value) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId, name and value are required");
        }

        const response = new CreateConfigurationEnvironmentVariableResponse();

        await getGitpodService().server.setProjectEnvironmentVariable(
            req.configurationId,
            req.name,
            req.value,
            req.admission === EnvironmentVariableAdmission.PREBUILD,
        );

        const updatedProjectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(
            req.configurationId,
        );
        const updatedProjectEnvVar = updatedProjectEnvVars.find((v) => v.name === req.name);
        if (!updatedProjectEnvVar) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "could not create env variable");
        }

        response.environmentVariable = converter.toConfigurationEnvironmentVariable(updatedProjectEnvVar);

        return response;
    }

    async deleteConfigurationEnvironmentVariable(
        req: PartialMessage<DeleteConfigurationEnvironmentVariableRequest>,
    ): Promise<DeleteConfigurationEnvironmentVariableResponse> {
        if (!req.environmentVariableId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "environmentVariableId is required");
        }

        await getGitpodService().server.deleteProjectEnvironmentVariable(req.environmentVariableId);

        const response = new DeleteConfigurationEnvironmentVariableResponse();
        return response;
    }

    async listOrganizationEnvironmentVariables(
        req: PartialMessage<ListOrganizationEnvironmentVariablesRequest>,
    ): Promise<ListOrganizationEnvironmentVariablesResponse> {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unimplemented");
    }

    async updateOrganizationEnvironmentVariable(
        req: PartialMessage<UpdateOrganizationEnvironmentVariableRequest>,
    ): Promise<UpdateOrganizationEnvironmentVariableResponse> {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unimplemented");
    }

    async createOrganizationEnvironmentVariable(
        req: PartialMessage<CreateOrganizationEnvironmentVariableRequest>,
    ): Promise<CreateOrganizationEnvironmentVariableResponse> {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unimplemented");
    }

    async deleteOrganizationEnvironmentVariable(
        req: PartialMessage<DeleteOrganizationEnvironmentVariableRequest>,
    ): Promise<DeleteOrganizationEnvironmentVariableResponse> {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unimplemented");
    }

    async resolveWorkspaceEnvironmentVariables(
        req: PartialMessage<ResolveWorkspaceEnvironmentVariablesRequest>,
    ): Promise<ResolveWorkspaceEnvironmentVariablesResponse> {
        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unimplemented");
    }
}
