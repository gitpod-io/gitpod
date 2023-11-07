/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { WorkspaceService as WorkspaceServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import {
    GetWorkspaceRequest,
    GetWorkspaceResponse,
    WatchWorkspaceStatusRequest,
    WatchWorkspaceStatusResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { inject, injectable } from "inversify";
import { WorkspaceService } from "../workspace/workspace-service";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";

@injectable()
export class WorkspaceServiceAPI implements ServiceImpl<typeof WorkspaceServiceInterface> {
    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService;

    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    async getWorkspace(req: GetWorkspaceRequest, context: HandlerContext): Promise<GetWorkspaceResponse> {
        const info = await this.workspaceService.getWorkspace(context.user.id, req.id);
        const response = new GetWorkspaceResponse();
        response.item = this.apiConverter.toWorkspace(info);
        return response;
    }

    async *watchWorkspaceStatus(
        req: WatchWorkspaceStatusRequest,
        context: HandlerContext,
    ): AsyncIterable<WatchWorkspaceStatusResponse> {
        if (req.workspaceId) {
            const instance = await this.workspaceService.getCurrentInstance(context.user.id, req.workspaceId);
            const status = this.apiConverter.toWorkspace(instance).status;
            if (status) {
                const response = new WatchWorkspaceStatusResponse();
                response.status = status;
                yield response;
            }
        }
        const it = this.workspaceService.watchWorkspaceStatus(context.user.id, { signal: context.signal });
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
            response.status = status;
            yield response;
        }
    }
}
