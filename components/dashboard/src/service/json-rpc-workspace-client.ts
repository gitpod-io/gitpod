/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CallOptions, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import {
    CreateAndStartWorkspaceRequest,
    CreateAndStartWorkspaceResponse,
    GetWorkspaceRequest,
    GetWorkspaceResponse,
    StartWorkspaceRequest,
    StartWorkspaceResponse,
    WatchWorkspaceStatusRequest,
    WatchWorkspaceStatusResponse,
    ListWorkspacesRequest,
    ListWorkspacesResponse,
    GetWorkspaceDefaultImageRequest,
    GetWorkspaceDefaultImageResponse,
    GetWorkspaceEditorCredentialsRequest,
    GetWorkspaceEditorCredentialsResponse,
    GetWorkspaceOwnerTokenRequest,
    GetWorkspaceOwnerTokenResponse,
    SendHeartBeatRequest,
    SendHeartBeatResponse,
    WorkspacePhase_Phase,
    GetWorkspaceDefaultImageResponse_Source,
    ParseContextURLRequest,
    ParseContextURLResponse,
    UpdateWorkspaceRequest,
    UpdateWorkspaceResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { converter } from "./public-api";
import { getGitpodService } from "./service";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { parsePagination } from "@gitpod/public-api-common/lib/public-api-pagination";
import { validate as uuidValidate } from "uuid";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export class JsonRpcWorkspaceClient implements PromiseClient<typeof WorkspaceService> {
    async getWorkspace(request: PartialMessage<GetWorkspaceRequest>): Promise<GetWorkspaceResponse> {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const info = await getGitpodService().server.getWorkspace(request.workspaceId);
        const workspace = converter.toWorkspace(info);
        const result = new GetWorkspaceResponse();
        result.workspace = workspace;
        return result;
    }

    async *watchWorkspaceStatus(
        request: PartialMessage<WatchWorkspaceStatusRequest>,
        options?: CallOptions,
    ): AsyncIterable<WatchWorkspaceStatusResponse> {
        if (!options?.signal) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "signal is required");
        }
        if (request.workspaceId) {
            const resp = await this.getWorkspace({ workspaceId: request.workspaceId });
            if (resp.workspace?.status) {
                const response = new WatchWorkspaceStatusResponse();
                response.workspaceId = resp.workspace.id;
                response.status = resp.workspace.status;
                yield response;
            }
        }
        const it = generateAsyncGenerator<WorkspaceInstance>(
            (queue) => {
                try {
                    const dispose = getGitpodService().registerClient({
                        onInstanceUpdate: (instance) => {
                            queue.push(instance);
                        },
                    });
                    return () => {
                        dispose.dispose();
                    };
                } catch (e) {
                    queue.fail(e);
                }
            },
            { signal: options.signal },
        );
        for await (const item of it) {
            if (!item) {
                continue;
            }
            if (request.workspaceId && item.workspaceId !== request.workspaceId) {
                continue;
            }
            const status = converter.toWorkspace(item).status;
            if (!status) {
                continue;
            }
            const response = new WatchWorkspaceStatusResponse();
            response.workspaceId = item.workspaceId;
            response.status = status;
            yield response;
        }
    }

    async listWorkspaces(
        request: PartialMessage<ListWorkspacesRequest>,
        _options?: CallOptions,
    ): Promise<ListWorkspacesResponse> {
        if (!request.organizationId || !uuidValidate(request.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        const { limit } = parsePagination(request.pagination, 50);
        let resultTotal = 0;
        const results = await getGitpodService().server.getWorkspaces({
            limit,
            pinnedOnly: request.pinned,
            searchString: request.searchTerm,
            organizationId: request.organizationId,
        });
        resultTotal = results.length;
        const response = new ListWorkspacesResponse();
        response.workspaces = results.map((info) => converter.toWorkspace(info));
        response.pagination = new PaginationResponse();
        response.pagination.total = resultTotal;
        return response;
    }

    async createAndStartWorkspace(
        request: PartialMessage<CreateAndStartWorkspaceRequest>,
        _options?: CallOptions | undefined,
    ) {
        if (request.source?.case !== "contextUrl") {
            throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
        }
        if (!request.metadata || !request.metadata.organizationId || !uuidValidate(request.metadata.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (!request.source.value.url) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "source is required");
        }
        const response = await getGitpodService().server.createWorkspace({
            organizationId: request.metadata.organizationId,
            ignoreRunningWorkspaceOnSameCommit: true,
            contextUrl: request.source.value.url,
            forceDefaultConfig: request.forceDefaultConfig,
            workspaceClass: request.source.value.workspaceClass,
            projectId: request.metadata.configurationId,
            ideSettings: {
                defaultIde: request.source.value.editor?.name,
                useLatestVersion: request.source.value.editor?.version
                    ? request.source.value.editor?.version === "latest"
                    : undefined,
            },
        });
        const workspace = await this.getWorkspace({ workspaceId: response.createdWorkspaceId });
        const result = new CreateAndStartWorkspaceResponse();
        result.workspace = workspace.workspace;
        return result;
    }

    async startWorkspace(request: PartialMessage<StartWorkspaceRequest>, _options?: CallOptions | undefined) {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        await getGitpodService().server.startWorkspace(request.workspaceId, {
            forceDefaultImage: request.forceDefaultConfig,
        });
        const workspace = await this.getWorkspace({ workspaceId: request.workspaceId });
        const result = new StartWorkspaceResponse();
        result.workspace = workspace.workspace;
        return result;
    }

    async getWorkspaceDefaultImage(
        request: PartialMessage<GetWorkspaceDefaultImageRequest>,
        _options?: CallOptions | undefined,
    ): Promise<GetWorkspaceDefaultImageResponse> {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const response = await getGitpodService().server.getDefaultWorkspaceImage({
            workspaceId: request.workspaceId,
        });
        const result = new GetWorkspaceDefaultImageResponse();
        result.defaultWorkspaceImage = response.image;
        switch (response.source) {
            case "installation":
                result.source = GetWorkspaceDefaultImageResponse_Source.INSTALLATION;
                break;
            case "organization":
                result.source = GetWorkspaceDefaultImageResponse_Source.ORGANIZATION;
                break;
        }
        return result;
    }

    async sendHeartBeat(
        request: PartialMessage<SendHeartBeatRequest>,
        _options?: CallOptions | undefined,
    ): Promise<SendHeartBeatResponse> {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const workspace = await this.getWorkspace({ workspaceId: request.workspaceId });
        if (
            !workspace.workspace?.status?.phase ||
            workspace.workspace.status.phase.name !== WorkspacePhase_Phase.RUNNING
        ) {
            throw new ApplicationError(ErrorCodes.PRECONDITION_FAILED, "workspace is not running");
        }
        await getGitpodService().server.sendHeartBeat({
            instanceId: workspace.workspace.status.instanceId,
            wasClosed: request.disconnected === true,
        });
        return new SendHeartBeatResponse();
    }

    async getWorkspaceOwnerToken(
        request: PartialMessage<GetWorkspaceOwnerTokenRequest>,
        _options?: CallOptions | undefined,
    ): Promise<GetWorkspaceOwnerTokenResponse> {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const ownerToken = await getGitpodService().server.getOwnerToken(request.workspaceId);
        const result = new GetWorkspaceOwnerTokenResponse();
        result.ownerToken = ownerToken;
        return result;
    }

    async getWorkspaceEditorCredentials(
        request: PartialMessage<GetWorkspaceEditorCredentialsRequest>,
        _options?: CallOptions | undefined,
    ): Promise<GetWorkspaceEditorCredentialsResponse> {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const credentials = await getGitpodService().server.getIDECredentials(request.workspaceId);
        const result = new GetWorkspaceEditorCredentialsResponse();
        result.editorCredentials = credentials;
        return result;
    }

    async updateWorkspace(
        request: PartialMessage<UpdateWorkspaceRequest>,
        _options?: CallOptions | undefined,
    ): Promise<UpdateWorkspaceResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async parseContextURL(
        request: PartialMessage<ParseContextURLRequest>,
        _options?: CallOptions | undefined,
    ): Promise<ParseContextURLResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }
}
