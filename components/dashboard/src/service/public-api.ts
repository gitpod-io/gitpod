/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { createConnectTransport, createPromiseClient, Interceptor } from "@bufbuild/connect-web";
import { Team as ProtocolTeam } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { TeamsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import { Team } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { TeamMemberInfo, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { TeamMember, TeamRole } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { getGitpodService } from "./service";

let token: string | undefined;

const authInterceptor: Interceptor = (next) => async (req) => {
    if (!token) {
        const newToken = await getGitpodService().server.generateNewGitpodToken({
            type: 1,
            scopes: [
                "function:getGitpodTokenScopes",

                "function:getWorkspace",
                "function:getWorkspaces",

                "function:createTeam",
                "function:joinTeam",
                "function:getTeams",
                "function:getTeam",
                "function:getTeamMembers",
                "function:getGenericInvite",

                "resource:default",
            ],
        });
        token = newToken;
    }

    req.header.set("Authorization", `Bearer ${token}`);
    return await next(req);
};

const transport = createConnectTransport({
    baseUrl: `${window.location.protocol}//api.${window.location.host}`,
    interceptors: [authInterceptor],
});

export const teamsService = createPromiseClient(TeamsService, transport);

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
