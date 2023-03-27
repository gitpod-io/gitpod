/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamSettings } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentOrg } from "./orgs-query";

export type TeamSettingsResult = TeamSettings;

export const useOrgSettingsQuery = () => {
    const team = useCurrentOrg().data;
    const teamId = team?.id || "";
    return useQuery<TeamSettingsResult>({
        queryKey: getOrgSettingsQueryKey(teamId),
        staleTime: 1000 * 60 * 1, // 1 minute
        queryFn: async () => {
            const settings = await getGitpodService().server.getTeamSettings(teamId);
            return settings || null;
        },
    });
};

export const getOrgSettingsQueryKey = (teamId: string) => ["org-settings", { teamId }];
