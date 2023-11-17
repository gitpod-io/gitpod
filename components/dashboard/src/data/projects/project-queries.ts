/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { listAllProjects, projectsService } from "../../service/public-api";
import type { PartialProject } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../../service/service";

const BASE_KEY = "projects";

type UseProjectArgs = {
    id: string;
};
export const useProject = ({ id }: UseProjectArgs) => {
    const { data: org } = useCurrentOrg();

    return useQuery<Project | null, Error>(
        getProjectQueryKey(org?.id || "", id),
        async () => {
            if (!org) {
                throw new Error("No current org");
            }

            // TODO: This is temporary until we create a project by id endpoint
            // Waiting to tackle that once we have the new grpc setup for server
            const projects = await listAllProjects({ orgId: org.id });
            const project = projects.find((p) => p.id === id);

            return project || null;
        },
        {
            enabled: !!org,
        },
    );
};

const getProjectQueryKey = (orgId: string, id: string) => {
    return [BASE_KEY, { orgId, id }];
};

type ListProjectsQueryArgs = {
    page: number;
    pageSize: number;
};

export const useListProjectsQuery = ({ page, pageSize }: ListProjectsQueryArgs) => {
    const { data: org } = useCurrentOrg();

    return useQuery(
        getListProjectsQueryKey(org?.id || "", { page, pageSize }),
        async () => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            return projectsService.listProjects({ teamId: org.id, pagination: { page, pageSize } });
        },
        {
            enabled: !!org,
        },
    );
};

export const getListProjectsQueryKey = (orgId: string, args?: ListProjectsQueryArgs) => {
    const key: any[] = [BASE_KEY, "list", { orgId }];
    if (args) {
        key.push(args);
    }

    return key;
};

export const useUpdateProject = () => {
    const { data: org } = useCurrentOrg();
    const client = useQueryClient();

    return useMutation<void, Error, PartialProject>(async (settings) => {
        if (!org) {
            throw new Error("No org currently selected");
        }

        await getGitpodService().server.updateProjectPartial(settings);

        // Invalidate project
        client.invalidateQueries(getProjectQueryKey(org.id, settings.id));
        // Invalidate project list queries
        client.invalidateQueries(getListProjectsQueryKey(org.id));
    });
};
