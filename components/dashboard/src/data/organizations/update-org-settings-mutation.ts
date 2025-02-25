/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryKey, useOrgSettingsQueryInvalidator } from "./org-settings-query";
import { useCurrentOrg } from "./orgs-query";
import { organizationClient } from "../../service/public-api";
import {
    OrganizationSettings,
    UpdateOrganizationSettingsRequest,
} from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { useOrgWorkspaceClassesQueryInvalidator } from "./org-workspace-classes-query";
import { useOrgRepoSuggestionsInvalidator } from "./suggested-repositories-query";
import { PartialMessage } from "@bufbuild/protobuf";

export type UpdateOrganizationSettingsArgs = PartialMessage<UpdateOrganizationSettingsRequest>;

export const useUpdateOrgSettingsMutation = () => {
    const org = useCurrentOrg().data;
    const invalidateOrgSettings = useOrgSettingsQueryInvalidator();
    const invalidateWorkspaceClasses = useOrgWorkspaceClassesQueryInvalidator();
    const invalidateOrgRepoSuggestions = useOrgRepoSuggestionsInvalidator();

    const queryClient = useQueryClient();
    const organizationId = org?.id ?? "";

    return useMutation<OrganizationSettings, Error, UpdateOrganizationSettingsArgs>({
        mutationFn: async (partialUpdate) => {
            const update: UpdateOrganizationSettingsArgs = {
                ...partialUpdate,
            };
            update.organizationId = organizationId;
            update.updatePinnedEditorVersions = update.pinnedEditorVersions !== undefined;
            update.updateRestrictedEditorNames = update.restrictedEditorNames !== undefined;
            update.updateRoleRestrictions = update.roleRestrictions !== undefined;
            update.updateAllowedWorkspaceClasses = update.allowedWorkspaceClasses !== undefined;
            if (update.onboardingSettings) {
                update.onboardingSettings.updateRecommendedRepositories =
                    !!update.onboardingSettings.recommendedRepositories;
                if (update.onboardingSettings.welcomeMessage) {
                    update.onboardingSettings.welcomeMessage.featuredMemberResolvedAvatarUrl = undefined; // This field is not allowed to be set in the request.
                }
            }

            const { settings } = await organizationClient.updateOrganizationSettings(update);
            return settings!;
        },
        onSuccess: (settings) => {
            invalidateWorkspaceClasses();
            invalidateOrgRepoSuggestions();

            if (settings) {
                queryClient.setQueryData(getQueryKey(organizationId), settings);
            } else {
                invalidateOrgSettings();
            }
        },
        onError: (err) => {
            if (!ErrorCode.isUserError((err as any)?.["code"])) {
                console.error(err);
            }
        },
    });
};
