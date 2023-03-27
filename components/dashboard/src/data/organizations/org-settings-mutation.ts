/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamSettings } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

type UpdateTeamSettingsArgs = Pick<TeamSettings, "workspaceSharingDisabled" | "teamId">;

export const useUpdateTeamSettingsMutation = () => {
    return useMutation<TeamSettings, Error, UpdateTeamSettingsArgs>({
        mutationFn: async ({ teamId, workspaceSharingDisabled }) => {
            return await getGitpodService().server.updateTeamSettings(teamId, { workspaceSharingDisabled });
        },
    });
};
