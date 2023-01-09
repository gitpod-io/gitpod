/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useContext } from "react";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { listAllProjects } from "../service/public-api";
import { getGitpodService } from "../service/service";
import { TeamsContext, useCurrentTeam } from "../teams/teams-context";
import { useCurrentUser } from "../user-context";

export const useProjects = () => {
    const { teams } = useContext(TeamsContext);
    const team = useCurrentTeam();
    const user = useCurrentUser();
    const { usePublicApiProjectsService } = useFeatureFlags();

    const info = useQuery({
        queryKey: ["projects", team?.id],
        queryFn: async () => {
            if (!teams) {
                return;
            }

            let projects: Project[] = [];
            if (!!team) {
                projects = usePublicApiProjectsService
                    ? await listAllProjects({ teamId: team.id })
                    : await getGitpodService().server.getTeamProjects(team.id);
            } else {
                projects = usePublicApiProjectsService
                    ? await listAllProjects({ userId: user?.id })
                    : await getGitpodService().server.getUserProjects();
            }

            // Load prebuilds for each project
            const latestPrebuilds = new Map();
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
                return dayjs(latestPrebuilds.get(p1.id)?.info?.startedAt || "1970-01-01").diff(
                    dayjs(latestPrebuilds.get(p0.id)?.info?.startedAt || "1970-01-01"),
                );
            });

            return {
                projects,
                latestPrebuilds,
            };
        },
    });

    return {
        projects: info.data?.projects ?? [],
        latestPrebuilds: info.data?.latestPrebuilds ?? new Map(),
        ...info,
    };
};
