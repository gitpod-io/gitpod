/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { UserService as UserServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/user_connect";
import { inject, injectable } from "inversify";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import {
    UpdateUserRequest,
    UpdateUserResponse,
    GetAuthenticatedUserRequest,
    GetAuthenticatedUserResponse,
    SetWorkspaceAutoStartOptionsRequest,
    SetWorkspaceAutoStartOptionsResponse,
    DeleteUserRequest,
    DeleteUserResponse,
    VerifyUserRequest,
    VerifyUserResponse,
    BlockUserRequest,
    BlockUserResponse,
    GetUserRequest,
    GetUserResponse,
    ListUsersRequest,
    ListUsersResponse,
    SetRolesOrPermissionsRequest,
    SetRolesOrPermissionsResponse,
} from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { UserService } from "../user/user-service";
import { validate as uuidValidate } from "uuid";
import { ctxUserId } from "../util/request-context";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class UserServiceAPI implements ServiceImpl<typeof UserServiceInterface> {
    constructor(
        @inject(PublicAPIConverter) private readonly converter: PublicAPIConverter,
        @inject(UserService) private readonly userService: UserService,
    ) {}

    async getAuthenticatedUser(
        request: GetAuthenticatedUserRequest,
        _: HandlerContext,
    ): Promise<GetAuthenticatedUserResponse> {
        const userId = ctxUserId();
        const user = await this.userService.findUserById(userId, userId);
        return new GetAuthenticatedUserResponse({
            user: this.converter.toUser(user),
        });
    }

    async updateUser(request: UpdateUserRequest, _: HandlerContext): Promise<UpdateUserResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async setWorkspaceAutoStartOptions(
        request: SetWorkspaceAutoStartOptionsRequest,
        _: HandlerContext,
    ): Promise<SetWorkspaceAutoStartOptionsResponse> {
        const userId = ctxUserId();

        const { userId: requestUserId, workspaceAutostartOptions } = request;

        if (!uuidValidate(requestUserId) || !workspaceAutostartOptions) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId and workspaceAutostartOptions are required");
        }

        const newWorkspaceAutostartOptions = workspaceAutostartOptions.map((o) =>
            this.converter.fromWorkspaceAutostartOption(o),
        );
        const currentUser = await this.userService.findUserById(userId, requestUserId);
        await this.userService.updateUser(userId, {
            id: currentUser.id,
            additionalData: {
                ...currentUser.additionalData,
                workspaceAutostartOptions: newWorkspaceAutostartOptions,
            },
        });

        return new SetWorkspaceAutoStartOptionsResponse();
    }

    async deleteUser(request: DeleteUserRequest, _: HandlerContext): Promise<DeleteUserResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async verifyUser(request: VerifyUserRequest, _: HandlerContext): Promise<VerifyUserResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async blockUser(request: BlockUserRequest, _: HandlerContext): Promise<BlockUserResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async listUsers(request: ListUsersRequest, _: HandlerContext): Promise<ListUsersResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async getUser(request: GetUserRequest, _: HandlerContext): Promise<GetUserResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }

    async setRolesOrPermissions(
        request: SetRolesOrPermissionsRequest,
        _: HandlerContext,
    ): Promise<SetRolesOrPermissionsResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
    }
}
