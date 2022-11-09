/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v0.1.1 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/teams.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import type {BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage} from "@bufbuild/protobuf";
import {Message, proto3, Timestamp} from "@bufbuild/protobuf";

/**
 * @generated from enum gitpod.experimental.v1.TeamRole
 */
export enum TeamRole {
  /**
   * TEAM_ROLE_UNKNOWN is the unkwnon state.
   *
   * @generated from enum value: TEAM_ROLE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * TEAM_ROLE_OWNER is the owner of the team.
   * A team can have multiple owners, but there must always be at least one owner.
   *
   * @generated from enum value: TEAM_ROLE_OWNER = 1;
   */
  OWNER = 1,

  /**
   * TEAM_ROLE_MEMBER is a regular member of a team.
   *
   * @generated from enum value: TEAM_ROLE_MEMBER = 2;
   */
  MEMBER = 2,
}
// Retrieve enum metadata with: proto3.getEnumType(TeamRole)
proto3.util.setEnumType(TeamRole, "gitpod.experimental.v1.TeamRole", [
  { no: 0, name: "TEAM_ROLE_UNSPECIFIED" },
  { no: 1, name: "TEAM_ROLE_OWNER" },
  { no: 2, name: "TEAM_ROLE_MEMBER" },
]);

/**
 * @generated from message gitpod.experimental.v1.Team
 */
export class Team extends Message<Team> {
  /**
   * id is a UUID of the Team
   *
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * name is the name of the Team
   *
   * @generated from field: string name = 2;
   */
  name = "";

  /**
   * slug is the short version of the Team name
   *
   * @generated from field: string slug = 3;
   */
  slug = "";

  /**
   * members are the team members of this Team
   *
   * @generated from field: repeated gitpod.experimental.v1.TeamMember members = 4;
   */
  members: TeamMember[] = [];

  /**
   * team_invitation is the team invitation.
   *
   * @generated from field: gitpod.experimental.v1.TeamInvitation team_invitation = 5;
   */
  teamInvitation?: TeamInvitation;

  constructor(data?: PartialMessage<Team>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.Team";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "slug", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 4, name: "members", kind: "message", T: TeamMember, repeated: true },
    { no: 5, name: "team_invitation", kind: "message", T: TeamInvitation },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Team {
    return new Team().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Team {
    return new Team().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Team {
    return new Team().fromJsonString(jsonString, options);
  }

  static equals(a: Team | PlainMessage<Team> | undefined, b: Team | PlainMessage<Team> | undefined): boolean {
    return proto3.util.equals(Team, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.TeamMember
 */
export class TeamMember extends Message<TeamMember> {
  /**
   * user_id is the identifier of the user
   *
   * @generated from field: string user_id = 1;
   */
  userId = "";

  /**
   * role is the role this member is assigned
   *
   * @generated from field: gitpod.experimental.v1.TeamRole role = 2;
   */
  role = TeamRole.UNSPECIFIED;

  /**
   * member_since is the timestamp when the member joined the team
   *
   * @generated from field: google.protobuf.Timestamp member_since = 3;
   */
  memberSince?: Timestamp;

  /**
   * avatar_url is the URL for the TeamMember
   *
   * @generated from field: string avatar_url = 4;
   */
  avatarUrl = "";

  /**
   * full_name is the name of the TeamMember
   *
   * @generated from field: string full_name = 5;
   */
  fullName = "";

  /**
   * primary_email is the primary email of the TeamMember
   *
   * @generated from field: string primary_email = 6;
   */
  primaryEmail = "";

  constructor(data?: PartialMessage<TeamMember>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.TeamMember";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "user_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "role", kind: "enum", T: proto3.getEnumType(TeamRole) },
    { no: 3, name: "member_since", kind: "message", T: Timestamp },
    { no: 4, name: "avatar_url", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 5, name: "full_name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 6, name: "primary_email", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): TeamMember {
    return new TeamMember().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): TeamMember {
    return new TeamMember().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): TeamMember {
    return new TeamMember().fromJsonString(jsonString, options);
  }

  static equals(a: TeamMember | PlainMessage<TeamMember> | undefined, b: TeamMember | PlainMessage<TeamMember> | undefined): boolean {
    return proto3.util.equals(TeamMember, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.TeamInvitation
 */
export class TeamInvitation extends Message<TeamInvitation> {
  /**
   * id is the invitation ID.
   *
   * @generated from field: string id = 1;
   */
  id = "";

  constructor(data?: PartialMessage<TeamInvitation>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.TeamInvitation";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): TeamInvitation {
    return new TeamInvitation().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): TeamInvitation {
    return new TeamInvitation().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): TeamInvitation {
    return new TeamInvitation().fromJsonString(jsonString, options);
  }

  static equals(a: TeamInvitation | PlainMessage<TeamInvitation> | undefined, b: TeamInvitation | PlainMessage<TeamInvitation> | undefined): boolean {
    return proto3.util.equals(TeamInvitation, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreateTeamRequest
 */
export class CreateTeamRequest extends Message<CreateTeamRequest> {
  /**
   * name is the team name
   *
   * @generated from field: string name = 1;
   */
  name = "";

  constructor(data?: PartialMessage<CreateTeamRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreateTeamRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateTeamRequest {
    return new CreateTeamRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateTeamRequest {
    return new CreateTeamRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateTeamRequest {
    return new CreateTeamRequest().fromJsonString(jsonString, options);
  }

  static equals(a: CreateTeamRequest | PlainMessage<CreateTeamRequest> | undefined, b: CreateTeamRequest | PlainMessage<CreateTeamRequest> | undefined): boolean {
    return proto3.util.equals(CreateTeamRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreateTeamResponse
 */
export class CreateTeamResponse extends Message<CreateTeamResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.Team team = 1;
   */
  team?: Team;

  constructor(data?: PartialMessage<CreateTeamResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreateTeamResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team", kind: "message", T: Team },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateTeamResponse {
    return new CreateTeamResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateTeamResponse {
    return new CreateTeamResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateTeamResponse {
    return new CreateTeamResponse().fromJsonString(jsonString, options);
  }

  static equals(a: CreateTeamResponse | PlainMessage<CreateTeamResponse> | undefined, b: CreateTeamResponse | PlainMessage<CreateTeamResponse> | undefined): boolean {
    return proto3.util.equals(CreateTeamResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetTeamRequest
 */
export class GetTeamRequest extends Message<GetTeamRequest> {
  /**
   * team_id is the unique identifier of the Team to retreive.
   *
   * @generated from field: string team_id = 1;
   */
  teamId = "";

  constructor(data?: PartialMessage<GetTeamRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetTeamRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetTeamRequest {
    return new GetTeamRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetTeamRequest {
    return new GetTeamRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetTeamRequest {
    return new GetTeamRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetTeamRequest | PlainMessage<GetTeamRequest> | undefined, b: GetTeamRequest | PlainMessage<GetTeamRequest> | undefined): boolean {
    return proto3.util.equals(GetTeamRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetTeamResponse
 */
export class GetTeamResponse extends Message<GetTeamResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.Team team = 1;
   */
  team?: Team;

  constructor(data?: PartialMessage<GetTeamResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetTeamResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team", kind: "message", T: Team },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetTeamResponse {
    return new GetTeamResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetTeamResponse {
    return new GetTeamResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetTeamResponse {
    return new GetTeamResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetTeamResponse | PlainMessage<GetTeamResponse> | undefined, b: GetTeamResponse | PlainMessage<GetTeamResponse> | undefined): boolean {
    return proto3.util.equals(GetTeamResponse, a, b);
  }
}

/**
 * TODO: pagination options
 *
 * @generated from message gitpod.experimental.v1.ListTeamsRequest
 */
export class ListTeamsRequest extends Message<ListTeamsRequest> {
  constructor(data?: PartialMessage<ListTeamsRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListTeamsRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListTeamsRequest {
    return new ListTeamsRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListTeamsRequest {
    return new ListTeamsRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListTeamsRequest {
    return new ListTeamsRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListTeamsRequest | PlainMessage<ListTeamsRequest> | undefined, b: ListTeamsRequest | PlainMessage<ListTeamsRequest> | undefined): boolean {
    return proto3.util.equals(ListTeamsRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ListTeamsResponse
 */
export class ListTeamsResponse extends Message<ListTeamsResponse> {
  /**
   * @generated from field: repeated gitpod.experimental.v1.Team teams = 1;
   */
  teams: Team[] = [];

  constructor(data?: PartialMessage<ListTeamsResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListTeamsResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "teams", kind: "message", T: Team, repeated: true },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListTeamsResponse {
    return new ListTeamsResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListTeamsResponse {
    return new ListTeamsResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListTeamsResponse {
    return new ListTeamsResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListTeamsResponse | PlainMessage<ListTeamsResponse> | undefined, b: ListTeamsResponse | PlainMessage<ListTeamsResponse> | undefined): boolean {
    return proto3.util.equals(ListTeamsResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteTeamRequest
 */
export class DeleteTeamRequest extends Message<DeleteTeamRequest> {
  /**
   * team_id is the ID of the team to delete
   *
   * @generated from field: string team_id = 1;
   */
  teamId = "";

  constructor(data?: PartialMessage<DeleteTeamRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteTeamRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteTeamRequest {
    return new DeleteTeamRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteTeamRequest {
    return new DeleteTeamRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteTeamRequest {
    return new DeleteTeamRequest().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteTeamRequest | PlainMessage<DeleteTeamRequest> | undefined, b: DeleteTeamRequest | PlainMessage<DeleteTeamRequest> | undefined): boolean {
    return proto3.util.equals(DeleteTeamRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteTeamResponse
 */
export class DeleteTeamResponse extends Message<DeleteTeamResponse> {
  constructor(data?: PartialMessage<DeleteTeamResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteTeamResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteTeamResponse {
    return new DeleteTeamResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteTeamResponse {
    return new DeleteTeamResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteTeamResponse {
    return new DeleteTeamResponse().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteTeamResponse | PlainMessage<DeleteTeamResponse> | undefined, b: DeleteTeamResponse | PlainMessage<DeleteTeamResponse> | undefined): boolean {
    return proto3.util.equals(DeleteTeamResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.JoinTeamRequest
 */
export class JoinTeamRequest extends Message<JoinTeamRequest> {
  /**
   * invitation_id is the invitation ID for a Team
   *
   * @generated from field: string invitation_id = 1;
   */
  invitationId = "";

  constructor(data?: PartialMessage<JoinTeamRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.JoinTeamRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "invitation_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): JoinTeamRequest {
    return new JoinTeamRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): JoinTeamRequest {
    return new JoinTeamRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): JoinTeamRequest {
    return new JoinTeamRequest().fromJsonString(jsonString, options);
  }

  static equals(a: JoinTeamRequest | PlainMessage<JoinTeamRequest> | undefined, b: JoinTeamRequest | PlainMessage<JoinTeamRequest> | undefined): boolean {
    return proto3.util.equals(JoinTeamRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.JoinTeamResponse
 */
export class JoinTeamResponse extends Message<JoinTeamResponse> {
  /**
   * team is the team the user has just joined
   *
   * @generated from field: gitpod.experimental.v1.Team team = 1;
   */
  team?: Team;

  constructor(data?: PartialMessage<JoinTeamResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.JoinTeamResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team", kind: "message", T: Team },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): JoinTeamResponse {
    return new JoinTeamResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): JoinTeamResponse {
    return new JoinTeamResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): JoinTeamResponse {
    return new JoinTeamResponse().fromJsonString(jsonString, options);
  }

  static equals(a: JoinTeamResponse | PlainMessage<JoinTeamResponse> | undefined, b: JoinTeamResponse | PlainMessage<JoinTeamResponse> | undefined): boolean {
    return proto3.util.equals(JoinTeamResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ResetTeamInvitationRequest
 */
export class ResetTeamInvitationRequest extends Message<ResetTeamInvitationRequest> {
  /**
   * @generated from field: string team_id = 1;
   */
  teamId = "";

  constructor(data?: PartialMessage<ResetTeamInvitationRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ResetTeamInvitationRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ResetTeamInvitationRequest {
    return new ResetTeamInvitationRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ResetTeamInvitationRequest {
    return new ResetTeamInvitationRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ResetTeamInvitationRequest {
    return new ResetTeamInvitationRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ResetTeamInvitationRequest | PlainMessage<ResetTeamInvitationRequest> | undefined, b: ResetTeamInvitationRequest | PlainMessage<ResetTeamInvitationRequest> | undefined): boolean {
    return proto3.util.equals(ResetTeamInvitationRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ResetTeamInvitationResponse
 */
export class ResetTeamInvitationResponse extends Message<ResetTeamInvitationResponse> {
  /**
   * team_invitation is the new invitation for the team.
   *
   * @generated from field: gitpod.experimental.v1.TeamInvitation team_invitation = 1;
   */
  teamInvitation?: TeamInvitation;

  constructor(data?: PartialMessage<ResetTeamInvitationResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ResetTeamInvitationResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team_invitation", kind: "message", T: TeamInvitation },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ResetTeamInvitationResponse {
    return new ResetTeamInvitationResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ResetTeamInvitationResponse {
    return new ResetTeamInvitationResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ResetTeamInvitationResponse {
    return new ResetTeamInvitationResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ResetTeamInvitationResponse | PlainMessage<ResetTeamInvitationResponse> | undefined, b: ResetTeamInvitationResponse | PlainMessage<ResetTeamInvitationResponse> | undefined): boolean {
    return proto3.util.equals(ResetTeamInvitationResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.UpdateTeamMemberRequest
 */
export class UpdateTeamMemberRequest extends Message<UpdateTeamMemberRequest> {
  /**
   * team_id is the ID of the team in which the role is to be updated
   *
   * @generated from field: string team_id = 1;
   */
  teamId = "";

  /**
   * team_member is the team member being updated.
   *
   * @generated from field: gitpod.experimental.v1.TeamMember team_member = 2;
   */
  teamMember?: TeamMember;

  constructor(data?: PartialMessage<UpdateTeamMemberRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.UpdateTeamMemberRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "team_member", kind: "message", T: TeamMember },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateTeamMemberRequest {
    return new UpdateTeamMemberRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateTeamMemberRequest {
    return new UpdateTeamMemberRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateTeamMemberRequest {
    return new UpdateTeamMemberRequest().fromJsonString(jsonString, options);
  }

  static equals(a: UpdateTeamMemberRequest | PlainMessage<UpdateTeamMemberRequest> | undefined, b: UpdateTeamMemberRequest | PlainMessage<UpdateTeamMemberRequest> | undefined): boolean {
    return proto3.util.equals(UpdateTeamMemberRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.UpdateTeamMemberResponse
 */
export class UpdateTeamMemberResponse extends Message<UpdateTeamMemberResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.TeamMember team_member = 2;
   */
  teamMember?: TeamMember;

  constructor(data?: PartialMessage<UpdateTeamMemberResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.UpdateTeamMemberResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 2, name: "team_member", kind: "message", T: TeamMember },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateTeamMemberResponse {
    return new UpdateTeamMemberResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateTeamMemberResponse {
    return new UpdateTeamMemberResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateTeamMemberResponse {
    return new UpdateTeamMemberResponse().fromJsonString(jsonString, options);
  }

  static equals(a: UpdateTeamMemberResponse | PlainMessage<UpdateTeamMemberResponse> | undefined, b: UpdateTeamMemberResponse | PlainMessage<UpdateTeamMemberResponse> | undefined): boolean {
    return proto3.util.equals(UpdateTeamMemberResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteTeamMemberRequest
 */
export class DeleteTeamMemberRequest extends Message<DeleteTeamMemberRequest> {
  /**
   * team_id is the ID of the team in which a member should be deleted.
   *
   * @generated from field: string team_id = 1;
   */
  teamId = "";

  /**
   * team_member_id is the ID of the TeamMember that should be deleted from the team.
   *
   * @generated from field: string team_member_id = 2;
   */
  teamMemberId = "";

  constructor(data?: PartialMessage<DeleteTeamMemberRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteTeamMemberRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "team_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "team_member_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteTeamMemberRequest {
    return new DeleteTeamMemberRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteTeamMemberRequest {
    return new DeleteTeamMemberRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteTeamMemberRequest {
    return new DeleteTeamMemberRequest().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteTeamMemberRequest | PlainMessage<DeleteTeamMemberRequest> | undefined, b: DeleteTeamMemberRequest | PlainMessage<DeleteTeamMemberRequest> | undefined): boolean {
    return proto3.util.equals(DeleteTeamMemberRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteTeamMemberResponse
 */
export class DeleteTeamMemberResponse extends Message<DeleteTeamMemberResponse> {
  constructor(data?: PartialMessage<DeleteTeamMemberResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteTeamMemberResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteTeamMemberResponse {
    return new DeleteTeamMemberResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteTeamMemberResponse {
    return new DeleteTeamMemberResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteTeamMemberResponse {
    return new DeleteTeamMemberResponse().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteTeamMemberResponse | PlainMessage<DeleteTeamMemberResponse> | undefined, b: DeleteTeamMemberResponse | PlainMessage<DeleteTeamMemberResponse> | undefined): boolean {
    return proto3.util.equals(DeleteTeamMemberResponse, a, b);
  }
}
