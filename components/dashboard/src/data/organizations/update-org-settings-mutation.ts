/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/gitpod-protocol";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getOrgSettingsQueryKey, OrgSettingsResult } from "./org-settings-query";
import { useCurrentOrg } from "./orgs-query";

type UpdateOrganizationSettingsArgs = Partial<
    Pick<OrganizationSettings, "workspaceSharingDisabled" | "defaultWorkspaceImage">
>;

export const useUpdateOrgSettingsMutation = () => {
    const queryClient = useQueryClient();
    const team = useCurrentOrg().data;
    const teamId = team?.id || "";

    return useMutation<OrganizationSettings, Error, UpdateOrganizationSettingsArgs>({
        mutationFn: async ({ workspaceSharingDisabled, defaultWorkspaceImage }) => {
            return await getGitpodService().server.updateOrgSettings(teamId, {
                workspaceSharingDisabled,
                defaultWorkspaceImage,
            });
        },
        onSuccess: (newData, _) => {
            const queryKey = getOrgSettingsQueryKey(teamId);
            queryClient.setQueryData<OrgSettingsResult>(queryKey, newData);
            queryClient.invalidateQueries({ queryKey });
        },
    });
};
