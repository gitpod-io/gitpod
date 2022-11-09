/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-web v0.2.1 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/teams.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import {CreateTeamRequest, CreateTeamResponse, DeleteTeamMemberRequest, DeleteTeamMemberResponse, DeleteTeamRequest, DeleteTeamResponse, GetTeamRequest, GetTeamResponse, JoinTeamRequest, JoinTeamResponse, ListTeamsRequest, ListTeamsResponse, ResetTeamInvitationRequest, ResetTeamInvitationResponse, UpdateTeamMemberRequest, UpdateTeamMemberResponse} from "./teams_pb.js";
import {MethodKind} from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.experimental.v1.TeamsService
 */
export const TeamsService = {
  typeName: "gitpod.experimental.v1.TeamsService",
  methods: {
    /**
     * CreateTeam creates a new Team.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.CreateTeam
     */
    createTeam: {
      name: "CreateTeam",
      I: CreateTeamRequest,
      O: CreateTeamResponse,
      kind: MethodKind.Unary,
    },
    /**
     * GetTeam retrieves a single Team.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.GetTeam
     */
    getTeam: {
      name: "GetTeam",
      I: GetTeamRequest,
      O: GetTeamResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ListTeams lists the caller has access to.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.ListTeams
     */
    listTeams: {
      name: "ListTeams",
      I: ListTeamsRequest,
      O: ListTeamsResponse,
      kind: MethodKind.Unary,
    },
    /**
     * DeleteTeam deletes the specified team.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.DeleteTeam
     */
    deleteTeam: {
      name: "DeleteTeam",
      I: DeleteTeamRequest,
      O: DeleteTeamResponse,
      kind: MethodKind.Unary,
    },
    /**
     * JoinTeam makes the caller a TeamMember of the Team.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.JoinTeam
     */
    joinTeam: {
      name: "JoinTeam",
      I: JoinTeamRequest,
      O: JoinTeamResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ResetTeamInvitation resets the invitation_id for a Team.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.ResetTeamInvitation
     */
    resetTeamInvitation: {
      name: "ResetTeamInvitation",
      I: ResetTeamInvitationRequest,
      O: ResetTeamInvitationResponse,
      kind: MethodKind.Unary,
    },
    /**
     * UpdateTeamMember updates team membership properties.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.UpdateTeamMember
     */
    updateTeamMember: {
      name: "UpdateTeamMember",
      I: UpdateTeamMemberRequest,
      O: UpdateTeamMemberResponse,
      kind: MethodKind.Unary,
    },
    /**
     * DeleteTeamMember removes a TeamMember from the Team.
     *
     * @generated from rpc gitpod.experimental.v1.TeamsService.DeleteTeamMember
     */
    deleteTeamMember: {
      name: "DeleteTeamMember",
      I: DeleteTeamMemberRequest,
      O: DeleteTeamMemberResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;
