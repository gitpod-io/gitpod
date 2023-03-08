/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "../../../google/protobuf/timestamp_nicegrpc";

export const protobufPackage = "gitpod.experimental.v1";

export enum TeamRole {
  /** TEAM_ROLE_UNSPECIFIED - TEAM_ROLE_UNKNOWN is the unkwnon state. */
  TEAM_ROLE_UNSPECIFIED = 0,
  /**
   * TEAM_ROLE_OWNER - TEAM_ROLE_OWNER is the owner of the team.
   * A team can have multiple owners, but there must always be at least one owner.
   */
  TEAM_ROLE_OWNER = 1,
  /** TEAM_ROLE_MEMBER - TEAM_ROLE_MEMBER is a regular member of a team. */
  TEAM_ROLE_MEMBER = 2,
  UNRECOGNIZED = -1,
}

export function teamRoleFromJSON(object: any): TeamRole {
  switch (object) {
    case 0:
    case "TEAM_ROLE_UNSPECIFIED":
      return TeamRole.TEAM_ROLE_UNSPECIFIED;
    case 1:
    case "TEAM_ROLE_OWNER":
      return TeamRole.TEAM_ROLE_OWNER;
    case 2:
    case "TEAM_ROLE_MEMBER":
      return TeamRole.TEAM_ROLE_MEMBER;
    case -1:
    case "UNRECOGNIZED":
    default:
      return TeamRole.UNRECOGNIZED;
  }
}

export function teamRoleToJSON(object: TeamRole): string {
  switch (object) {
    case TeamRole.TEAM_ROLE_UNSPECIFIED:
      return "TEAM_ROLE_UNSPECIFIED";
    case TeamRole.TEAM_ROLE_OWNER:
      return "TEAM_ROLE_OWNER";
    case TeamRole.TEAM_ROLE_MEMBER:
      return "TEAM_ROLE_MEMBER";
    case TeamRole.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface Team {
  /** id is a UUID of the Team */
  id: string;
  /** name is the name of the Team */
  name: string;
  /** members are the team members of this Team */
  members: TeamMember[];
  /** team_invitation is the team invitation. */
  teamInvitation: TeamInvitation | undefined;
}

export interface TeamMember {
  /** user_id is the identifier of the user */
  userId: string;
  /** role is the role this member is assigned */
  role: TeamRole;
  /** member_since is the timestamp when the member joined the team */
  memberSince:
    | Date
    | undefined;
  /** avatar_url is the URL for the TeamMember */
  avatarUrl: string;
  /** full_name is the name of the TeamMember */
  fullName: string;
  /** primary_email is the primary email of the TeamMember */
  primaryEmail: string;
}

export interface TeamInvitation {
  /** id is the invitation ID. */
  id: string;
}

export interface CreateTeamRequest {
  /** name is the team name */
  name: string;
}

export interface CreateTeamResponse {
  team: Team | undefined;
}

export interface GetTeamRequest {
  /** team_id is the unique identifier of the Team to retreive. */
  teamId: string;
}

export interface GetTeamResponse {
  team: Team | undefined;
}

/** TODO: pagination options */
export interface ListTeamsRequest {
}

export interface ListTeamsResponse {
  teams: Team[];
}

export interface DeleteTeamRequest {
  /** team_id is the ID of the team to delete */
  teamId: string;
}

export interface DeleteTeamResponse {
}

export interface JoinTeamRequest {
  /** invitation_id is the invitation ID for a Team */
  invitationId: string;
}

export interface JoinTeamResponse {
  /** team is the team the user has just joined */
  team: Team | undefined;
}

export interface ResetTeamInvitationRequest {
  teamId: string;
}

export interface ResetTeamInvitationResponse {
  /** team_invitation is the new invitation for the team. */
  teamInvitation: TeamInvitation | undefined;
}

export interface UpdateTeamMemberRequest {
  /** team_id is the ID of the team in which the role is to be updated */
  teamId: string;
  /** team_member is the team member being updated. */
  teamMember: TeamMember | undefined;
}

export interface UpdateTeamMemberResponse {
  teamMember: TeamMember | undefined;
}

export interface DeleteTeamMemberRequest {
  /** team_id is the ID of the team in which a member should be deleted. */
  teamId: string;
  /** team_member_id is the ID of the TeamMember that should be deleted from the team. */
  teamMemberId: string;
}

export interface DeleteTeamMemberResponse {
}

function createBaseTeam(): Team {
  return { id: "", name: "", members: [], teamInvitation: undefined };
}

export const Team = {
  encode(message: Team, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.name !== "") {
      writer.uint32(18).string(message.name);
    }
    for (const v of message.members) {
      TeamMember.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    if (message.teamInvitation !== undefined) {
      TeamInvitation.encode(message.teamInvitation, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Team {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTeam();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.name = reader.string();
          break;
        case 4:
          message.members.push(TeamMember.decode(reader, reader.uint32()));
          break;
        case 5:
          message.teamInvitation = TeamInvitation.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Team {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      name: isSet(object.name) ? String(object.name) : "",
      members: Array.isArray(object?.members) ? object.members.map((e: any) => TeamMember.fromJSON(e)) : [],
      teamInvitation: isSet(object.teamInvitation) ? TeamInvitation.fromJSON(object.teamInvitation) : undefined,
    };
  },

  toJSON(message: Team): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.name !== undefined && (obj.name = message.name);
    if (message.members) {
      obj.members = message.members.map((e) => e ? TeamMember.toJSON(e) : undefined);
    } else {
      obj.members = [];
    }
    message.teamInvitation !== undefined &&
      (obj.teamInvitation = message.teamInvitation ? TeamInvitation.toJSON(message.teamInvitation) : undefined);
    return obj;
  },

  create(base?: DeepPartial<Team>): Team {
    return Team.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Team>): Team {
    const message = createBaseTeam();
    message.id = object.id ?? "";
    message.name = object.name ?? "";
    message.members = object.members?.map((e) => TeamMember.fromPartial(e)) || [];
    message.teamInvitation = (object.teamInvitation !== undefined && object.teamInvitation !== null)
      ? TeamInvitation.fromPartial(object.teamInvitation)
      : undefined;
    return message;
  },
};

function createBaseTeamMember(): TeamMember {
  return { userId: "", role: 0, memberSince: undefined, avatarUrl: "", fullName: "", primaryEmail: "" };
}

export const TeamMember = {
  encode(message: TeamMember, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userId !== "") {
      writer.uint32(10).string(message.userId);
    }
    if (message.role !== 0) {
      writer.uint32(16).int32(message.role);
    }
    if (message.memberSince !== undefined) {
      Timestamp.encode(toTimestamp(message.memberSince), writer.uint32(26).fork()).ldelim();
    }
    if (message.avatarUrl !== "") {
      writer.uint32(34).string(message.avatarUrl);
    }
    if (message.fullName !== "") {
      writer.uint32(42).string(message.fullName);
    }
    if (message.primaryEmail !== "") {
      writer.uint32(50).string(message.primaryEmail);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TeamMember {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTeamMember();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.userId = reader.string();
          break;
        case 2:
          message.role = reader.int32() as any;
          break;
        case 3:
          message.memberSince = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 4:
          message.avatarUrl = reader.string();
          break;
        case 5:
          message.fullName = reader.string();
          break;
        case 6:
          message.primaryEmail = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TeamMember {
    return {
      userId: isSet(object.userId) ? String(object.userId) : "",
      role: isSet(object.role) ? teamRoleFromJSON(object.role) : 0,
      memberSince: isSet(object.memberSince) ? fromJsonTimestamp(object.memberSince) : undefined,
      avatarUrl: isSet(object.avatarUrl) ? String(object.avatarUrl) : "",
      fullName: isSet(object.fullName) ? String(object.fullName) : "",
      primaryEmail: isSet(object.primaryEmail) ? String(object.primaryEmail) : "",
    };
  },

  toJSON(message: TeamMember): unknown {
    const obj: any = {};
    message.userId !== undefined && (obj.userId = message.userId);
    message.role !== undefined && (obj.role = teamRoleToJSON(message.role));
    message.memberSince !== undefined && (obj.memberSince = message.memberSince.toISOString());
    message.avatarUrl !== undefined && (obj.avatarUrl = message.avatarUrl);
    message.fullName !== undefined && (obj.fullName = message.fullName);
    message.primaryEmail !== undefined && (obj.primaryEmail = message.primaryEmail);
    return obj;
  },

  create(base?: DeepPartial<TeamMember>): TeamMember {
    return TeamMember.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<TeamMember>): TeamMember {
    const message = createBaseTeamMember();
    message.userId = object.userId ?? "";
    message.role = object.role ?? 0;
    message.memberSince = object.memberSince ?? undefined;
    message.avatarUrl = object.avatarUrl ?? "";
    message.fullName = object.fullName ?? "";
    message.primaryEmail = object.primaryEmail ?? "";
    return message;
  },
};

function createBaseTeamInvitation(): TeamInvitation {
  return { id: "" };
}

export const TeamInvitation = {
  encode(message: TeamInvitation, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TeamInvitation {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTeamInvitation();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TeamInvitation {
    return { id: isSet(object.id) ? String(object.id) : "" };
  },

  toJSON(message: TeamInvitation): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    return obj;
  },

  create(base?: DeepPartial<TeamInvitation>): TeamInvitation {
    return TeamInvitation.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<TeamInvitation>): TeamInvitation {
    const message = createBaseTeamInvitation();
    message.id = object.id ?? "";
    return message;
  },
};

function createBaseCreateTeamRequest(): CreateTeamRequest {
  return { name: "" };
}

export const CreateTeamRequest = {
  encode(message: CreateTeamRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateTeamRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateTeamRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateTeamRequest {
    return { name: isSet(object.name) ? String(object.name) : "" };
  },

  toJSON(message: CreateTeamRequest): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    return obj;
  },

  create(base?: DeepPartial<CreateTeamRequest>): CreateTeamRequest {
    return CreateTeamRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateTeamRequest>): CreateTeamRequest {
    const message = createBaseCreateTeamRequest();
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseCreateTeamResponse(): CreateTeamResponse {
  return { team: undefined };
}

export const CreateTeamResponse = {
  encode(message: CreateTeamResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.team !== undefined) {
      Team.encode(message.team, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateTeamResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateTeamResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.team = Team.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateTeamResponse {
    return { team: isSet(object.team) ? Team.fromJSON(object.team) : undefined };
  },

  toJSON(message: CreateTeamResponse): unknown {
    const obj: any = {};
    message.team !== undefined && (obj.team = message.team ? Team.toJSON(message.team) : undefined);
    return obj;
  },

  create(base?: DeepPartial<CreateTeamResponse>): CreateTeamResponse {
    return CreateTeamResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateTeamResponse>): CreateTeamResponse {
    const message = createBaseCreateTeamResponse();
    message.team = (object.team !== undefined && object.team !== null) ? Team.fromPartial(object.team) : undefined;
    return message;
  },
};

function createBaseGetTeamRequest(): GetTeamRequest {
  return { teamId: "" };
}

export const GetTeamRequest = {
  encode(message: GetTeamRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamId !== "") {
      writer.uint32(10).string(message.teamId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetTeamRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetTeamRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teamId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetTeamRequest {
    return { teamId: isSet(object.teamId) ? String(object.teamId) : "" };
  },

  toJSON(message: GetTeamRequest): unknown {
    const obj: any = {};
    message.teamId !== undefined && (obj.teamId = message.teamId);
    return obj;
  },

  create(base?: DeepPartial<GetTeamRequest>): GetTeamRequest {
    return GetTeamRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetTeamRequest>): GetTeamRequest {
    const message = createBaseGetTeamRequest();
    message.teamId = object.teamId ?? "";
    return message;
  },
};

function createBaseGetTeamResponse(): GetTeamResponse {
  return { team: undefined };
}

export const GetTeamResponse = {
  encode(message: GetTeamResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.team !== undefined) {
      Team.encode(message.team, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetTeamResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetTeamResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.team = Team.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetTeamResponse {
    return { team: isSet(object.team) ? Team.fromJSON(object.team) : undefined };
  },

  toJSON(message: GetTeamResponse): unknown {
    const obj: any = {};
    message.team !== undefined && (obj.team = message.team ? Team.toJSON(message.team) : undefined);
    return obj;
  },

  create(base?: DeepPartial<GetTeamResponse>): GetTeamResponse {
    return GetTeamResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetTeamResponse>): GetTeamResponse {
    const message = createBaseGetTeamResponse();
    message.team = (object.team !== undefined && object.team !== null) ? Team.fromPartial(object.team) : undefined;
    return message;
  },
};

function createBaseListTeamsRequest(): ListTeamsRequest {
  return {};
}

export const ListTeamsRequest = {
  encode(_: ListTeamsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListTeamsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListTeamsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(_: any): ListTeamsRequest {
    return {};
  },

  toJSON(_: ListTeamsRequest): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<ListTeamsRequest>): ListTeamsRequest {
    return ListTeamsRequest.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<ListTeamsRequest>): ListTeamsRequest {
    const message = createBaseListTeamsRequest();
    return message;
  },
};

function createBaseListTeamsResponse(): ListTeamsResponse {
  return { teams: [] };
}

export const ListTeamsResponse = {
  encode(message: ListTeamsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.teams) {
      Team.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListTeamsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListTeamsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teams.push(Team.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListTeamsResponse {
    return { teams: Array.isArray(object?.teams) ? object.teams.map((e: any) => Team.fromJSON(e)) : [] };
  },

  toJSON(message: ListTeamsResponse): unknown {
    const obj: any = {};
    if (message.teams) {
      obj.teams = message.teams.map((e) => e ? Team.toJSON(e) : undefined);
    } else {
      obj.teams = [];
    }
    return obj;
  },

  create(base?: DeepPartial<ListTeamsResponse>): ListTeamsResponse {
    return ListTeamsResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListTeamsResponse>): ListTeamsResponse {
    const message = createBaseListTeamsResponse();
    message.teams = object.teams?.map((e) => Team.fromPartial(e)) || [];
    return message;
  },
};

function createBaseDeleteTeamRequest(): DeleteTeamRequest {
  return { teamId: "" };
}

export const DeleteTeamRequest = {
  encode(message: DeleteTeamRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamId !== "") {
      writer.uint32(10).string(message.teamId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteTeamRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteTeamRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teamId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeleteTeamRequest {
    return { teamId: isSet(object.teamId) ? String(object.teamId) : "" };
  },

  toJSON(message: DeleteTeamRequest): unknown {
    const obj: any = {};
    message.teamId !== undefined && (obj.teamId = message.teamId);
    return obj;
  },

  create(base?: DeepPartial<DeleteTeamRequest>): DeleteTeamRequest {
    return DeleteTeamRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeleteTeamRequest>): DeleteTeamRequest {
    const message = createBaseDeleteTeamRequest();
    message.teamId = object.teamId ?? "";
    return message;
  },
};

function createBaseDeleteTeamResponse(): DeleteTeamResponse {
  return {};
}

export const DeleteTeamResponse = {
  encode(_: DeleteTeamResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteTeamResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteTeamResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(_: any): DeleteTeamResponse {
    return {};
  },

  toJSON(_: DeleteTeamResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<DeleteTeamResponse>): DeleteTeamResponse {
    return DeleteTeamResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeleteTeamResponse>): DeleteTeamResponse {
    const message = createBaseDeleteTeamResponse();
    return message;
  },
};

function createBaseJoinTeamRequest(): JoinTeamRequest {
  return { invitationId: "" };
}

export const JoinTeamRequest = {
  encode(message: JoinTeamRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.invitationId !== "") {
      writer.uint32(10).string(message.invitationId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): JoinTeamRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseJoinTeamRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.invitationId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): JoinTeamRequest {
    return { invitationId: isSet(object.invitationId) ? String(object.invitationId) : "" };
  },

  toJSON(message: JoinTeamRequest): unknown {
    const obj: any = {};
    message.invitationId !== undefined && (obj.invitationId = message.invitationId);
    return obj;
  },

  create(base?: DeepPartial<JoinTeamRequest>): JoinTeamRequest {
    return JoinTeamRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<JoinTeamRequest>): JoinTeamRequest {
    const message = createBaseJoinTeamRequest();
    message.invitationId = object.invitationId ?? "";
    return message;
  },
};

function createBaseJoinTeamResponse(): JoinTeamResponse {
  return { team: undefined };
}

export const JoinTeamResponse = {
  encode(message: JoinTeamResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.team !== undefined) {
      Team.encode(message.team, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): JoinTeamResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseJoinTeamResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.team = Team.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): JoinTeamResponse {
    return { team: isSet(object.team) ? Team.fromJSON(object.team) : undefined };
  },

  toJSON(message: JoinTeamResponse): unknown {
    const obj: any = {};
    message.team !== undefined && (obj.team = message.team ? Team.toJSON(message.team) : undefined);
    return obj;
  },

  create(base?: DeepPartial<JoinTeamResponse>): JoinTeamResponse {
    return JoinTeamResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<JoinTeamResponse>): JoinTeamResponse {
    const message = createBaseJoinTeamResponse();
    message.team = (object.team !== undefined && object.team !== null) ? Team.fromPartial(object.team) : undefined;
    return message;
  },
};

function createBaseResetTeamInvitationRequest(): ResetTeamInvitationRequest {
  return { teamId: "" };
}

export const ResetTeamInvitationRequest = {
  encode(message: ResetTeamInvitationRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamId !== "") {
      writer.uint32(10).string(message.teamId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResetTeamInvitationRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResetTeamInvitationRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teamId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ResetTeamInvitationRequest {
    return { teamId: isSet(object.teamId) ? String(object.teamId) : "" };
  },

  toJSON(message: ResetTeamInvitationRequest): unknown {
    const obj: any = {};
    message.teamId !== undefined && (obj.teamId = message.teamId);
    return obj;
  },

  create(base?: DeepPartial<ResetTeamInvitationRequest>): ResetTeamInvitationRequest {
    return ResetTeamInvitationRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ResetTeamInvitationRequest>): ResetTeamInvitationRequest {
    const message = createBaseResetTeamInvitationRequest();
    message.teamId = object.teamId ?? "";
    return message;
  },
};

function createBaseResetTeamInvitationResponse(): ResetTeamInvitationResponse {
  return { teamInvitation: undefined };
}

export const ResetTeamInvitationResponse = {
  encode(message: ResetTeamInvitationResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamInvitation !== undefined) {
      TeamInvitation.encode(message.teamInvitation, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResetTeamInvitationResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResetTeamInvitationResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teamInvitation = TeamInvitation.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ResetTeamInvitationResponse {
    return {
      teamInvitation: isSet(object.teamInvitation) ? TeamInvitation.fromJSON(object.teamInvitation) : undefined,
    };
  },

  toJSON(message: ResetTeamInvitationResponse): unknown {
    const obj: any = {};
    message.teamInvitation !== undefined &&
      (obj.teamInvitation = message.teamInvitation ? TeamInvitation.toJSON(message.teamInvitation) : undefined);
    return obj;
  },

  create(base?: DeepPartial<ResetTeamInvitationResponse>): ResetTeamInvitationResponse {
    return ResetTeamInvitationResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ResetTeamInvitationResponse>): ResetTeamInvitationResponse {
    const message = createBaseResetTeamInvitationResponse();
    message.teamInvitation = (object.teamInvitation !== undefined && object.teamInvitation !== null)
      ? TeamInvitation.fromPartial(object.teamInvitation)
      : undefined;
    return message;
  },
};

function createBaseUpdateTeamMemberRequest(): UpdateTeamMemberRequest {
  return { teamId: "", teamMember: undefined };
}

export const UpdateTeamMemberRequest = {
  encode(message: UpdateTeamMemberRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamId !== "") {
      writer.uint32(10).string(message.teamId);
    }
    if (message.teamMember !== undefined) {
      TeamMember.encode(message.teamMember, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateTeamMemberRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateTeamMemberRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teamId = reader.string();
          break;
        case 2:
          message.teamMember = TeamMember.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateTeamMemberRequest {
    return {
      teamId: isSet(object.teamId) ? String(object.teamId) : "",
      teamMember: isSet(object.teamMember) ? TeamMember.fromJSON(object.teamMember) : undefined,
    };
  },

  toJSON(message: UpdateTeamMemberRequest): unknown {
    const obj: any = {};
    message.teamId !== undefined && (obj.teamId = message.teamId);
    message.teamMember !== undefined &&
      (obj.teamMember = message.teamMember ? TeamMember.toJSON(message.teamMember) : undefined);
    return obj;
  },

  create(base?: DeepPartial<UpdateTeamMemberRequest>): UpdateTeamMemberRequest {
    return UpdateTeamMemberRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdateTeamMemberRequest>): UpdateTeamMemberRequest {
    const message = createBaseUpdateTeamMemberRequest();
    message.teamId = object.teamId ?? "";
    message.teamMember = (object.teamMember !== undefined && object.teamMember !== null)
      ? TeamMember.fromPartial(object.teamMember)
      : undefined;
    return message;
  },
};

function createBaseUpdateTeamMemberResponse(): UpdateTeamMemberResponse {
  return { teamMember: undefined };
}

export const UpdateTeamMemberResponse = {
  encode(message: UpdateTeamMemberResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamMember !== undefined) {
      TeamMember.encode(message.teamMember, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateTeamMemberResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateTeamMemberResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          message.teamMember = TeamMember.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateTeamMemberResponse {
    return { teamMember: isSet(object.teamMember) ? TeamMember.fromJSON(object.teamMember) : undefined };
  },

  toJSON(message: UpdateTeamMemberResponse): unknown {
    const obj: any = {};
    message.teamMember !== undefined &&
      (obj.teamMember = message.teamMember ? TeamMember.toJSON(message.teamMember) : undefined);
    return obj;
  },

  create(base?: DeepPartial<UpdateTeamMemberResponse>): UpdateTeamMemberResponse {
    return UpdateTeamMemberResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdateTeamMemberResponse>): UpdateTeamMemberResponse {
    const message = createBaseUpdateTeamMemberResponse();
    message.teamMember = (object.teamMember !== undefined && object.teamMember !== null)
      ? TeamMember.fromPartial(object.teamMember)
      : undefined;
    return message;
  },
};

function createBaseDeleteTeamMemberRequest(): DeleteTeamMemberRequest {
  return { teamId: "", teamMemberId: "" };
}

export const DeleteTeamMemberRequest = {
  encode(message: DeleteTeamMemberRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamId !== "") {
      writer.uint32(10).string(message.teamId);
    }
    if (message.teamMemberId !== "") {
      writer.uint32(18).string(message.teamMemberId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteTeamMemberRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteTeamMemberRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teamId = reader.string();
          break;
        case 2:
          message.teamMemberId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeleteTeamMemberRequest {
    return {
      teamId: isSet(object.teamId) ? String(object.teamId) : "",
      teamMemberId: isSet(object.teamMemberId) ? String(object.teamMemberId) : "",
    };
  },

  toJSON(message: DeleteTeamMemberRequest): unknown {
    const obj: any = {};
    message.teamId !== undefined && (obj.teamId = message.teamId);
    message.teamMemberId !== undefined && (obj.teamMemberId = message.teamMemberId);
    return obj;
  },

  create(base?: DeepPartial<DeleteTeamMemberRequest>): DeleteTeamMemberRequest {
    return DeleteTeamMemberRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeleteTeamMemberRequest>): DeleteTeamMemberRequest {
    const message = createBaseDeleteTeamMemberRequest();
    message.teamId = object.teamId ?? "";
    message.teamMemberId = object.teamMemberId ?? "";
    return message;
  },
};

function createBaseDeleteTeamMemberResponse(): DeleteTeamMemberResponse {
  return {};
}

export const DeleteTeamMemberResponse = {
  encode(_: DeleteTeamMemberResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteTeamMemberResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteTeamMemberResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(_: any): DeleteTeamMemberResponse {
    return {};
  },

  toJSON(_: DeleteTeamMemberResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<DeleteTeamMemberResponse>): DeleteTeamMemberResponse {
    return DeleteTeamMemberResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeleteTeamMemberResponse>): DeleteTeamMemberResponse {
    const message = createBaseDeleteTeamMemberResponse();
    return message;
  },
};

export type TeamsServiceDefinition = typeof TeamsServiceDefinition;
export const TeamsServiceDefinition = {
  name: "TeamsService",
  fullName: "gitpod.experimental.v1.TeamsService",
  methods: {
    /** CreateTeam creates a new Team. */
    createTeam: {
      name: "CreateTeam",
      requestType: CreateTeamRequest,
      requestStream: false,
      responseType: CreateTeamResponse,
      responseStream: false,
      options: {},
    },
    /** GetTeam retrieves a single Team. */
    getTeam: {
      name: "GetTeam",
      requestType: GetTeamRequest,
      requestStream: false,
      responseType: GetTeamResponse,
      responseStream: false,
      options: {},
    },
    /** ListTeams lists the caller has access to. */
    listTeams: {
      name: "ListTeams",
      requestType: ListTeamsRequest,
      requestStream: false,
      responseType: ListTeamsResponse,
      responseStream: false,
      options: {},
    },
    /** DeleteTeam deletes the specified team. */
    deleteTeam: {
      name: "DeleteTeam",
      requestType: DeleteTeamRequest,
      requestStream: false,
      responseType: DeleteTeamResponse,
      responseStream: false,
      options: {},
    },
    /** JoinTeam makes the caller a TeamMember of the Team. */
    joinTeam: {
      name: "JoinTeam",
      requestType: JoinTeamRequest,
      requestStream: false,
      responseType: JoinTeamResponse,
      responseStream: false,
      options: {},
    },
    /** ResetTeamInvitation resets the invitation_id for a Team. */
    resetTeamInvitation: {
      name: "ResetTeamInvitation",
      requestType: ResetTeamInvitationRequest,
      requestStream: false,
      responseType: ResetTeamInvitationResponse,
      responseStream: false,
      options: {},
    },
    /** UpdateTeamMember updates team membership properties. */
    updateTeamMember: {
      name: "UpdateTeamMember",
      requestType: UpdateTeamMemberRequest,
      requestStream: false,
      responseType: UpdateTeamMemberResponse,
      responseStream: false,
      options: {},
    },
    /** DeleteTeamMember removes a TeamMember from the Team. */
    deleteTeamMember: {
      name: "DeleteTeamMember",
      requestType: DeleteTeamMemberRequest,
      requestStream: false,
      responseType: DeleteTeamMemberResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface TeamsServiceImplementation<CallContextExt = {}> {
  /** CreateTeam creates a new Team. */
  createTeam(
    request: CreateTeamRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateTeamResponse>>;
  /** GetTeam retrieves a single Team. */
  getTeam(request: GetTeamRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetTeamResponse>>;
  /** ListTeams lists the caller has access to. */
  listTeams(request: ListTeamsRequest, context: CallContext & CallContextExt): Promise<DeepPartial<ListTeamsResponse>>;
  /** DeleteTeam deletes the specified team. */
  deleteTeam(
    request: DeleteTeamRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<DeleteTeamResponse>>;
  /** JoinTeam makes the caller a TeamMember of the Team. */
  joinTeam(request: JoinTeamRequest, context: CallContext & CallContextExt): Promise<DeepPartial<JoinTeamResponse>>;
  /** ResetTeamInvitation resets the invitation_id for a Team. */
  resetTeamInvitation(
    request: ResetTeamInvitationRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ResetTeamInvitationResponse>>;
  /** UpdateTeamMember updates team membership properties. */
  updateTeamMember(
    request: UpdateTeamMemberRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<UpdateTeamMemberResponse>>;
  /** DeleteTeamMember removes a TeamMember from the Team. */
  deleteTeamMember(
    request: DeleteTeamMemberRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<DeleteTeamMemberResponse>>;
}

export interface TeamsServiceClient<CallOptionsExt = {}> {
  /** CreateTeam creates a new Team. */
  createTeam(
    request: DeepPartial<CreateTeamRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateTeamResponse>;
  /** GetTeam retrieves a single Team. */
  getTeam(request: DeepPartial<GetTeamRequest>, options?: CallOptions & CallOptionsExt): Promise<GetTeamResponse>;
  /** ListTeams lists the caller has access to. */
  listTeams(request: DeepPartial<ListTeamsRequest>, options?: CallOptions & CallOptionsExt): Promise<ListTeamsResponse>;
  /** DeleteTeam deletes the specified team. */
  deleteTeam(
    request: DeepPartial<DeleteTeamRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<DeleteTeamResponse>;
  /** JoinTeam makes the caller a TeamMember of the Team. */
  joinTeam(request: DeepPartial<JoinTeamRequest>, options?: CallOptions & CallOptionsExt): Promise<JoinTeamResponse>;
  /** ResetTeamInvitation resets the invitation_id for a Team. */
  resetTeamInvitation(
    request: DeepPartial<ResetTeamInvitationRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ResetTeamInvitationResponse>;
  /** UpdateTeamMember updates team membership properties. */
  updateTeamMember(
    request: DeepPartial<UpdateTeamMemberRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<UpdateTeamMemberResponse>;
  /** DeleteTeamMember removes a TeamMember from the Team. */
  deleteTeamMember(
    request: DeepPartial<DeleteTeamMemberRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<DeleteTeamMemberResponse>;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function toTimestamp(date: Date): Timestamp {
  const seconds = date.getTime() / 1_000;
  const nanos = (date.getTime() % 1_000) * 1_000_000;
  return { seconds, nanos };
}

function fromTimestamp(t: Timestamp): Date {
  let millis = t.seconds * 1_000;
  millis += t.nanos / 1_000_000;
  return new Date(millis);
}

function fromJsonTimestamp(o: any): Date {
  if (o instanceof Date) {
    return o;
  } else if (typeof o === "string") {
    return new Date(o);
  } else {
    return fromTimestamp(Timestamp.fromJSON(o));
  }
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
