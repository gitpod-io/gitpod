/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentTeam } from "../../teams/teams-context";
import { useCurrentUser } from "../../user-context";
import { useFetchProjects } from "./fetchers";

type TeamOrUserID = {
    teamId?: string;
    userId?: string;
};

export const useProjects = () => {
    const team = useCurrentTeam();
    const user = useCurrentUser();
    const fetchProjects = useFetchProjects({ teamId: team?.id, userId: user?.id });

    return useQuery({
        // Projects are either tied to current team, otherwise current user
        queryKey: getProjectsQueryKey({ teamId: team?.id, userId: user?.id }),
        queryFn: fetchProjects,
    });
};

export const useRefreshProjects = () => {
    const queryClient = useQueryClient();

    return ({ teamId, userId }: TeamOrUserID) => {
        // Don't refetch if no team/user is provided
        if (!teamId && !userId) {
            return;
        }

        queryClient.refetchQueries({
            queryKey: getProjectsQueryKey({ teamId, userId }),
        });
    };
};

const getProjectsQueryKey = ({ teamId, userId }: TeamOrUserID) => {
    if (!teamId && !userId) {
        throw new Error("Must provide either a teamId or userId for projects query key");
    }

    return ["projects", teamId ? { teamId } : { userId }];
};
