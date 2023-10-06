/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { ServiceImpl, ConnectError, Code } from "@connectrpc/connect";
import { UserService as UserServiceInterface } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_connect";
import {
    GetAuthenticatedUserRequest,
    ListSSHKeysRequest,
    CreateSSHKeyRequest,
    GetSSHKeyRequest,
    DeleteSSHKeyRequest,
    GetGitTokenRequest,
    BlockUserRequest,
    GetAuthenticatedUserResponse,
    ListSSHKeysResponse,
    CreateSSHKeyResponse,
    GetSSHKeyResponse,
    DeleteSSHKeyResponse,
    GetGitTokenResponse,
    BlockUserResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/user_pb";
import { UserAuthentication } from "../user/user-authentication";
import { WorkspaceService } from "../workspace/workspace-service";
import { SYSTEM_USER } from "../authorization/authorizer";
import { validate } from "uuid";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";

@injectable()
export class APIUserService implements ServiceImpl<typeof UserServiceInterface> {
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(UserAuthentication) protected readonly userService: UserAuthentication;

    public async getAuthenticatedUser(req: GetAuthenticatedUserRequest): Promise<GetAuthenticatedUserResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    public async listSSHKeys(req: ListSSHKeysRequest): Promise<ListSSHKeysResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    public async createSSHKey(req: CreateSSHKeyRequest): Promise<CreateSSHKeyResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    public async getSSHKey(req: GetSSHKeyRequest): Promise<GetSSHKeyResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    public async deleteSSHKey(req: DeleteSSHKeyRequest): Promise<DeleteSSHKeyResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    public async getGitToken(req: GetGitTokenRequest): Promise<GetGitTokenResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    public async blockUser(req: BlockUserRequest): Promise<BlockUserResponse> {
        const { userId, reason } = req;

        if (!userId) {
            throw new ConnectError("userId is a required parameter", Code.InvalidArgument);
        }
        if (!validate(userId)) {
            throw new ConnectError("userId must be a valid uuid", Code.InvalidArgument);
        }
        if (!reason) {
            throw new ConnectError("reason is a required parameter", Code.InvalidArgument);
        }

        // TODO: Once connect-node supports middlewares, lift the tracing into the middleware.
        const trace = {};
        // TODO for now we use SYSTEM_USER, since it is only called by internal componenets like usage
        // and not exposed publically, but there should be better way to get an authenticated user
        await this.userService.blockUser(SYSTEM_USER, userId, true);
        log.info(`Blocked user ${userId}.`, {
            userId,
            reason,
        });

        const stoppedWorkspaces = await this.workspaceService.stopRunningWorkspacesForUser(
            trace,
            SYSTEM_USER,
            userId,
            reason,
            StopWorkspacePolicy.IMMEDIATELY,
        );

        log.info(`Stopped ${stoppedWorkspaces.length} workspaces in response to BlockUser.`, {
            userId,
            reason,
            workspaceIds: stoppedWorkspaces.map((w) => w.id),
        });

        return new BlockUserResponse();
    }
}
