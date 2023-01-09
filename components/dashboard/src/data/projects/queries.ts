/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentTeam } from "../../teams/teams-context";
import { useCurrentUser } from "../../user-context";
import { useFetchProjects } from "./fetchers";

export const useProjects = () => {
    const team = useCurrentTeam();
    const user = useCurrentUser();
    const fetchProjects = useFetchProjects({ teamId: team?.id, userId: user?.id });

    return useQuery({
        // Projects are either tied to current team, otherwise current user
        queryKey: ["projects", team ? { teamId: team.id } : { userId: user?.id }],
        queryFn: fetchProjects,
    });
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
