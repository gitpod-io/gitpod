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
} from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { UserService } from "../user/user-service";
import { validate as uuidValidate } from "uuid";
import { ctxUserId } from "../util/request-context";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { User as UserProtocol } from "@gitpod/gitpod-protocol";
import { EditorReference } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";

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
        const subjectId = ctxUserId();
        if (!uuidValidate(request.userId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }

        const currentUser = await this.userService.findUserById(subjectId, request.userId);
        const {
            userId,
            name,
            profile,
            acceptedPrivacyPolicyDate,
            editorSettings,
            emailAddress,
            emailNotificationSettings,
            workspaceTimeoutSettings,
            dotfileRepo,
        } = request;

        const currentAdditionalData = { ...currentUser.additionalData };
        type UpdateCurrentUserArgs = Required<Pick<UserProtocol, "id" | "fullName" | "additionalData">>;
        const update: UpdateCurrentUserArgs = {
            id: userId,
            fullName: currentUser.fullName!,
            additionalData: {
                ...(currentAdditionalData || {}),
            },
        };

        if (emailNotificationSettings) {
            if (!update.additionalData.emailNotificationSettings) {
                update.additionalData.emailNotificationSettings = {};
            }
            const { allowsChangelogMail, allowsDevxMail, allowsOnboardingMail } = emailNotificationSettings;
            if (typeof allowsChangelogMail === "boolean") {
                update.additionalData.emailNotificationSettings.allowsChangelogMail = allowsChangelogMail;
            }
            if (typeof allowsDevxMail === "boolean") {
                update.additionalData.emailNotificationSettings.allowsDevXMail = allowsDevxMail;
            }
            if (typeof allowsOnboardingMail === "boolean") {
                update.additionalData.emailNotificationSettings.allowsOnboardingMail = allowsOnboardingMail;
            }
        }

        if (typeof acceptedPrivacyPolicyDate === "string") {
            update.additionalData.profile = update.additionalData.profile || {};
            update.additionalData.profile.acceptedPrivacyPolicyDate = acceptedPrivacyPolicyDate;
        }

        if (typeof dotfileRepo === "string") {
            update.additionalData.dotfileRepo = dotfileRepo;
        }

        if (typeof name === "string" && !!name.trim()) {
            update.fullName = name;
        }

        if (typeof emailAddress === "string" && !!emailAddress.trim()) {
            update.additionalData.profile = update.additionalData.profile || {};
            update.additionalData.profile.emailAddress = emailAddress.trim();
        }

        if (!!editorSettings) {
            update.additionalData.ideSettings = this.converter.fromEditorReference(
                new EditorReference({ ...editorSettings }),
            );
        }

        if (!!profile) {
            update.additionalData.profile = update.additionalData.profile || {};
            const {
                explorationReasons,
                signupGoals,
                acceptedPrivacyPolicyDate,
                companyName,
                companySize,
                jobRole,
                jobRoleOther,
                lastUpdatedDetailsNudge,
                onboardedTimestamp,
                signupGoalsOther,
            } = profile;
            if (!!explorationReasons) {
                update.additionalData.profile.explorationReasons = explorationReasons;
            }
            if (!!signupGoals) {
                update.additionalData.profile.signupGoals = signupGoals;
            }
            if (!!acceptedPrivacyPolicyDate) {
                update.additionalData.profile.acceptedPrivacyPolicyDate = acceptedPrivacyPolicyDate;
            }
            if (!!companyName) {
                update.additionalData.profile.companyName = companyName;
            }
            if (!!companySize) {
                update.additionalData.profile.companySize = companySize;
            }
            if (!!jobRole) {
                update.additionalData.profile.jobRole = jobRole;
            }
            if (!!jobRoleOther) {
                update.additionalData.profile.jobRoleOther = jobRoleOther;
            }
            if (!!lastUpdatedDetailsNudge) {
                update.additionalData.profile.lastUpdatedDetailsNudge = lastUpdatedDetailsNudge;
            }
            if (!!onboardedTimestamp) {
                update.additionalData.profile.onboardedTimestamp = onboardedTimestamp;
            }
            if (!!signupGoalsOther) {
                update.additionalData.profile.signupGoalsOther = signupGoalsOther;
            }
        }

        if (!!workspaceTimeoutSettings) {
            update.additionalData.workspaceTimeout = this.converter.toDurationString(
                workspaceTimeoutSettings.inactivity,
            );
            update.additionalData.disabledClosedTimeout = workspaceTimeoutSettings.disabledDisconnected;
        }

        const updatedUser = await this.userService.updateUser(subjectId, update);
        return new UpdateUserResponse({
            user: this.converter.toUser(updatedUser),
        });
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

    async deleteUser({ userId }: DeleteUserRequest, _: HandlerContext): Promise<DeleteUserResponse> {
        const subjectId = ctxUserId();
        if (!uuidValidate(userId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }
        await this.userService.deleteUser(subjectId, userId);
        return new DeleteUserResponse();
    }
}
