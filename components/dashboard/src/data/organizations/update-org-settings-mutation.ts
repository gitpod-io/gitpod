/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useOrgSettingsQueryInvalidator } from "./org-settings-query";
import { useCurrentOrg } from "./orgs-query";
import { organizationClient } from "../../service/public-api";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { useOrgWorkspaceClassesQueryInvalidator } from "./org-workspace-classes-query";
import { PlainMessage } from "@bufbuild/protobuf";
import { useOrgRepoSuggestionsInvalidator } from "./suggested-repositories-query";

export type UpdateOrganizationSettingsArgs = Partial<
    Omit<
        Pick<
            PlainMessage<OrganizationSettings>,
            | "workspaceSharingDisabled"
            | "defaultWorkspaceImage"
            | "allowedWorkspaceClasses"
            | "pinnedEditorVersions"
            | "restrictedEditorNames"
            | "defaultRole"
            | "timeoutSettings"
            | "roleRestrictions"
            | "maxParallelRunningWorkspaces"
            | "annotateGitCommits"
        >,
        never
    > & {
        onboardingSettings?: Partial<PlainMessage<OrganizationSettings>["onboardingSettings"]>; // this enables us to not have to specify all of the onboarding settings on every update
    }
>;

export const useUpdateOrgSettingsMutation = () => {
    const org = useCurrentOrg().data;
    const invalidateOrgSettings = useOrgSettingsQueryInvalidator();
    const invalidateWorkspaceClasses = useOrgWorkspaceClassesQueryInvalidator();
    const invalidateOrgRepoSuggestions = useOrgRepoSuggestionsInvalidator();
    const organizationId = org?.id ?? "";

    return useMutation<OrganizationSettings, Error, UpdateOrganizationSettingsArgs>({
        mutationFn: async ({
            workspaceSharingDisabled,
            defaultWorkspaceImage,
            allowedWorkspaceClasses,
            pinnedEditorVersions,
            restrictedEditorNames,
            defaultRole,
            timeoutSettings,
            roleRestrictions,
            maxParallelRunningWorkspaces,
            onboardingSettings,
            annotateGitCommits,
        }) => {
            const settings = await organizationClient.updateOrganizationSettings({
                organizationId,
                workspaceSharingDisabled: workspaceSharingDisabled ?? false,
                defaultWorkspaceImage,
                allowedWorkspaceClasses,
                updatePinnedEditorVersions: !!pinnedEditorVersions,
                pinnedEditorVersions,
                restrictedEditorNames,
                updateRestrictedEditorNames: !!restrictedEditorNames,
                defaultRole,
                timeoutSettings,
                roleRestrictions,
                updateRoleRestrictions: !!roleRestrictions,
                maxParallelRunningWorkspaces,
                onboardingSettings: {
                    ...onboardingSettings,
                    updateRecommendedRepositories: !!onboardingSettings?.recommendedRepositories,
                    welcomeMessage: {
                        ...onboardingSettings?.welcomeMessage,
                        featuredMemberResolvedAvatarUrl: undefined, // This field is not allowed to be set in the request.
                    },
                },
                annotateGitCommits,
            });
            return settings.settings!;
        },
        onSuccess: () => {
            invalidateOrgSettings();
            invalidateWorkspaceClasses();
            invalidateOrgRepoSuggestions();
        },
        onError: (err) => {
            if (!ErrorCode.isUserError((err as any)?.["code"])) {
                console.error(err);
            }
        },
    });
};
