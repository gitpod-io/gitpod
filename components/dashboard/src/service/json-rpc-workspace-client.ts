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
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { converter } from "./public-api";
import { getGitpodService } from "./service";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";

export class JsonRpcWorkspaceClient implements PromiseClient<typeof WorkspaceService> {
    async getWorkspace(request: PartialMessage<GetWorkspaceRequest>): Promise<GetWorkspaceResponse> {
        if (!request.id) {
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        const info = await getGitpodService().server.getWorkspace(request.id);
        const workspace = converter.toWorkspace(info);
        const result = new GetWorkspaceResponse();
        result.item = workspace;
        return result;
    }

    async *watchWorkspaceStatus(
        request: PartialMessage<WatchWorkspaceStatusRequest>,
        options?: CallOptions,
    ): AsyncIterable<WatchWorkspaceStatusResponse> {
        if (!options?.signal) {
            throw new ConnectError("signal is required", Code.InvalidArgument);
        }
        const it = generateAsyncGenerator<WorkspaceInstance>(
            (sink) => {
                const dispose = getGitpodService().registerClient({
                    onInstanceUpdate: (instance) => {
                        sink.next(instance);
                    },
                });
                return dispose.dispose;
            },
            { signal: options.signal },
        );
        if (request.workspaceId) {
            const resp = await this.getWorkspace({ id: request.workspaceId });
            if (resp.item?.status) {
                const response = new WatchWorkspaceStatusResponse();
                response.status = resp.item.status;
                yield response;
            }
        }
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
}
