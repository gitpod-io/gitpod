/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
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

@injectable()
export class APIUserService implements ServiceImpl<typeof UserServiceInterface> {
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
    }
}
