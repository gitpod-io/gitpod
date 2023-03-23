/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v0.1.1 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/projects.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import type {BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage} from "@bufbuild/protobuf";
import {Message, proto3, Timestamp} from "@bufbuild/protobuf";
import {Pagination} from "./pagination_pb.js";

/**
 * @generated from message gitpod.experimental.v1.Project
 */
export class Project extends Message<Project> {
  /**
   * ID is the unique identifier for the project.
   * Read only.
   *
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * Team ID is the Team this Project belongs to.
   * team_id will be empty if the Project belongs to a User, in which case user_id will be set.
   *
   * @generated from field: string team_id = 2;
   */
  teamId = "";

  /**
   * User ID is the User this Project belongs to.
   * user_id will be empty if the Project belongs to a Team, in which case team_id will be set.
   *
   * @generated from field: string user_id = 3;
   */
  userId = "";

  /**
   * Name is the name of the Project.
   * Required.
   *
   * @generated from field: string name = 4;
   */
  name = "";

  /**
   * Slug is a short-hand identifier for a project.
   * Read-only.
   *
   * @generated from field: string slug = 5;
   */
  slug = "";

  /**
   * Clone URL is the clone URL on which this Project is based.
   * Required.
   *
   * @generated from field: string clone_url = 6;
   */
  cloneUrl = "";

  /**
   * Time when the Project was created.
   * Read-only.
   *
   * @generated from field: google.protobuf.Timestamp creation_time = 7;
   */
  creationTime?: Timestamp;

  /**
   * Settings are configuration options for a Project.
   *
   * @generated from field: gitpod.experimental.v1.ProjectSettings settings = 8;
   */
  settings?: ProjectSettings;

  constructor(data?: PartialMessage<Project>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.Project";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "team_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "user_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 4, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 5, name: "slug", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 6, name: "clone_url", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 7, name: "creation_time", kind: "message", T: Timestamp },
    { no: 8, name: "settings", kind: "message", T: ProjectSettings },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Project {
    return new Project().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Project {
    return new Project().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Project {
    return new Project().fromJsonString(jsonString, options);
  }

  static equals(a: Project | PlainMessage<Project> | undefined, b: Project | PlainMessage<Project> | undefined): boolean {
    return proto3.util.equals(Project, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ProjectSettings
 */
export class ProjectSettings extends Message<ProjectSettings> {
  /**
   * @generated from field: gitpod.experimental.v1.PrebuildSettings prebuild = 1;
   */
  prebuild?: PrebuildSettings;

  /**
   * @generated from field: gitpod.experimental.v1.WorkspaceSettings workspace = 2;
   */
  workspace?: WorkspaceSettings;

  constructor(data?: PartialMessage<ProjectSettings>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ProjectSettings";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "prebuild", kind: "message", T: PrebuildSettings },
    { no: 2, name: "workspace", kind: "message", T: WorkspaceSettings },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ProjectSettings {
    return new ProjectSettings().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ProjectSettings {
    return new ProjectSettings().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ProjectSettings {
    return new ProjectSettings().fromJsonString(jsonString, options);
  }

  static equals(a: ProjectSettings | PlainMessage<ProjectSettings> | undefined, b: ProjectSettings | PlainMessage<ProjectSettings> | undefined): boolean {
    return proto3.util.equals(ProjectSettings, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.PrebuildSettings
 */
export class PrebuildSettings extends Message<PrebuildSettings> {
  /**
   * @generated from field: bool enable_incremental_prebuilds = 1;
   */
  enableIncrementalPrebuilds = false;

  /**
   * @generated from field: bool keep_outdated_prebuilds_running = 2;
   */
  keepOutdatedPrebuildsRunning = false;

  /**
   * @generated from field: bool use_previous_prebuilds = 3;
   */
  usePreviousPrebuilds = false;

  /**
   * @generated from field: int32 prebuild_every_nth = 4;
   */
  prebuildEveryNth = 0;

  constructor(data?: PartialMessage<PrebuildSettings>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.PrebuildSettings";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "enable_incremental_prebuilds", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 2, name: "keep_outdated_prebuilds_running", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 3, name: "use_previous_prebuilds", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 4, name: "prebuild_every_nth", kind: "scalar", T: 5 /* ScalarType.INT32 */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PrebuildSettings {
    return new PrebuildSettings().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PrebuildSettings {
    return new PrebuildSettings().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PrebuildSettings {
    return new PrebuildSettings().fromJsonString(jsonString, options);
  }

  static equals(a: PrebuildSettings | PlainMessage<PrebuildSettings> | undefined, b: PrebuildSettings | PlainMessage<PrebuildSettings> | undefined): boolean {
    return proto3.util.equals(PrebuildSettings, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.WorkspaceSettings
 */
export class WorkspaceSettings extends Message<WorkspaceSettings> {
  /**
   * @generated from field: bool enable_persistent_volume_claim = 1;
   */
  enablePersistentVolumeClaim = false;

  /**
   * @generated from field: gitpod.experimental.v1.WorkspaceClassSettings workspace_class = 2;
   */
  workspaceClass?: WorkspaceClassSettings;

  constructor(data?: PartialMessage<WorkspaceSettings>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.WorkspaceSettings";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "enable_persistent_volume_claim", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 2, name: "workspace_class", kind: "message", T: WorkspaceClassSettings },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): WorkspaceSettings {
    return new WorkspaceSettings().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): WorkspaceSettings {
    return new WorkspaceSettings().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): WorkspaceSettings {
    return new WorkspaceSettings().fromJsonString(jsonString, options);
  }

  static equals(a: WorkspaceSettings | PlainMessage<WorkspaceSettings> | undefined, b: WorkspaceSettings | PlainMessage<WorkspaceSettings> | undefined): boolean {
    return proto3.util.equals(WorkspaceSettings, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.WorkspaceClassSettings
 */
export class WorkspaceClassSettings extends Message<WorkspaceClassSettings> {
  /**
   * @generated from field: string regular = 1;
   */
  regular = "";

  /**
   * @generated from field: string prebuild = 2;
   */
  prebuild = "";

  constructor(data?: PartialMessage<WorkspaceClassSettings>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.WorkspaceClassSettings";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "regular", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "prebuild", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): WorkspaceClassSettings {
    return new WorkspaceClassSettings().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): WorkspaceClassSettings {
    return new WorkspaceClassSettings().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): WorkspaceClassSettings {
    return new WorkspaceClassSettings().fromJsonString(jsonString, options);
  }

  static equals(a: WorkspaceClassSettings | PlainMessage<WorkspaceClassSettings> | undefined, b: WorkspaceClassSettings | PlainMessage<WorkspaceClassSettings> | undefined): boolean {
    return proto3.util.equals(WorkspaceClassSettings, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreateProjectRequest
 */
export class CreateProjectRequest extends Message<CreateProjectRequest> {
  /**
   * @generated from field: gitpod.experimental.v1.Project project = 1;
   */
  project?: Project;

  constructor(data?: PartialMessage<CreateProjectRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreateProjectRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "project", kind: "message", T: Project },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateProjectRequest {
    return new CreateProjectRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateProjectRequest {
    return new CreateProjectRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateProjectRequest {
    return new CreateProjectRequest().fromJsonString(jsonString, options);
  }

  static equals(a: CreateProjectRequest | PlainMessage<CreateProjectRequest> | undefined, b: CreateProjectRequest | PlainMessage<CreateProjectRequest> | undefined): boolean {
    return proto3.util.equals(CreateProjectRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreateProjectResponse
 */
export class CreateProjectResponse extends Message<CreateProjectResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.Project project = 1;
   */
  project?: Project;

  constructor(data?: PartialMessage<CreateProjectResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreateProjectResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "project", kind: "message", T: Project },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateProjectResponse {
    return new CreateProjectResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateProjectResponse {
    return new CreateProjectResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateProjectResponse {
    return new CreateProjectResponse().fromJsonString(jsonString, options);
  }

  static equals(a: CreateProjectResponse | PlainMessage<CreateProjectResponse> | undefined, b: CreateProjectResponse | PlainMessage<CreateProjectResponse> | undefined): boolean {
    return proto3.util.equals(CreateProjectResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetProjectRequest
 */
export class GetProjectRequest extends Message<GetProjectRequest> {
  /**
   * @generated from field: string project_id = 1;
   */
  projectId = "";

  constructor(data?: PartialMessage<GetProjectRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetProjectRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "project_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetProjectRequest {
    return new GetProjectRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetProjectRequest {
    return new GetProjectRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetProjectRequest {
    return new GetProjectRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetProjectRequest | PlainMessage<GetProjectRequest> | undefined, b: GetProjectRequest | PlainMessage<GetProjectRequest> | undefined): boolean {
    return proto3.util.equals(GetProjectRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetProjectResponse
 */
export class GetProjectResponse extends Message<GetProjectResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.Project project = 1;
   */
  project?: Project;

  constructor(data?: PartialMessage<GetProjectResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetProjectResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "project", kind: "message", T: Project },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetProjectResponse {
    return new GetProjectResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetProjectResponse {
    return new GetProjectResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetProjectResponse {
    return new GetProjectResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetProjectResponse | PlainMessage<GetProjectResponse> | undefined, b: GetProjectResponse | PlainMessage<GetProjectResponse> | undefined): boolean {
    return proto3.util.equals(GetProjectResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ListProjectsRequest
 */
export class ListProjectsRequest extends Message<ListProjectsRequest> {
  /**
   * User ID filters Projects owned by user_id
   *
   * @generated from field: string user_id = 1;
   */
  userId = "";

  /**
   * Team ID filters Projects owned by team_id
   *
   * @generated from field: string team_id = 2;
   */
  teamId = "";

  /**
   * Page information
   *
   * @generated from field: gitpod.experimental.v1.Pagination pagination = 3;
   */
  pagination?: Pagination;

  constructor(data?: PartialMessage<ListProjectsRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListProjectsRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "user_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "team_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "pagination", kind: "message", T: Pagination },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListProjectsRequest {
    return new ListProjectsRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListProjectsRequest {
    return new ListProjectsRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListProjectsRequest {
    return new ListProjectsRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListProjectsRequest | PlainMessage<ListProjectsRequest> | undefined, b: ListProjectsRequest | PlainMessage<ListProjectsRequest> | undefined): boolean {
    return proto3.util.equals(ListProjectsRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ListProjectsResponse
 */
export class ListProjectsResponse extends Message<ListProjectsResponse> {
  /**
   * @generated from field: repeated gitpod.experimental.v1.Project projects = 1;
   */
  projects: Project[] = [];

  /**
   * @generated from field: int32 total_results = 2;
   */
  totalResults = 0;

  constructor(data?: PartialMessage<ListProjectsResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListProjectsResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "projects", kind: "message", T: Project, repeated: true },
    { no: 2, name: "total_results", kind: "scalar", T: 5 /* ScalarType.INT32 */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListProjectsResponse {
    return new ListProjectsResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListProjectsResponse {
    return new ListProjectsResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListProjectsResponse {
    return new ListProjectsResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListProjectsResponse | PlainMessage<ListProjectsResponse> | undefined, b: ListProjectsResponse | PlainMessage<ListProjectsResponse> | undefined): boolean {
    return proto3.util.equals(ListProjectsResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteProjectRequest
 */
export class DeleteProjectRequest extends Message<DeleteProjectRequest> {
  /**
   * @generated from field: string project_id = 1;
   */
  projectId = "";

  constructor(data?: PartialMessage<DeleteProjectRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteProjectRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "project_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteProjectRequest {
    return new DeleteProjectRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteProjectRequest {
    return new DeleteProjectRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteProjectRequest {
    return new DeleteProjectRequest().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteProjectRequest | PlainMessage<DeleteProjectRequest> | undefined, b: DeleteProjectRequest | PlainMessage<DeleteProjectRequest> | undefined): boolean {
    return proto3.util.equals(DeleteProjectRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteProjectResponse
 */
export class DeleteProjectResponse extends Message<DeleteProjectResponse> {
  constructor(data?: PartialMessage<DeleteProjectResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteProjectResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteProjectResponse {
    return new DeleteProjectResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteProjectResponse {
    return new DeleteProjectResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteProjectResponse {
    return new DeleteProjectResponse().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteProjectResponse | PlainMessage<DeleteProjectResponse> | undefined, b: DeleteProjectResponse | PlainMessage<DeleteProjectResponse> | undefined): boolean {
    return proto3.util.equals(DeleteProjectResponse, a, b);
  }
}

