/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamSettings } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export type TeamSettingsResult = TeamSettings;

type Args = {
    teamId: string;
};

export const useOrgSettingsQuery = ({ teamId }: Args) => {
    return useQuery<TeamSettingsResult>({
        queryKey: getOrgSettingsQuery(teamId),
        staleTime: 1000 * 60 * 1, // 1 minute
        queryFn: async () => {
            const settings = await getGitpodService().server.getTeamSettings(teamId);
            return settings || null;
        },
    });
};

export const getOrgSettingsQuery = (teamId: string) => ["org-settings", { teamId }];
