/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Interceptor, createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { Project as ProtocolProject, Team as ProtocolTeam } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connect";
import { TeamsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connect";
import { TokensService } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_connect";
import { ProjectsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_connect";
import { WorkspacesService } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connect";
import { OIDCService } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_connect";
import { getMetricsInterceptor } from "@gitpod/public-api/lib/metrics";
import { Team } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { TeamMemberInfo, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { TeamMember, TeamRole } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { Project } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_pb";

class WrapError extends Error {
    constructor(msg: string, readonly cause: any, readonly code?: string) {
        super();

        let originalMessage = cause?.message;
        if (!originalMessage) {
            if (cause instanceof Error) {
                originalMessage = cause?.toString();
            } else {
                try {
                    originalMessage = JSON.stringify(cause);
                } catch {}
            }
        }
        this.message = `${msg}: ${originalMessage}`;

        if (cause instanceof Error) {
            this.name = cause.name;
            this.stack = this.stack + "\n\n" + cause.stack;
        }

        this.code ??= cause?.code;
    }
}

function getLogErrorInterceptor(): Interceptor {
    return (next) => async (req) => {
        try {
            const resp = await next(req);
            return resp;
        } catch (e) {
            throw new WrapError(`failed to call papi: ${req.method}`, e);
        }
    };
}

const transport = createConnectTransport({
    baseUrl: `${window.location.protocol}//${window.location.host}/public-api`,
    interceptors: [getLogErrorInterceptor(), getMetricsInterceptor()],
    defaultTimeoutMs: 4000,
});

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
            workspaceClasses: {
                regular: project.settings?.workspace?.workspaceClass?.regular || "",
            },
            prebuilds: {
                enable: project.settings?.prebuild?.enablePrebuilds,
                branchStrategy: project.settings?.prebuild?.branchStrategy as any,
                branchMatchingPattern: project.settings?.prebuild?.branchMatchingPattern,
                prebuildInterval: project.settings?.prebuild?.prebuildInterval,
                workspaceClass: project.settings?.prebuild?.workspaceClass,
            },
        },
    };
}
