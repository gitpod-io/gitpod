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
    DeleteWorkspaceRequest,
    DeleteWorkspaceResponse,
    ListWorkspaceClassesRequest,
    ListWorkspaceClassesResponse,
    StopWorkspaceRequest,
    StopWorkspaceResponse,
    AdmissionLevel,
    CreateWorkspaceSnapshotRequest,
    CreateWorkspaceSnapshotResponse,
    WaitForWorkspaceSnapshotRequest,
    WaitForWorkspaceSnapshotResponse,
    UpdateWorkspacePortRequest,
    UpdateWorkspacePortResponse,
    WorkspacePort_Protocol,
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
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        if (
            request.spec?.timeout?.inactivity?.seconds ||
            (request.spec?.sshPublicKeys && request.spec?.sshPublicKeys.length > 0)
        ) {
            throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
        }

        // check if user can access workspace first
        await this.getWorkspace({ workspaceId: request.workspaceId });

        const server = getGitpodService().server;
        const tasks: Array<Promise<any>> = [];

        if (request.metadata) {
            if (request.metadata.name) {
                tasks.push(server.setWorkspaceDescription(request.workspaceId, request.metadata.name));
            }
            if (request.metadata.pinned !== undefined) {
                tasks.push(
                    server.updateWorkspaceUserPin(request.workspaceId, request.metadata.pinned ? "pin" : "unpin"),
                );
            }
        }

        if (request.spec) {
            if (request.spec?.admission) {
                if (request.spec?.admission === AdmissionLevel.OWNER_ONLY) {
                    tasks.push(server.controlAdmission(request.workspaceId, "owner"));
                } else if (request.spec?.admission === AdmissionLevel.EVERYONE) {
                    tasks.push(server.controlAdmission(request.workspaceId, "everyone"));
                }
            }

            if ((request.spec?.timeout?.disconnected?.seconds ?? 0) > 0) {
                const timeout = converter.toDurationString(request.spec!.timeout!.disconnected!);
                tasks.push(server.setWorkspaceTimeout(request.workspaceId, timeout));
            }
        }

        if (request.gitStatus) {
            tasks.push(
                server.updateGitStatus(request.workspaceId, {
                    branch: request.gitStatus.branch!,
                    latestCommit: request.gitStatus.latestCommit!,
                    uncommitedFiles: request.gitStatus.uncommitedFiles!,
                    totalUncommitedFiles: request.gitStatus.totalUncommitedFiles!,
                    untrackedFiles: request.gitStatus.untrackedFiles!,
                    totalUntrackedFiles: request.gitStatus.totalUntrackedFiles!,
                    unpushedCommits: request.gitStatus.unpushedCommits!,
                    totalUnpushedCommits: request.gitStatus.totalUnpushedCommits!,
                }),
            );
        }
        await Promise.allSettled(tasks);
        const result = new UpdateWorkspaceResponse();
        const workspace = await this.getWorkspace({ workspaceId: request.workspaceId });
        result.workspace = workspace.workspace;
        return result;
    }

    async stopWorkspace(
        request: PartialMessage<StopWorkspaceRequest>,
        _options?: CallOptions | undefined,
    ): Promise<StopWorkspaceResponse> {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        await getGitpodService().server.stopWorkspace(request.workspaceId);
        const result = new StopWorkspaceResponse();
        return result;
    }

    async deleteWorkspace(
        request: PartialMessage<DeleteWorkspaceRequest>,
        _options?: CallOptions | undefined,
    ): Promise<DeleteWorkspaceResponse> {
        if (!request.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        await getGitpodService().server.deleteWorkspace(request.workspaceId);
        const result = new DeleteWorkspaceResponse();
        return result;
    }

    async parseContextURL(
        request: PartialMessage<ParseContextURLRequest>,
        _options?: CallOptions | undefined,
    ): Promise<ParseContextURLResponse> {
        if (!request.contextUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "contextUrl is required");
        }
        const context = await getGitpodService().server.resolveContext(request.contextUrl);
        return converter.toParseContextURLResponse({}, context);
    }

    async listWorkspaceClasses(
        request: PartialMessage<ListWorkspaceClassesRequest>,
        _options?: CallOptions | undefined,
    ): Promise<ListWorkspaceClassesResponse> {
        const list = await getGitpodService().server.getSupportedWorkspaceClasses();
        const response = new ListWorkspaceClassesResponse();
        response.pagination = new PaginationResponse();
        response.workspaceClasses = list.map((i) => converter.toWorkspaceClass(i));
        return response;
    }

    async createWorkspaceSnapshot(
        req: PartialMessage<CreateWorkspaceSnapshotRequest>,
        _options?: CallOptions | undefined,
    ): Promise<CreateWorkspaceSnapshotResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const snapshotId = await getGitpodService().server.takeSnapshot({
            workspaceId: req.workspaceId,
            dontWait: true,
        });
        return new CreateWorkspaceSnapshotResponse({
            snapshot: converter.toWorkspaceSnapshot({
                id: snapshotId,
                originalWorkspaceId: req.workspaceId,
            }),
        });
    }

    async waitForWorkspaceSnapshot(
        req: PartialMessage<WaitForWorkspaceSnapshotRequest>,
        _options?: CallOptions | undefined,
    ): Promise<WaitForWorkspaceSnapshotResponse> {
        if (!req.snapshotId || !uuidValidate(req.snapshotId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "snapshotId is required");
        }
        await getGitpodService().server.waitForSnapshot(req.snapshotId);
        return new WaitForWorkspaceSnapshotResponse();
    }

    async updateWorkspacePort(
        req: PartialMessage<UpdateWorkspacePortRequest>,
        _options?: CallOptions | undefined,
    ): Promise<UpdateWorkspacePortResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        if (!req.port) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "port is required");
        }
        if (!req.admission && !req.protocol) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "admission or protocol is required");
        }
        getGitpodService().server.openPort(req.workspaceId, {
            port: Number(req.port),
            visibility: req.admission ? (req.admission === AdmissionLevel.EVERYONE ? "public" : "private") : undefined,
            protocol: req.protocol ? (req.protocol === WorkspacePort_Protocol.HTTPS ? "https" : "http") : undefined,
        });
        return new UpdateWorkspacePortResponse();
    }
}
