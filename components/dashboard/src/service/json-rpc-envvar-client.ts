/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { EnvironmentVariableService } from "@gitpod/public-api/lib/gitpod/v1/envvar_connect";
import {
    CreateConfigurationEnvironmentVariableRequest,
    CreateConfigurationEnvironmentVariableResponse,
    CreateUserEnvironmentVariableRequest,
    CreateUserEnvironmentVariableResponse,
    DeleteConfigurationEnvironmentVariableRequest,
    DeleteConfigurationEnvironmentVariableResponse,
    DeleteUserEnvironmentVariableRequest,
    DeleteUserEnvironmentVariableResponse,
    EnvironmentVariableAdmission,
    ListConfigurationEnvironmentVariablesRequest,
    ListConfigurationEnvironmentVariablesResponse,
    ListUserEnvironmentVariablesRequest,
    ListUserEnvironmentVariablesResponse,
    ResolveWorkspaceEnvironmentVariablesRequest,
    ResolveWorkspaceEnvironmentVariablesResponse,
    UpdateConfigurationEnvironmentVariableRequest,
    UpdateConfigurationEnvironmentVariableResponse,
    UpdateUserEnvironmentVariableRequest,
    UpdateUserEnvironmentVariableResponse,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { converter } from "./public-api";
import { getGitpodService } from "./service";
import { UserEnvVar, UserEnvVarValue } from "@gitpod/gitpod-protocol";

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
        if (!req.envVarId) {
            throw new ConnectError("id is not set", Code.InvalidArgument);
        }

        const response = new UpdateUserEnvironmentVariableResponse();

        const userEnvVars = await getGitpodService().server.getAllEnvVars();
        const userEnvVarfound = userEnvVars.find((i) => i.id === req.envVarId);
        if (userEnvVarfound) {
            const variable: UserEnvVarValue = {
                name: req.name ?? userEnvVarfound.name,
                value: req.value ?? userEnvVarfound.value,
                repositoryPattern: req.repositoryPattern ?? userEnvVarfound.repositoryPattern,
            };
            variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);

            await getGitpodService().server.setEnvVar(variable);

            const updatedUserEnvVars = await getGitpodService().server.getAllEnvVars();
            const updatedUserEnvVar = updatedUserEnvVars.find((i) => i.id === req.envVarId);
            if (!updatedUserEnvVar) {
                throw new ConnectError("could not update env variable", Code.Internal);
            }

            response.environmentVariable = converter.toUserEnvironmentVariable(updatedUserEnvVar);
            return response;
        }

        throw new ConnectError("env variable not found", Code.InvalidArgument);
    }

    async createUserEnvironmentVariable(
        req: PartialMessage<CreateUserEnvironmentVariableRequest>,
    ): Promise<CreateUserEnvironmentVariableResponse> {
        if (!req.name || !req.value || !req.repositoryPattern) {
            throw new ConnectError("invalid argument", Code.InvalidArgument);
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
            throw new ConnectError("could not update env variable", Code.Internal);
        }

        response.environmentVariable = converter.toUserEnvironmentVariable(updatedUserEnvVar);

        return response;
    }

    async deleteUserEnvironmentVariable(
        req: PartialMessage<DeleteUserEnvironmentVariableRequest>,
    ): Promise<DeleteUserEnvironmentVariableResponse> {
        if (!req.envVarId) {
            throw new ConnectError("invalid argument", Code.InvalidArgument);
        }

        const variable: UserEnvVarValue = {
            id: req.envVarId,
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
            throw new ConnectError("configurationId is not set", Code.InvalidArgument);
        }

        const result = new ListConfigurationEnvironmentVariablesResponse();
        const projectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(req.configurationId);
        result.environmentVariables = projectEnvVars.map((i) => converter.toConfigurationEnvironmentVariable(i));

        return result;
    }

    async updateConfigurationEnvironmentVariable(
        req: PartialMessage<UpdateConfigurationEnvironmentVariableRequest>,
    ): Promise<UpdateConfigurationEnvironmentVariableResponse> {
        if (!req.envVarId) {
            throw new ConnectError("envVarId is not set", Code.InvalidArgument);
        }
        if (!req.configurationId) {
            throw new ConnectError("configurationId is not set", Code.InvalidArgument);
        }

        const response = new UpdateConfigurationEnvironmentVariableResponse();

        const projectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(req.configurationId);
        const projectEnvVarfound = projectEnvVars.find((i) => i.id === req.envVarId);
        if (projectEnvVarfound) {
            await getGitpodService().server.setProjectEnvironmentVariable(
                req.configurationId,
                req.name ?? projectEnvVarfound.name,
                req.value ?? "",
                (req.admission === EnvironmentVariableAdmission.PREBUILD ? true : false) ?? projectEnvVarfound.censored,
            );

            const updatedProjectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(
                req.configurationId,
            );
            const updatedProjectEnvVar = updatedProjectEnvVars.find((i) => i.id === req.envVarId);
            if (!updatedProjectEnvVar) {
                throw new ConnectError("could not update env variable", Code.Internal);
            }

            response.environmentVariable = converter.toConfigurationEnvironmentVariable(updatedProjectEnvVar);
            return response;
        }

        throw new ConnectError("env variable not found", Code.InvalidArgument);
    }

    async createConfigurationEnvironmentVariable(
        req: PartialMessage<CreateConfigurationEnvironmentVariableRequest>,
    ): Promise<CreateConfigurationEnvironmentVariableResponse> {
        if (!req.configurationId || !req.name || !req.value) {
            throw new ConnectError("invalid argument", Code.InvalidArgument);
        }

        const response = new CreateConfigurationEnvironmentVariableResponse();

        await getGitpodService().server.setProjectEnvironmentVariable(
            req.configurationId,
            req.name,
            req.value,
            req.admission === EnvironmentVariableAdmission.PREBUILD ? true : false,
        );

        const updatedProjectEnvVars = await getGitpodService().server.getProjectEnvironmentVariables(
            req.configurationId,
        );
        const updatedProjectEnvVar = updatedProjectEnvVars.find((v) => v.name === req.name);
        if (!updatedProjectEnvVar) {
            throw new ConnectError("could not create env variable", Code.Internal);
        }

        response.environmentVariable = converter.toConfigurationEnvironmentVariable(updatedProjectEnvVar);

        return response;
    }

    async deleteConfigurationEnvironmentVariable(
        req: PartialMessage<DeleteConfigurationEnvironmentVariableRequest>,
    ): Promise<DeleteConfigurationEnvironmentVariableResponse> {
        if (!req.envVarId) {
            throw new ConnectError("invalid argument", Code.InvalidArgument);
        }

        await getGitpodService().server.deleteProjectEnvironmentVariable(req.envVarId);

        const response = new DeleteConfigurationEnvironmentVariableResponse();
        return response;
    }

    async resolveWorkspaceEnvironmentVariables(
        req: PartialMessage<ResolveWorkspaceEnvironmentVariablesRequest>,
    ): Promise<ResolveWorkspaceEnvironmentVariablesResponse> {
        throw new ConnectError("Unimplemented", Code.Unimplemented);
    }
}
