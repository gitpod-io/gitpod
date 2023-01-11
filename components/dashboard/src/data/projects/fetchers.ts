/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuildWithStatus, Project } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { listAllProjects } from "../../service/public-api";
import { getGitpodService } from "../../service/service";

type UseFetchProjectsArgs = {
    userId?: string;
    teamId?: string;
};

type FetchProjectsReturnValue = {
    projects: Project[];
    latestPrebuilds: Map<string, PrebuildWithStatus>;
};

// Wrap fetcher fn in a hook for easy access to feature flags
export const useFetchProjects = ({ teamId, userId }: UseFetchProjectsArgs) => {
    // Return an async fn to fetch data
    return async (): Promise<FetchProjectsReturnValue> => {
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
    };
};
