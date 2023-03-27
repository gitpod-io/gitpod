/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamSettings } from "@gitpod/gitpod-protocol";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getOrgSettingsQuery, TeamSettingsResult } from "./org-settings-query";

type UpdateTeamSettingsArgs = Pick<TeamSettings, "workspaceSharingDisabled" | "teamId">;

export const useUpdateTeamSettingsMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<TeamSettings, Error, UpdateTeamSettingsArgs>({
        mutationFn: async ({ teamId, workspaceSharingDisabled }) => {
            return await getGitpodService().server.updateTeamSettings(teamId, { workspaceSharingDisabled });
        },
        onSuccess: (_, { teamId, workspaceSharingDisabled }) => {
            const queryKey = getOrgSettingsQuery(teamId);
            queryClient.setQueryData<TeamSettingsResult>(queryKey, (oldData) => {
                return {
                    teamId,
                    ...oldData,
                    workspaceSharingDisabled: !workspaceSharingDisabled,
                };
            });
            queryClient.invalidateQueries({ queryKey });
        },
    });
};
