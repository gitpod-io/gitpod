/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { ServiceImpl, ConnectError, Code } from "@bufbuild/connect";
import { UserService as UserServiceInterface } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_connectweb";
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
import { WorkspaceStarter } from "../workspace/workspace-starter";
import { UserAuthentication } from "../user/user-authentication";
import { WorkspaceService } from "../workspace/workspace-service";

@injectable()
export class APIUserService implements ServiceImpl<typeof UserServiceInterface> {
    @inject(WorkspaceStarter) protected readonly workspaceService: WorkspaceService;
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
        throw new ConnectError("unimplemented", Code.Unimplemented);
        // TODO(gpl) Had to comment this out because of missing authentication info: Who is executing this?
        // const { userId, reason } = req;

        // if (!userId) {
        //     throw new ConnectError("userId is a required parameter", Code.InvalidArgument);
        // }
        // if (!validate(userId)) {
        //     throw new ConnectError("userId must be a valid uuid", Code.InvalidArgument);
        // }
        // if (!reason) {
        //     throw new ConnectError("reason is a required parameter", Code.InvalidArgument);
        // }

        // // TODO: Once connect-node supports middlewares, lift the tracing into the middleware.
        // const trace = {};
        // await this.userService.blockUser(userId, true);
        // log.info(`Blocked user ${userId}.`, {
        //     userId,
        //     reason,
        // });

        // const stoppedWorkspaces = await this.workspaceService.stopRunningWorkspacesForUser(
        //     trace,
        //     userId,
        //     reason,
        //     StopWorkspacePolicy.IMMEDIATELY,
        // );

        // log.info(`Stopped ${stoppedWorkspaces.length} workspaces in response to BlockUser.`, {
        //     userId,
        //     reason,
        //     workspaceIds: stoppedWorkspaces.map((w) => w.id),
        // });

        // return new BlockUserResponse();
    }
}
