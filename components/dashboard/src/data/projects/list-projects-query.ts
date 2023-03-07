/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { listAllProjects } from "../../service/public-api";
import { useCurrentUser } from "../../user-context";
import { useCurrentOrg } from "../organizations/orgs-query";

type TeamOrUserID = {
    teamId?: string;
    userId?: string;
};

export type ListProjectsQueryResults = {
    projects: Project[];
};

export const useListProjectsQuery = () => {
    const team = useCurrentOrg().data;
    const user = useCurrentUser();

    const teamId = team?.id;
    const userId = user?.id;

    return useQuery<ListProjectsQueryResults>({
        // Projects are either tied to current team, otherwise current user
        queryKey: getListProjectsQueryKey({ teamId, userId }),
        cacheTime: 1000 * 60 * 60 * 1, // 1 hour
        queryFn: async () => {
            if (!userId && !teamId) {
                return {
                    projects: [],
                    latestPrebuilds: new Map(),
                };
            }

            let projects: Project[] = [];
            if (teamId) {
                projects = await listAllProjects({ teamId });
            } else {
                projects = await listAllProjects({ userId });
            }

            return {
                projects,
            };
        },
    });
};

// helper to force a refresh of the list projects query
export const useRefreshProjects = () => {
    const queryClient = useQueryClient();

    return useCallback(
        ({ teamId, userId }: TeamOrUserID) => {
            // Don't refetch if no team/user is provided
            if (!teamId && !userId) {
                return;
            }

            queryClient.refetchQueries({
                queryKey: getListProjectsQueryKey({ teamId, userId }),
            });
        },
        [queryClient],
    );
};

export const getListProjectsQueryKey = ({ teamId, userId }: TeamOrUserID) => {
    if (!teamId && !userId) {
        throw new Error("Must provide either a teamId or userId for projects query key");
    }

    return ["projects", "list", teamId ? { teamId } : { userId }];
};
