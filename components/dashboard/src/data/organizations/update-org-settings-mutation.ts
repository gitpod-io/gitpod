/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamSettings } from "@gitpod/gitpod-protocol";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getOrgSettingsQueryKey, TeamSettingsResult } from "./org-settings-query";
import { useCurrentOrg } from "./orgs-query";

type UpdateTeamSettingsArgs = Pick<TeamSettings, "workspaceSharingDisabled">;

export const useUpdateOrgSettingsMutation = () => {
    const queryClient = useQueryClient();
    const team = useCurrentOrg().data;
    const teamId = team?.id || "";

    return useMutation<TeamSettings, Error, UpdateTeamSettingsArgs>({
        mutationFn: async ({ workspaceSharingDisabled }) => {
            return await getGitpodService().server.updateTeamSettings(teamId, { workspaceSharingDisabled });
        },
        onSuccess: (newData, _) => {
            const queryKey = getOrgSettingsQueryKey(teamId);
            queryClient.setQueryData<TeamSettingsResult>(queryKey, newData);
            queryClient.invalidateQueries({ queryKey });
        },
    });
};
