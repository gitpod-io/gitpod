/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { WorkspaceService as WorkspaceServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
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
    GetWorkspaceDefaultImageResponse_Source,
    ParseContextURLRequest,
    ParseContextURLResponse,
    UpdateWorkspaceRequest,
    UpdateWorkspaceResponse,
    StopWorkspaceRequest,
    StopWorkspaceResponse,
    DeleteWorkspaceRequest,
    DeleteWorkspaceResponse,
    ListWorkspaceClassesRequest,
    ListWorkspaceClassesResponse,
    AdmissionLevel,
    CreateWorkspaceSnapshotRequest,
    CreateWorkspaceSnapshotResponse,
    WaitForWorkspaceSnapshotRequest,
    WaitForWorkspaceSnapshotResponse,
    UpdateWorkspacePortRequest,
    UpdateWorkspacePortResponse,
    WorkspacePort_Protocol,
    ListWorkspaceSessionsRequest,
    ListWorkspaceSessionsResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { inject, injectable } from "inversify";
import { WorkspaceService } from "../workspace/workspace-service";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { ctxClientRegion, ctxSignal, ctxUserId } from "../util/request-context";
import { parsePagination } from "@gitpod/public-api-common/lib/public-api-pagination";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { validate as uuidValidate } from "uuid";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ContextService } from "../workspace/context-service";
import { UserService } from "../user/user-service";
import { ContextParser } from "../workspace/context-parser-service";

@injectable()
export class WorkspaceServiceAPI implements ServiceImpl<typeof WorkspaceServiceInterface> {
    @inject(WorkspaceService) private readonly workspaceService: WorkspaceService;
    @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter;
    @inject(ContextService) private readonly contextService: ContextService;
    @inject(UserService) private readonly userService: UserService;
    @inject(ContextParser) private contextParser: ContextParser;

    async getWorkspace(req: GetWorkspaceRequest, _: HandlerContext): Promise<GetWorkspaceResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const info = await this.workspaceService.getWorkspace(ctxUserId(), req.workspaceId);
        const response = new GetWorkspaceResponse();
        response.workspace = this.apiConverter.toWorkspace(info);
        return response;
    }

    async *watchWorkspaceStatus(
        req: WatchWorkspaceStatusRequest,
        _: HandlerContext,
    ): AsyncIterable<WatchWorkspaceStatusResponse> {
        const it = this.workspaceService.getAndWatchWorkspaceStatus(ctxUserId(), req.workspaceId, {
            signal: ctxSignal(),
        });
        for await (const status of it) {
            yield status;
        }
    }

    async listWorkspaces(req: ListWorkspacesRequest, _: HandlerContext): Promise<ListWorkspacesResponse> {
        if (req.pagination?.pageSize && req.pagination?.pageSize > 400) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Pagesize must not exceed 400");
        }
        const { limit } = parsePagination(req.pagination, 50, 400);
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        const results = await this.workspaceService.getWorkspaces(ctxUserId(), {
            organizationId: req.organizationId,
            limit,
            pinnedOnly: req.pinned,
            searchString: req.searchTerm,
        });
        const resultTotal = results.length;
        const response = new ListWorkspacesResponse();
        response.workspaces = results.map((workspace) => this.apiConverter.toWorkspace(workspace));
        response.pagination = new PaginationResponse();
        response.pagination.total = resultTotal;
        return response;
    }

    async listWorkspaceSessions(
        req: ListWorkspaceSessionsRequest,
        _: HandlerContext,
    ): Promise<ListWorkspaceSessionsResponse> {
        if (req.pagination?.pageSize && req.pagination?.pageSize > 400) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Pagesize must not exceed 400");
        }
        const page = parsePagination(req.pagination, 100, 400);
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        const toDate = req.to?.toDate() || new Date();
        // default 7 days before toDate
        const fromDate = req.from?.toDate() || new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

        // check fromDate is before toDate
        if (fromDate.getTime() > toDate.getTime()) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "'from' is after 'to'");
        }

        const results = await this.workspaceService.listWorkspaceSessions(
            ctxUserId(),
            req.organizationId,
            fromDate,
            toDate,
            page.limit,
            page.offset,
        );
        const resultTotal = results.length;
        const response = new ListWorkspaceSessionsResponse();
        response.workspaceSessions = results.map((session) => this.apiConverter.toWorkspaceSession(session));
        response.pagination = new PaginationResponse();
        response.pagination.total = resultTotal;
        return response;
    }

    async createAndStartWorkspace(req: CreateAndStartWorkspaceRequest): Promise<CreateAndStartWorkspaceResponse> {
        // We rely on FGA to do the permission checking
        if (req.source?.case !== "contextUrl") {
            throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
        }
        if (!req.metadata || !req.metadata.organizationId || !uuidValidate(req.metadata.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (!req.source.value || !req.source.value.url) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "source is required");
        }
        const contextUrl = req.source.value;
        const user = await this.userService.findUserById(ctxUserId(), ctxUserId());
        const { context, project } = await this.contextService.parseContext(user, contextUrl.url, {
            projectId: req.metadata.configurationId,
            organizationId: req.metadata.organizationId,
            forceDefaultConfig: req.forceDefaultConfig,
        });

        const normalizedContextUrl = this.contextParser.normalizeContextURL(contextUrl.url);
        const workspace = await this.workspaceService.createWorkspace(
            {},
            user,
            req.metadata.organizationId,
            project,
            context,
            normalizedContextUrl,
            contextUrl.workspaceClass,
        );

        await this.workspaceService.startWorkspace({}, user, workspace.id, {
            forceDefaultImage: req.forceDefaultConfig,
            workspaceClass: contextUrl.workspaceClass,
            ideSettings: {
                defaultIde: req.source.value.editor?.name,
                useLatestVersion: req.source.value.editor?.version
                    ? req.source.value.editor?.version === "latest"
                    : undefined,
            },
            clientRegionCode: ctxClientRegion(),
        });

        const info = await this.workspaceService.getWorkspace(ctxUserId(), workspace.id);
        const response = new CreateAndStartWorkspaceResponse();
        response.workspace = this.apiConverter.toWorkspace(info);
        return response;
    }

    async startWorkspace(req: StartWorkspaceRequest): Promise<StartWorkspaceResponse> {
        // We rely on FGA to do the permission checking
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const user = await this.userService.findUserById(ctxUserId(), ctxUserId());
        const { workspace, latestInstance: instance } = await this.workspaceService.getWorkspace(
            ctxUserId(),
            req.workspaceId,
        );
        if (instance && instance.status.phase !== "stopped") {
            const info = await this.workspaceService.getWorkspace(ctxUserId(), workspace.id);
            const response = new StartWorkspaceResponse();
            response.workspace = this.apiConverter.toWorkspace(info);
            return response;
        }

        await this.workspaceService.startWorkspace({}, user, workspace.id, {
            forceDefaultImage: req.forceDefaultConfig,
            clientRegionCode: ctxClientRegion(),
        });
        const info = await this.workspaceService.getWorkspace(ctxUserId(), workspace.id);
        const response = new StartWorkspaceResponse();
        response.workspace = this.apiConverter.toWorkspace(info);
        return response;
    }

    async getWorkspaceDefaultImage(
        req: GetWorkspaceDefaultImageRequest,
        _: HandlerContext,
    ): Promise<GetWorkspaceDefaultImageResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const result = await this.workspaceService.getWorkspaceDefaultImage(ctxUserId(), req.workspaceId);
        const response = new GetWorkspaceDefaultImageResponse({
            defaultWorkspaceImage: result.image,
        });
        switch (result.source) {
            case "organization":
                response.source = GetWorkspaceDefaultImageResponse_Source.ORGANIZATION;
                break;
            case "installation":
                response.source = GetWorkspaceDefaultImageResponse_Source.INSTALLATION;
                break;
        }
        return response;
    }

    async sendHeartBeat(req: SendHeartBeatRequest, _: HandlerContext): Promise<SendHeartBeatResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const info = await this.workspaceService.getWorkspace(ctxUserId(), req.workspaceId);
        if (!info.latestInstance?.id || info.latestInstance.status.phase !== "running") {
            throw new ApplicationError(ErrorCodes.PRECONDITION_FAILED, "workspace is not running");
        }
        await this.workspaceService.sendHeartBeat(ctxUserId(), {
            instanceId: info.latestInstance.id,
            wasClosed: req.disconnected === true,
        });

        return new SendHeartBeatResponse();
    }

    async getWorkspaceOwnerToken(
        req: GetWorkspaceOwnerTokenRequest,
        _: HandlerContext,
    ): Promise<GetWorkspaceOwnerTokenResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const ownerToken = await this.workspaceService.getOwnerToken(ctxUserId(), req.workspaceId);
        const response = new GetWorkspaceOwnerTokenResponse();
        response.ownerToken = ownerToken;
        return response;
    }

    async getWorkspaceEditorCredentials(
        req: GetWorkspaceEditorCredentialsRequest,
        _: HandlerContext,
    ): Promise<GetWorkspaceEditorCredentialsResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const credentials = await this.workspaceService.getIDECredentials(ctxUserId(), req.workspaceId);
        const response = new GetWorkspaceEditorCredentialsResponse();
        response.editorCredentials = credentials;
        return response;
    }

    async updateWorkspace(req: UpdateWorkspaceRequest): Promise<UpdateWorkspaceResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        if (req.spec?.timeout?.inactivity?.seconds || (req.spec?.sshPublicKeys && req.spec?.sshPublicKeys.length > 0)) {
            throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
        }
        const userId = ctxUserId();

        // check if user can access workspace first, so that it throws NotFound if workspace is not found
        await this.workspaceService.getWorkspace(userId, req.workspaceId);

        const tasks: Array<Promise<any>> = [];

        if (req.metadata) {
            if (req.metadata.name) {
                tasks.push(this.workspaceService.setDescription(userId, req.workspaceId, req.metadata.name));
            }
            if (req.metadata.pinned !== undefined) {
                tasks.push(this.workspaceService.setPinned(userId, req.workspaceId, req.metadata.pinned));
            }
        }

        if (req.spec) {
            if ((req.spec.timeout?.disconnected?.seconds ?? 0) > 0) {
                tasks.push(
                    this.workspaceService.setWorkspaceTimeout(
                        userId,
                        req.workspaceId,
                        this.apiConverter.toDurationString(req.spec.timeout!.disconnected!),
                    ),
                );
            }
            if (req.spec.admission !== undefined) {
                if (req.spec.admission === AdmissionLevel.OWNER_ONLY) {
                    tasks.push(this.workspaceService.controlAdmission(userId, req.workspaceId, "owner"));
                } else if (req.spec.admission === AdmissionLevel.EVERYONE) {
                    tasks.push(this.workspaceService.controlAdmission(userId, req.workspaceId, "everyone"));
                }
            }
        }

        if (req.gitStatus) {
            tasks.push(
                this.workspaceService.updateGitStatus(userId, req.workspaceId, {
                    branch: req.gitStatus.branch!,
                    latestCommit: req.gitStatus.latestCommit!,
                    uncommitedFiles: req.gitStatus.uncommitedFiles!,
                    totalUncommitedFiles: req.gitStatus.totalUncommitedFiles!,
                    untrackedFiles: req.gitStatus.untrackedFiles!,
                    totalUntrackedFiles: req.gitStatus.totalUntrackedFiles!,
                    unpushedCommits: req.gitStatus.unpushedCommits!,
                    totalUnpushedCommits: req.gitStatus.totalUnpushedCommits!,
                }),
            );
        }

        // Use all or allSettled
        // TODO: update workspace-service to make sure it can be done in one request
        await Promise.allSettled(tasks);
        const info = await this.workspaceService.getWorkspace(ctxUserId(), req.workspaceId);
        const response = new UpdateWorkspaceResponse();
        response.workspace = this.apiConverter.toWorkspace(info);
        return response;
    }

    async parseContextURL(req: ParseContextURLRequest): Promise<ParseContextURLResponse> {
        if (!req.contextUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "contextUrl is required");
        }
        const user = await this.userService.findUserById(ctxUserId(), ctxUserId());
        const context = await this.contextService.parseContextUrl(user, req.contextUrl);
        return this.apiConverter.toParseContextURLResponse({}, context);
    }

    async stopWorkspace(req: StopWorkspaceRequest): Promise<StopWorkspaceResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        await this.workspaceService.stopWorkspace(ctxUserId(), req.workspaceId, "stopped via API");
        const response = new StopWorkspaceResponse();
        return response;
    }

    async deleteWorkspace(req: DeleteWorkspaceRequest): Promise<DeleteWorkspaceResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        await this.workspaceService.deleteWorkspace(ctxUserId(), req.workspaceId, "user");
        const response = new DeleteWorkspaceResponse();
        return response;
    }

    async listWorkspaceClasses(req: ListWorkspaceClassesRequest): Promise<ListWorkspaceClassesResponse> {
        const clsList = await this.workspaceService.getSupportedWorkspaceClasses({ id: ctxUserId() });
        const response = new ListWorkspaceClassesResponse();
        response.pagination = new PaginationResponse();
        response.workspaceClasses = clsList.map((i) => this.apiConverter.toWorkspaceClass(i));
        return response;
    }

    async createWorkspaceSnapshot(req: CreateWorkspaceSnapshotRequest): Promise<CreateWorkspaceSnapshotResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        const snapshot = await this.workspaceService.takeSnapshot(ctxUserId(), {
            workspaceId: req.workspaceId,
            dontWait: true,
        });
        return new CreateWorkspaceSnapshotResponse({
            snapshot: this.apiConverter.toWorkspaceSnapshot(snapshot),
        });
    }

    async waitForWorkspaceSnapshot(req: WaitForWorkspaceSnapshotRequest): Promise<WaitForWorkspaceSnapshotResponse> {
        if (!req.snapshotId || !uuidValidate(req.snapshotId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "snapshotId is required");
        }
        await this.workspaceService.waitForSnapshot(ctxUserId(), req.snapshotId);
        return new WaitForWorkspaceSnapshotResponse();
    }

    async updateWorkspacePort(req: UpdateWorkspacePortRequest): Promise<UpdateWorkspacePortResponse> {
        if (!req.workspaceId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceId is required");
        }
        if (!req.port) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "port is required");
        }
        if (!req.admission && !req.protocol) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "admission or protocol is required");
        }
        await this.workspaceService.openPort(ctxUserId(), req.workspaceId, {
            port: Number(req.port),
            visibility: req.admission ? (req.admission === AdmissionLevel.EVERYONE ? "public" : "private") : undefined,
            protocol: req.protocol ? (req.protocol === WorkspacePort_Protocol.HTTPS ? "https" : "http") : undefined,
        });
        return new UpdateWorkspacePortResponse();
    }
}
