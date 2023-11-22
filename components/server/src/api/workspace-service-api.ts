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
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { inject, injectable } from "inversify";
import { WorkspaceService } from "../workspace/workspace-service";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { ctxClientRegion, ctxSignal, ctxUserId } from "../util/request-context";
import { parsePagination } from "@gitpod/gitpod-protocol/lib/public-api-pagination";
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
        // TODO validate workspace ID
        const info = await this.workspaceService.getWorkspace(ctxUserId(), req.workspaceId);
        const response = new GetWorkspaceResponse();
        response.workspace = this.apiConverter.toWorkspace(info);
        return response;
    }

    async *watchWorkspaceStatus(
        req: WatchWorkspaceStatusRequest,
        _: HandlerContext,
    ): AsyncIterable<WatchWorkspaceStatusResponse> {
        if (req.workspaceId) {
            // TODO validate workspace ID
            const instance = await this.workspaceService.getCurrentInstance(ctxUserId(), req.workspaceId);
            const status = this.apiConverter.toWorkspace(instance).status;
            if (status) {
                const response = new WatchWorkspaceStatusResponse();
                response.workspaceId = instance.workspaceId;
                response.status = status;
                yield response;
            }
        }
        const it = this.workspaceService.watchWorkspaceStatus(ctxUserId(), { signal: ctxSignal() });
        for await (const instance of it) {
            if (!instance) {
                continue;
            }
            if (req.workspaceId && instance.workspaceId !== req.workspaceId) {
                continue;
            }
            const status = this.apiConverter.toWorkspace(instance).status;
            if (!status) {
                continue;
            }
            const response = new WatchWorkspaceStatusResponse();
            response.workspaceId = instance.workspaceId;
            response.status = status;
            yield response;
        }
    }

    async listWorkspaces(req: ListWorkspacesRequest, _: HandlerContext): Promise<ListWorkspacesResponse> {
        const { limit } = parsePagination(req.pagination, 50);
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        // TODO should not we validate access to the organization before running a query?
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

    async createAndStartWorkspace(req: CreateAndStartWorkspaceRequest): Promise<CreateAndStartWorkspaceResponse> {
        // We rely on FGA to do the permission checking
        if (req.source?.case !== "contextUrl") {
            throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
        }
        if (!req.organizationId || !uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (!req.editor) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "editor is required");
        }
        if (!req.source.value) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "source is required");
        }
        const contextUrl = req.source.value;
        const user = await this.userService.findUserById(ctxUserId(), ctxUserId());
        const { context, project } = await this.contextService.parseContext(user, contextUrl, {
            projectId: req.configurationId,
            organizationId: req.organizationId,
            forceDefaultConfig: req.forceDefaultConfig,
        });

        const normalizedContextUrl = this.contextParser.normalizeContextURL(contextUrl);
        const workspace = await this.workspaceService.createWorkspace(
            {},
            user,
            req.organizationId,
            project,
            context,
            normalizedContextUrl,
        );

        await this.workspaceService.startWorkspace({}, user, workspace.id, {
            forceDefaultImage: req.forceDefaultConfig,
            workspaceClass: req.workspaceClass,
            ideSettings: {
                defaultIde: req.editor.name,
                useLatestVersion: req.editor.version === "latest",
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
}
