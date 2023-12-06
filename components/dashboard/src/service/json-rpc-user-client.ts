/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserService } from "@gitpod/public-api/lib/gitpod/v1/user_connect";

import { PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import {
    GetAuthenticatedUserRequest,
    GetAuthenticatedUserResponse,
    SetWorkspaceAutoStartOptionsRequest,
    SetWorkspaceAutoStartOptionsResponse,
    UpdateUserRequest,
    UpdateUserResponse,
} from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { getGitpodService } from "./service";
import { converter } from "./public-api";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export class JsonRpcUserClient implements PromiseClient<typeof UserService> {
    async getAuthenticatedUser(
        request: PartialMessage<GetAuthenticatedUserRequest>,
    ): Promise<GetAuthenticatedUserResponse> {
        const user = await getGitpodService().server.getLoggedInUser();
        return new GetAuthenticatedUserResponse({
            user: converter.toUser(user),
        });
    }

    async updateUser(request: PartialMessage<UpdateUserRequest>): Promise<UpdateUserResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async setWorkspaceAutoStartOptions(
        request: PartialMessage<SetWorkspaceAutoStartOptionsRequest>,
    ): Promise<SetWorkspaceAutoStartOptionsResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }
}
