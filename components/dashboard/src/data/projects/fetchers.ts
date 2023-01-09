/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuildWithStatus, Project } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { listAllProjects } from "../../service/public-api";
import { getGitpodService } from "../../service/service";

type FetchProjectsArgs = {
    userId?: string;
    teamId?: string;
    usePublicApiProjectsService: boolean;
};

type FetchProjectsReturnValue = {
    projects: Project[];
    latestPrebuilds: Map<string, PrebuildWithStatus>;
};

export const fetchProjects = async ({
    userId,
    teamId,
    usePublicApiProjectsService,
}: FetchProjectsArgs): Promise<FetchProjectsReturnValue> => {
    if (!userId && !teamId) {
        return {
            projects: [],
            latestPrebuilds: new Map(),
        };
    }

    let projects: Project[] = [];
    if (teamId) {
        projects = usePublicApiProjectsService
            ? await listAllProjects({ teamId })
            : await getGitpodService().server.getTeamProjects(teamId);
    } else {
        projects = usePublicApiProjectsService
            ? await listAllProjects({ userId })
            : await getGitpodService().server.getUserProjects();
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
        return dayjs(latestPrebuilds.get(p1.id)?.info?.startedAt || "1970-01-01").diff(
            dayjs(latestPrebuilds.get(p0.id)?.info?.startedAt || "1970-01-01"),
        );
    });

    return {
        projects,
        latestPrebuilds,
    };
};
