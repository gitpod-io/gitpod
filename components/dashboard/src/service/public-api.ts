/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { createConnectTransport, createPromiseClient } from "@bufbuild/connect-web";
import { Project as ProtocolProject } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { TeamsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import { TokensService } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_connectweb";
import { ProjectsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_connectweb";
import { WorkspacesService } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connectweb";
import { Project } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_pb";

const transport = createConnectTransport({
    baseUrl: `${window.location.protocol}//${window.location.host}/public-api`,
});

export const teamsService = createPromiseClient(TeamsService, transport);
export const personalAccessTokensService = createPromiseClient(TokensService, transport);
export const projectsService = createPromiseClient(ProjectsService, transport);
export const workspacesService = createPromiseClient(WorkspacesService, transport);

export async function listAllProjects(opts: { userId?: string; teamId?: string }): Promise<ProtocolProject[]> {
    let pagination = {
        page: 1,
        pageSize: 100,
    };

    const response = await projectsService.listProjects({
        teamId: opts.teamId,
        userId: opts.userId,
        pagination,
    });
    const results = response.projects;

    while (results.length < response.totalResults) {
        pagination = {
            pageSize: 100,
            page: 1 + pagination.page,
        };
        const response = await projectsService.listProjects({
            teamId: opts.teamId,
            userId: opts.userId,
            pagination,
        });
        results.push(...response.projects);
    }

    return results.map(projectToProtocol);
}

export function projectToProtocol(project: Project): ProtocolProject {
    return {
        id: project.id,
        name: project.name,
        cloneUrl: project.cloneUrl,
        creationTime: project.creationTime?.toDate().toISOString() || "",
        slug: project.slug,
        teamId: project.teamId,
        userId: project.userId,
        appInstallationId: "undefined",
        settings: {
            allowUsingPreviousPrebuilds: project.settings?.prebuild?.usePreviousPrebuilds,
            keepOutdatedPrebuildsRunning: project.settings?.prebuild?.keepOutdatedPrebuildsRunning,
            prebuildEveryNthCommit: project.settings?.prebuild?.prebuildEveryNth,
            useIncrementalPrebuilds: project.settings?.prebuild?.enableIncrementalPrebuilds,
            workspaceClasses: {
                prebuild: project.settings?.workspace?.workspaceClass?.prebuild || "",
                regular: project.settings?.workspace?.workspaceClass?.regular || "",
            },
        },
    };
}
