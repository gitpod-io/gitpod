/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CallOptions, Code, ConnectError, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import {
    GetWorkspaceRequest,
    GetWorkspaceResponse,
    WatchWorkspaceStatusRequest,
    WatchWorkspaceStatusResponse,
    ListWorkspacesRequest,
    ListWorkspacesResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { converter } from "./public-api";
import { getGitpodService } from "./service";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { parsePagination } from "@gitpod/gitpod-protocol/lib/public-api-pagination";
import { validate as uuidValidate } from "uuid";

export class JsonRpcWorkspaceClient implements PromiseClient<typeof WorkspaceService> {
    async getWorkspace(request: PartialMessage<GetWorkspaceRequest>): Promise<GetWorkspaceResponse> {
        if (!request.workspaceId) {
            throw new ConnectError("workspaceId is required", Code.InvalidArgument);
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
            throw new ConnectError("signal is required", Code.InvalidArgument);
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
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
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
}
