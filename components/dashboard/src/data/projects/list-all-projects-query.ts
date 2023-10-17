/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { listAllProjects } from "../../service/public-api";
import { useCurrentOrg } from "../organizations/orgs-query";

export type ListAllProjectsQueryResults = {
    projects: Project[];
};

export const useListAllProjectsQuery = () => {
    const org = useCurrentOrg().data;
    const orgId = org?.id;
    return useQuery<ListAllProjectsQueryResults>({
        enabled: !!orgId,
        queryKey: getListAllProjectsQueryKey(orgId || ""),
        cacheTime: 1000 * 60 * 60 * 1, // 1 hour
        queryFn: async () => {
            if (!orgId) {
                return {
                    projects: [],
                    latestPrebuilds: new Map(),
                };
            }

            const projects = await listAllProjects({ orgId });
            return {
                projects,
            };
        },
    });
};

// helper to force a refresh of the list projects query
export const useRefreshAllProjects = () => {
    const queryClient = useQueryClient();

    return useCallback(
        async (orgId: string) => {
            // Don't refetch if no org is provided
            if (!orgId) {
                return;
            }

            return await queryClient.refetchQueries({
                queryKey: getListAllProjectsQueryKey(orgId),
            });
        },
        [queryClient],
    );
};

export const getListAllProjectsQueryKey = (orgId: string) => {
    return ["projects", "list-all", { orgId }];
};
