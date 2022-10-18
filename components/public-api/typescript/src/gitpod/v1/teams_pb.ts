/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v0.1.1 with parameter "target=ts"
// @generated from file gitpod/v1/teams.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import type {BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage} from "@bufbuild/protobuf";
import {Message, proto3} from "@bufbuild/protobuf";

/**
 * @generated from enum gitpod.v1.TeamRole
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
proto3.util.setEnumType(TeamRole, "gitpod.v1.TeamRole", [
  { no: 0, name: "TEAM_ROLE_UNSPECIFIED" },
  { no: 1, name: "TEAM_ROLE_OWNER" },
  { no: 2, name: "TEAM_ROLE_MEMBER" },
]);

/**
 * @generated from message gitpod.v1.CreateTeamRequest
 */
export class CreateTeamRequest extends Message<CreateTeamRequest> {
  constructor(data?: PartialMessage<CreateTeamRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.v1.CreateTeamRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
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
 * @generated from message gitpod.v1.CreateTeamResponse
 */
export class CreateTeamResponse extends Message<CreateTeamResponse> {
  constructor(data?: PartialMessage<CreateTeamResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.v1.CreateTeamResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
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
 * @generated from message gitpod.v1.Team
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
   * @generated from field: repeated gitpod.v1.TeamMember members = 4;
   */
  members: TeamMember[] = [];

  constructor(data?: PartialMessage<Team>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.v1.Team";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "slug", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 4, name: "members", kind: "message", T: TeamMember, repeated: true },
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
 * @generated from message gitpod.v1.TeamMember
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
   * @generated from field: gitpod.v1.TeamRole role = 2;
   */
  role = TeamRole.UNSPECIFIED;

  constructor(data?: PartialMessage<TeamMember>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.v1.TeamMember";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "user_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "role", kind: "enum", T: proto3.getEnumType(TeamRole) },
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
