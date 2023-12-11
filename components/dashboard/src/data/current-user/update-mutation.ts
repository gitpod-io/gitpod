/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { trackEvent } from "../../Analytics";
import { useCurrentUser } from "../../user-context";
import { converter, userClient } from "../../service/public-api";
import {
    SetWorkspaceAutoStartOptionsRequest,
    SetWorkspaceAutoStartOptionsRequest_WorkspaceAutostartOption,
    UpdateUserRequest,
    UpdateUserRequest_EmailNotificationSettings,
    UpdateUserRequest_ProfileDetails,
    User_WorkspaceAutostartOption,
} from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { EditorReference } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";
import { PartialMessage, PlainMessage } from "@bufbuild/protobuf";

export const useUpdateCurrentUserDotfileRepoMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async (dotfileRepo: string) => {
            if (!user) {
                throw new Error("No user present");
            }

            const update = await userClient.updateUser(
                new UpdateUserRequest({
                    userId: user.id,
                    dotfileRepo,
                }),
            );

            return update.user;
        },
        onMutate: async () => {
            return {
                previousDotfileRepo: user?.dotfileRepo || "",
            };
        },
        onSuccess: (updatedUser, _, context) => {
            if (updatedUser?.dotfileRepo !== context?.previousDotfileRepo) {
                trackEvent("dotfile_repo_changed", {
                    previous: context?.previousDotfileRepo ?? "",
                    current: updatedUser?.dotfileRepo ?? "",
                });
            }
        },
    });
};

export const useUpdateAcceptedPrivacyPolicyDateMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async (date: string) => {
            if (!user) {
                throw new Error("No user present");
            }

            const update = await userClient.updateUser(
                new UpdateUserRequest({
                    userId: user.id,
                    acceptedPrivacyPolicyDate: date,
                }),
            );

            return update.user;
        },
        onMutate: async () => {
            return {
                previousAcceptedPrivacyPolicyDate: user?.profile?.acceptedPrivacyPolicyDate || "",
            };
        },
        onSuccess: (updatedUser, _, context) => {
            if (updatedUser?.profile?.acceptedPrivacyPolicyDate !== context?.previousAcceptedPrivacyPolicyDate) {
                trackEvent("privacy_policy_update_accepted", {
                    path: window.location.pathname,
                    success: true,
                });
            }
        },
    });
};

export const useEmailNotificationSettingsMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async (settings: PlainMessage<UpdateUserRequest_EmailNotificationSettings>) => {
            if (!user) {
                throw new Error("No user present");
            }

            const newValue = new UpdateUserRequest_EmailNotificationSettings({
                ...user.emailNotificationSettings,
            });
            const { allowsChangelogMail, allowsDevxMail, allowsOnboardingMail } = settings;
            if (typeof allowsChangelogMail === "boolean") {
                newValue.allowsChangelogMail = allowsChangelogMail;
            }
            if (typeof allowsDevxMail === "boolean") {
                newValue.allowsDevxMail = allowsDevxMail;
            }
            if (typeof allowsOnboardingMail === "boolean") {
                newValue.allowsOnboardingMail = allowsOnboardingMail;
            }

            const update = await userClient.updateUser(
                new UpdateUserRequest({
                    userId: user.id,
                    emailNotificationSettings: newValue,
                }),
            );

            return update.user;
        },
    });
};

export const useUpdateProfileMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async (profile: PartialMessage<UpdateUserRequest_ProfileDetails>) => {
            if (!user) {
                throw new Error("No user present");
            }

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

            const newValue = new UpdateUserRequest_ProfileDetails({
                ...user.profile,
            });
            if (!!explorationReasons) {
                newValue.explorationReasons = explorationReasons;
            }
            if (!!signupGoals) {
                newValue.signupGoals = signupGoals;
            }
            if (!!acceptedPrivacyPolicyDate) {
                newValue.acceptedPrivacyPolicyDate = acceptedPrivacyPolicyDate;
            }
            if (!!companyName) {
                newValue.companyName = companyName;
            }
            if (!!companySize) {
                newValue.companySize = companySize;
            }
            if (!!jobRole) {
                newValue.jobRole = jobRole;
            }
            if (!!jobRoleOther) {
                newValue.jobRoleOther = jobRoleOther;
            }
            if (!!lastUpdatedDetailsNudge) {
                newValue.lastUpdatedDetailsNudge = lastUpdatedDetailsNudge;
            }
            if (!!onboardedTimestamp) {
                newValue.onboardedTimestamp = onboardedTimestamp;
            }
            if (!!signupGoalsOther) {
                newValue.signupGoalsOther = signupGoalsOther;
            }

            const update = await userClient.updateUser(
                new UpdateUserRequest({
                    userId: user.id,
                    profile: newValue,
                }),
            );

            return update.user;
        },
    });
};

export const useStoreWorkspaceAutoStartOptionMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async (option: User_WorkspaceAutostartOption) => {
            if (!user) {
                throw new Error("No user present");
            }

            // filter current options
            let workspaceAutoStartOptions = (user.workspaceAutostartOptions || []).filter(
                (e) => !(e.cloneUrl === option.cloneUrl && e.organizationId === option.organizationId),
            );

            // we only keep the last 40 options
            workspaceAutoStartOptions = workspaceAutoStartOptions.slice(-40);

            // remember new option
            workspaceAutoStartOptions.push(option);

            await userClient.setWorkspaceAutoStartOptions(
                new SetWorkspaceAutoStartOptionsRequest({
                    userId: user.id,
                    workspaceAutostartOptions: workspaceAutoStartOptions,
                }),
            );

            // TODO(at) use query invalidation to update user state
            const updatedUser = (await userClient.getAuthenticatedUser({})).user;
            return updatedUser;
        },
        onSuccess: (updatedUser, _, context) => {
            // TODO(at) invalidate/update user state in UserContext
        },
    });
};

export const useResetWorkspaceAutoStartOptionsMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async () => {
            if (!user) {
                throw new Error("No user present");
            }

            await userClient.setWorkspaceAutoStartOptions(
                new SetWorkspaceAutoStartOptionsRequest({
                    userId: user.id,
                    workspaceAutostartOptions: [],
                }),
            );

            // TODO(at) use query invalidation to update user state
            const updatedUser = (await userClient.getAuthenticatedUser({})).user;
            return updatedUser;
        },
        onSuccess: (updatedUser, _, context) => {
            // TODO(at) invalidate/update user state in UserContext
        },
    });
};

export const useUpdateEditorSettingsMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async ({ selectedIde, useLatestVersion }: { selectedIde: string; useLatestVersion: boolean }) => {
            if (!user) {
                throw new Error("No user present");
            }

            // update stored autostart options to match useLatestVersion value set here
            const workspaceAutostartOptions = user?.workspaceAutostartOptions?.map(
                (o) =>
                    new SetWorkspaceAutoStartOptionsRequest_WorkspaceAutostartOption({
                        ...o,
                        editorSettings: {
                            ...o.editorSettings,
                            version: useLatestVersion ? "latest" : "stable",
                        },
                    }),
            );
            await userClient.setWorkspaceAutoStartOptions(
                new SetWorkspaceAutoStartOptionsRequest({
                    userId: user.id,
                    workspaceAutostartOptions,
                }),
            );

            const updatedUser = await userClient.updateUser(
                new UpdateUserRequest({
                    userId: user.id,
                    editorSettings: new EditorReference({
                        name: selectedIde,
                        version: useLatestVersion ? "latest" : "stable",
                    }),
                }),
            );

            return updatedUser.user;
        },
    });
};

export const useUpdateWorkspaceTimeoutMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async (workspaceTimeout: string) => {
            if (!user) {
                throw new Error("No user present");
            }

            const updatedUser = await userClient.updateUser(
                new UpdateUserRequest({
                    userId: user.id,
                    workspaceTimeoutSettings: {
                        inactivity: converter.toDuration(workspaceTimeout),
                    },
                }),
            );

            return updatedUser.user;
        },
    });
};

export const useUpdateAccountDetailsMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async ({
            name,
            emailAddress,
            lastUpdatedDetailsNudge,
        }: {
            name: string;
            emailAddress: string;
            lastUpdatedDetailsNudge?: string;
        }) => {
            if (!user) {
                throw new Error("No user present");
            }

            const request = new UpdateUserRequest({
                userId: user.id,
            });
            if (!!name) {
                request.name = name;
            }
            if (!!emailAddress) {
                request.profile = request.profile || new UpdateUserRequest_ProfileDetails({});
                request.profile.emailAddress = emailAddress;
            }
            if (typeof lastUpdatedDetailsNudge === "string") {
                request.profile = request.profile || new UpdateUserRequest_ProfileDetails({});
                request.profile.lastUpdatedDetailsNudge = lastUpdatedDetailsNudge;
            }
            const updatedUser = await userClient.updateUser(request);

            return updatedUser.user;
        },
    });
};
