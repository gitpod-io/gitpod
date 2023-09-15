/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useRefreshProjects } from "./list-projects-query";
import { CreateProjectParams, Project } from "@gitpod/gitpod-protocol";

export type CreateProjectArgs = Omit<CreateProjectParams, "teamId">;

export const useCreateProject = () => {
    const refreshProjects = useRefreshProjects();
    const { data: org } = useCurrentOrg();

    return useMutation<Project, Error, CreateProjectArgs>(
        async ({ name, slug, cloneUrl, appInstallationId }) => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            return await getGitpodService().server.createProject({
                name,
                slug,
                cloneUrl,
                teamId: org.id,
                appInstallationId,
            });
        },
        {
            onSuccess: (project) => {
                if (org) {
                    refreshProjects(org.id);
                }
            },
        },
    );
};
