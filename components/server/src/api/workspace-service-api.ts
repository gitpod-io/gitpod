/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { WorkspaceService as WorkspaceServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import {
    GetWorkspaceRequest,
    GetWorkspaceResponse,
    WatchWorkspaceStatusRequest,
    WatchWorkspaceStatusResponse,
    ListWorkspacesRequest,
    ListWorkspacesResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { inject, injectable } from "inversify";
import { WorkspaceService } from "../workspace/workspace-service";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { ctxSignal, ctxUserId } from "../util/request-context";
import { parsePagination } from "@gitpod/gitpod-protocol/lib/public-api-pagination";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { validate as uuidValidate } from "uuid";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class WorkspaceServiceAPI implements ServiceImpl<typeof WorkspaceServiceInterface> {
    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService;

    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    async getWorkspace(req: GetWorkspaceRequest, _: HandlerContext): Promise<GetWorkspaceResponse> {
        if (!req.workspaceId) {
            throw new ConnectError("workspaceId is required", Code.InvalidArgument);
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
        if (req.workspaceId) {
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
}
