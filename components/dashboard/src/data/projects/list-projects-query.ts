/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import dayjs from "dayjs";
import { PrebuildWithStatus, Project } from "@gitpod/gitpod-protocol";
import { useCurrentTeam } from "../../teams/teams-context";
import { useCurrentUser } from "../../user-context";
import { listAllProjects } from "../../service/public-api";
import { getGitpodService } from "../../service/service";

type TeamOrUserID = {
    teamId?: string;
    userId?: string;
};

export type ListProjectsQueryResults = {
    projects: Project[];
    latestPrebuilds: Map<string, PrebuildWithStatus>;
};

export const useListProjectsQuery = () => {
    const team = useCurrentTeam();
    const user = useCurrentUser();

    const teamId = team?.id;
    const userId = user?.id;

    return useQuery<ListProjectsQueryResults>({
        // Projects are either tied to current team, otherwise current user
        queryKey: getListProjectsQueryKey({ teamId, userId }),
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

            // Load prebuilds for each project
            const latestPrebuilds = new Map<string, PrebuildWithStatus>();
            await Promise.all(
                projects.map(async (p) => {
                    try {
                        const lastPrebuild = await getGitpodService().server.findPrebuilds({
                            projectId: p.id,
                            latest: true,
                        });
                        if (lastPrebuild[0]) {
                            latestPrebuilds.set(p.id, lastPrebuild[0]);
                        }
                    } catch (error) {
                        console.error("Failed to load prebuilds for project", p, error);
                    }
                }),
            );

            // Sort projects by latest prebuild first
            projects.sort((p0: Project, p1: Project): number => {
                // use latest prebuild start time, then fallback to project creation if no prebuild
                const p0Date = latestPrebuilds.get(p0.id)?.info?.startedAt || p0.creationTime || "1970-01-01";
                const p1Date = latestPrebuilds.get(p1.id)?.info?.startedAt || p1.creationTime || "1970-01-01";

                return dayjs(p1Date).diff(dayjs(p0Date));
            });

            return {
                projects,
                latestPrebuilds,
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
