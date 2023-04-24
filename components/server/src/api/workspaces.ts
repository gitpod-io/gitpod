/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, ServiceImpl } from "@bufbuild/connect";
import { injectable } from "inversify";
import { WorkspacesService as WorkspacesServiceInterface } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connectweb";
import {
    CreateAndStartWorkspaceRequest,
    CreateAndStartWorkspaceResponse,
    DeleteWorkspaceRequest,
    DeleteWorkspaceResponse,
    GetOwnerTokenRequest,
    GetOwnerTokenResponse,
    GetWorkspaceRequest,
    GetWorkspaceResponse,
    ListWorkspacesRequest,
    ListWorkspacesResponse,
    StopWorkspaceRequest,
    StopWorkspaceResponse,
    StreamWorkspaceStatusRequest,
    UpdatePortRequest,
    UpdatePortResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1";

@injectable()
export class APIWorkspacesService implements ServiceImpl<typeof WorkspacesServiceInterface> {
    async listWorkspaces(req: ListWorkspacesRequest): Promise<ListWorkspacesResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async getWorkspace(req: GetWorkspaceRequest): Promise<GetWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async *streamWorkspaceStatus(req: StreamWorkspaceStatusRequest) {
        // yield { sentence: `How are you feeling today?` };
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async getOwnerToken(req: GetOwnerTokenRequest): Promise<GetOwnerTokenResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async createAndStartWorkspace(req: CreateAndStartWorkspaceRequest): Promise<CreateAndStartWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async stopWorkspace(req: StopWorkspaceRequest): Promise<StopWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async deleteWorkspace(req: DeleteWorkspaceRequest): Promise<DeleteWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async updatePort(req: UpdatePortRequest): Promise<UpdatePortResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
}
