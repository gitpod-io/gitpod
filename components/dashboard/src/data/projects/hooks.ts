/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFeatureFlags } from "../../contexts/FeatureFlagContext";
import { useCurrentTeam } from "../../teams/teams-context";
import { useCurrentUser } from "../../user-context";
import { fetchProjects } from "./fetchers";

export const useProjects = () => {
    const team = useCurrentTeam();
    const user = useCurrentUser();
    const { usePublicApiProjectsService } = useFeatureFlags();

    const info = useQuery({
        // Projects are either tied to current team, otherwise current user
        queryKey: ["projects", team ? { teamId: team.id } : { userId: user?.id }],
        queryFn: async () => fetchProjects({ teamId: team?.id, userId: user?.id, usePublicApiProjectsService }),
    });

    return {
        projects: info.data?.projects ?? [],
        latestPrebuilds: info.data?.latestPrebuilds ?? new Map(),
        ...info,
    };
};

type RefreshProjectsArgs = {
    userId?: string;
    teamId?: string;
};

export const useRefreshProjects = () => {
    const queryClient = useQueryClient();

    return ({ teamId, userId }: RefreshProjectsArgs) => {
        // Don't refetch if no team/user is provided
        if (!teamId && !userId) {
            return;
        }

        queryClient.refetchQueries({
            queryKey: ["projects", teamId ? { teamId } : { userId }],
        });
    };
};
