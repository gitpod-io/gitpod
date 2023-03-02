/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ServiceImpl, ConnectError, Code } from "@bufbuild/connect";
import { experimental } from "@gitpod/public-api";

export class WorkspacesService implements ServiceImpl<typeof experimental.WorkspacesService> {
    async createWorkspace(req: experimental.CreateWorkspaceRequest): Promise<experimental.CreateWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async listWorkspaces(req: experimental.ListWorkspacesRequest): Promise<experimental.ListWorkspacesResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async getWorkspace(req: experimental.GetWorkspaceRequest): Promise<experimental.GetWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async *streamWorkspaceStatus(req: experimental.StreamWorkspaceStatusRequest) {
        // yield { sentence: `Hi ${req.name}, I'm eliza` };
        // yield { sentence: `How are you feeling today?` };
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async getOwnerToken(req: experimental.GetOwnerTokenRequest): Promise<experimental.GetOwnerTokenResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async createAndStartWorkspace(
        req: experimental.CreateAndStartWorkspaceRequest,
    ): Promise<experimental.CreateAndStartWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async stopWorkspace(req: experimental.StopWorkspaceRequest): Promise<experimental.StopWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async deleteWorkspace(req: experimental.DeleteWorkspaceRequest): Promise<experimental.DeleteWorkspaceResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async updatePort(req: experimental.UpdatePortRequest): Promise<experimental.UpdatePortResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
}
