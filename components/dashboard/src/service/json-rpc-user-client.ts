/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserService } from "@gitpod/public-api/lib/gitpod/v1/user_connect";

import { PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import {
    DeleteUserRequest,
    DeleteUserResponse,
    GetAuthenticatedUserRequest,
    GetAuthenticatedUserResponse,
    SetWorkspaceAutoStartOptionsRequest,
    SetWorkspaceAutoStartOptionsResponse,
    UpdateUserRequest,
    UpdateUserResponse,
    User_WorkspaceAutostartOption,
} from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { getGitpodService } from "./service";
import { converter } from "./public-api";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { User as UserProtocol } from "@gitpod/gitpod-protocol";
import { EditorReference } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";

type UpdateCurrentUserArgs = Required<Pick<UserProtocol, "id" | "fullName" | "additionalData">>;

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
        if (!userId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }

        const current = await getGitpodService().server.getLoggedInUser();
        const currentAdditionalData = { ...current.additionalData };
        const update: UpdateCurrentUserArgs = {
            id: userId,
            fullName: current.fullName!,
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
            update.additionalData.ideSettings = converter.fromEditorReference(
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
                emailAddress,
                resetMask,
            } = profile;
            if (!!emailAddress) {
                update.additionalData.profile.emailAddress = emailAddress;
            }
            if (explorationReasons && explorationReasons.length > 0) {
                update.additionalData.profile.explorationReasons = explorationReasons;
            }
            if ((resetMask?.paths || "").includes("exploration_reasons")) {
                update.additionalData.profile.explorationReasons = undefined;
            }
            if (signupGoals && signupGoals.length > 0) {
                update.additionalData.profile.signupGoals = signupGoals;
            }
            if ((resetMask?.paths || "").includes("signup_goals")) {
                update.additionalData.profile.explorationReasons = undefined;
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
            update.additionalData.workspaceTimeout = converter.toDurationString(workspaceTimeoutSettings.inactivity);
            update.additionalData.disabledClosedTimeout = workspaceTimeoutSettings.disabledDisconnected;
        }

        const user = await getGitpodService().server.updateLoggedInUser(update);
        return new UpdateUserResponse({
            user: converter.toUser(user),
        });
    }

    async setWorkspaceAutoStartOptions(
        request: PartialMessage<SetWorkspaceAutoStartOptionsRequest>,
    ): Promise<SetWorkspaceAutoStartOptionsResponse> {
        const { userId, workspaceAutostartOptions } = request;
        if (!userId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }
        if (!workspaceAutostartOptions) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "workspaceAutostartOptions is required");
        }

        const current = await getGitpodService().server.getLoggedInUser();
        const currentAdditionalData = { ...current.additionalData };
        const update: UpdateCurrentUserArgs = {
            id: userId,
            fullName: current.fullName!,
            additionalData: {
                ...(currentAdditionalData || {}),
            },
        };
        update.additionalData.workspaceAutostartOptions = workspaceAutostartOptions.map((o) =>
            converter.fromWorkspaceAutostartOption(
                new User_WorkspaceAutostartOption({
                    cloneUrl: o.cloneUrl,
                    editorSettings: o.editorSettings,
                    organizationId: o.organizationId,
                    region: o.region,
                    workspaceClass: o.workspaceClass,
                }),
            ),
        );
        const user = await getGitpodService().server.updateLoggedInUser(update);
        return new UpdateUserResponse({
            user: converter.toUser(user),
        });
    }

    async deleteUser({ userId }: PartialMessage<DeleteUserRequest>): Promise<DeleteUserResponse> {
        if (!userId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }
        await getGitpodService().server.deleteAccount();
        return new DeleteUserResponse({});
    }
}
