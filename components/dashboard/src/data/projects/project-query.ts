/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { listAllProjects } from "../../service/public-api";
import { PartialProject } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../../service/service";

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
    return ["project", { orgId, id }];
};

export const useUpdateProject = () => {
    const { data: org } = useCurrentOrg();
    const client = useQueryClient();

    return useMutation<void, Error, PartialProject>(async ({ id, name }) => {
        await getGitpodService().server.updateProjectPartial({ id, name });

        // Invalidate project
        await client.invalidateQueries(getProjectQueryKey(org?.id || "", id));

        // TODO: Invalidate new list projects query once https://github.com/gitpod-io/gitpod/pull/18935 is merged
    });
};
