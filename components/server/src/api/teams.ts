/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, ServiceImpl } from "@bufbuild/connect";
import { injectable } from "inversify";
import { TeamsService as TeamServiceInterface } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import {
    CreateTeamRequest,
    CreateTeamResponse,
    DeleteTeamMemberRequest,
    DeleteTeamMemberResponse,
    DeleteTeamRequest,
    DeleteTeamResponse,
    GetTeamRequest,
    GetTeamResponse,
    JoinTeamRequest,
    JoinTeamResponse,
    ListTeamsRequest,
    ListTeamsResponse,
    ResetTeamInvitationRequest,
    ResetTeamInvitationResponse,
    UpdateTeamMemberRequest,
    UpdateTeamMemberResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";

@injectable()
export class APITeamService implements ServiceImpl<typeof TeamServiceInterface> {
    public async createTeam(req: CreateTeamRequest): Promise<CreateTeamResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    public async getTeam(req: GetTeamRequest): Promise<GetTeamResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
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
}
