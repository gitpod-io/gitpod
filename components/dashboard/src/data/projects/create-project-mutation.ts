/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useRefreshAllProjects } from "./list-all-projects-query";
import { CreateProjectParams, Project } from "@gitpod/gitpod-protocol";

export type CreateProjectArgs = Omit<CreateProjectParams, "teamId">;

export const useCreateProject = () => {
    const refreshProjects = useRefreshAllProjects();
    const { data: org } = useCurrentOrg();

    return useMutation<Project, Error, CreateProjectArgs>(async ({ name, slug, cloneUrl, appInstallationId }) => {
        if (!org) {
            throw new Error("No org currently selected");
        }

        // ensure a .git suffix
        const normalizedCloneURL = cloneUrl.endsWith(".git") ? cloneUrl : `${cloneUrl}.git`;

        const newProject = await getGitpodService().server.createProject({
            name,
            slug,
            cloneUrl: normalizedCloneURL,
            teamId: org.id,
            appInstallationId,
        });

        // TODO: remove this once we delete ProjectContext
        // wait for projects to refresh before returning
        // this ensures that the new project is included in the list before we navigate to it
        await refreshProjects(org.id);

        return newProject;
    });
};
