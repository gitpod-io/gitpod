/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, ServiceImpl } from "@connectrpc/connect";
import { inject, injectable } from "inversify";
import { TeamsService as TeamServiceInterface } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connect";
import {
    CreateTeamRequest,
    CreateTeamResponse,
    DeleteTeamMemberRequest,
    DeleteTeamMemberResponse,
    DeleteTeamRequest,
    DeleteTeamResponse,
    GetTeamInvitationRequest,
    GetTeamInvitationResponse,
    GetTeamRequest,
    GetTeamResponse,
    JoinTeamRequest,
    JoinTeamResponse,
    ListTeamMembersRequest,
    ListTeamMembersResponse,
    ListTeamsRequest,
    ListTeamsResponse,
    ResetTeamInvitationRequest,
    ResetTeamInvitationResponse,
    Team,
    TeamInvitation,
    TeamMember,
    TeamRole,
    UpdateTeamMemberRequest,
    UpdateTeamMemberResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { TeamDB } from "@gitpod/gitpod-db/lib";
import { validate } from "uuid";
import { OrgMemberInfo, Organization, TeamMembershipInvite } from "@gitpod/gitpod-protocol";
import { Timestamp } from "@bufbuild/protobuf";

@injectable()
export class APITeamsService implements ServiceImpl<typeof TeamServiceInterface> {
    @inject(TeamDB) protected readonly teamDB: TeamDB;

    public async createTeam(req: CreateTeamRequest): Promise<CreateTeamResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async getTeam(req: GetTeamRequest): Promise<GetTeamResponse> {
        const { teamId } = req;

        if (!teamId || !validate(teamId)) {
            throw new ConnectError("Invalid argument: teamId", Code.InvalidArgument);
        }

        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ConnectError(`Team (ID: ${teamId}) does not exist`, Code.NotFound);
        }

        const members = await this.teamDB.findMembersByTeam(teamId);
        let invite = await this.teamDB.findGenericInviteByTeamId(teamId);
        if (!invite) {
            invite = await this.teamDB.resetGenericInvite(teamId);
        }

        return new GetTeamResponse({
            team: toAPITeam(team, members, invite),
        });
    }
    public async listTeams(req: ListTeamsRequest): Promise<ListTeamsResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async deleteTeam(req: DeleteTeamRequest): Promise<DeleteTeamResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async joinTeam(req: JoinTeamRequest): Promise<JoinTeamResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async resetTeamInvitation(req: ResetTeamInvitationRequest): Promise<ResetTeamInvitationResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async updateTeamMember(req: UpdateTeamMemberRequest): Promise<UpdateTeamMemberResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async deleteTeamMember(req: DeleteTeamMemberRequest): Promise<DeleteTeamMemberResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async getTeamInvitation(req: GetTeamInvitationRequest): Promise<GetTeamInvitationResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async listTeamMembers(req: ListTeamMembersRequest): Promise<ListTeamMembersResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
}

export function toAPITeam(team: Organization, members: OrgMemberInfo[], invite: TeamMembershipInvite): Team {
    return new Team({
        id: team.id,
        name: team.name,
        slug: team.slug,
        teamInvitation: new TeamInvitation({
            id: invite.id,
        }),
        members: members.map(memberToAPI),
    });
}

export function memberToAPI(member: OrgMemberInfo): TeamMember {
    return new TeamMember({
        avatarUrl: member.avatarUrl,
        fullName: member.fullName,
        memberSince: Timestamp.fromDate(new Date(member.memberSince)),
        primaryEmail: member.primaryEmail,
        role: member.role === "owner" ? TeamRole.OWNER : TeamRole.MEMBER,
        userId: member.userId,
        ownedByOrganization: !!member.ownedByOrganization,
    });
}
