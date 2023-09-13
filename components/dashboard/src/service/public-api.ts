/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { createPromiseClient } from "@bufbuild/connect";
import { createConnectTransport } from "@bufbuild/connect-web";
import { Project as ProtocolProject, Team as ProtocolTeam } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connectweb";
import { TeamsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import { TokensService } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_connectweb";
import { ProjectsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_connectweb";
import { WorkspacesService } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connectweb";
import { OIDCService } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_connectweb";
import { getMetricsInterceptor, MetricsReporter } from "@gitpod/public-api/lib/metrics";
import { Team } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { TeamMemberInfo, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { TeamMember, TeamRole } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { Project } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_pb";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

const transport = createConnectTransport({
    baseUrl: `${window.location.protocol}//${window.location.host}/public-api`,
    interceptors: [getMetricsInterceptor()],
});

const metricsReporter = new MetricsReporter(
    new GitpodHostUrl(window.location.href).withoutWorkspacePrefix().toString(),
    "dashboard",
);
metricsReporter.startReporting();

export const helloService = createPromiseClient(HelloService, transport);
export const teamsService = createPromiseClient(TeamsService, transport);
export const personalAccessTokensService = createPromiseClient(TokensService, transport);
export const projectsService = createPromiseClient(ProjectsService, transport);
export const workspacesService = createPromiseClient(WorkspacesService, transport);
export const oidcService = createPromiseClient(OIDCService, transport);

export function publicApiTeamToProtocol(team: Team): ProtocolTeam {
    return {
        id: team.id,
        name: team.name,
        slug: team.slug,
        // We do not use the creationTime in the dashboard anywhere, se we keep it empty.
        creationTime: "",
    };
}

export function publicApiTeamsToProtocol(teams: Team[]): ProtocolTeam[] {
    return teams.map(publicApiTeamToProtocol);
}

export function publicApiTeamMembersToProtocol(members: TeamMember[]): TeamMemberInfo[] {
    return members.map(publicApiTeamMemberToProtocol);
}

export function publicApiTeamMemberToProtocol(member: TeamMember): TeamMemberInfo {
    return {
        userId: member.userId,
        fullName: member.fullName,
        avatarUrl: member.avatarUrl,
        memberSince: member.memberSince?.toDate().toISOString() || "",
        role: publicApiTeamRoleToProtocol(member.role),
        primaryEmail: member.primaryEmail,
        ownedByOrganization: member.ownedByOrganization,
    };
}

export function publicApiTeamRoleToProtocol(role: TeamRole): TeamMemberRole {
    switch (role) {
        case TeamRole.OWNER:
            return "owner";
        case TeamRole.MEMBER:
        case TeamRole.UNSPECIFIED:
            return "member";
    }
}

export async function listAllProjects(opts: { orgId: string }): Promise<ProtocolProject[]> {
    let pagination = {
        page: 1,
        pageSize: 100,
    };

    const response = await projectsService.listProjects({
        teamId: opts.orgId,
        pagination,
    });
    const results = response.projects;

    while (results.length < response.totalResults) {
        pagination = {
            pageSize: 100,
            page: 1 + pagination.page,
        };
        const response = await projectsService.listProjects({
            teamId: opts.orgId,
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
        teamId: project.teamId,
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
