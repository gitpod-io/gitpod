/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "../../../google/protobuf/timestamp_nicegrpc";
import { Pagination } from "./pagination_nicegrpc";

export const protobufPackage = "gitpod.experimental.v1";

export interface Project {
  /**
   * ID is the unique identifier for the project.
   * Read only.
   */
  id: string;
  /**
   * Team ID is the Team this Project belongs to.
   * team_id will be empty if the Project belongs to a User, in which case user_id will be set.
   */
  teamId: string;
  /**
   * User ID is the User this Project belongs to.
   * user_id will be empty if the Project belongs to a Team, in which case team_id will be set.
   */
  userId: string;
  /**
   * Name is the name of the Project.
   * Required.
   */
  name: string;
  /**
   * Slug is a short-hand identifier for a project.
   * Read-only.
   */
  slug: string;
  /**
   * Clone URL is the clone URL on which this Project is based.
   * Required.
   */
  cloneUrl: string;
  /**
   * Time when the Project was created.
   * Read-only.
   */
  creationTime:
    | Date
    | undefined;
  /** Settings are configuration options for a Project. */
  settings: ProjectSettings | undefined;
}

export interface ProjectSettings {
  prebuild: PrebuildSettings | undefined;
  workspace: WorkspaceSettings | undefined;
}

export interface PrebuildSettings {
  enableIncrementalPrebuilds: boolean;
  keepOutdatedPrebuildsRunning: boolean;
  usePreviousPrebuilds: boolean;
  prebuildEveryNth: number;
}

export interface WorkspaceSettings {
  enablePersistentVolumeClaim: boolean;
  workspaceClass: WorkspaceClassSettings | undefined;
}

export interface WorkspaceClassSettings {
  regular: string;
  prebuild: string;
}

export interface CreateProjectRequest {
  project: Project | undefined;
}

export interface CreateProjectResponse {
  project: Project | undefined;
}

export interface GetProjectRequest {
  projectId: string;
}

export interface GetProjectResponse {
  project: Project | undefined;
}

export interface ListProjectsRequest {
  /** User ID filters Projects owned by user_id */
  userId: string;
  /** Team ID filters Projects owned by team_id */
  teamId: string;
  /** Page information */
  pagination: Pagination | undefined;
}

export interface ListProjectsResponse {
  projects: Project[];
  totalResults: number;
}

export interface DeleteProjectRequest {
  projectId: string;
}

export interface DeleteProjectResponse {
}

function createBaseProject(): Project {
  return {
    id: "",
    teamId: "",
    userId: "",
    name: "",
    slug: "",
    cloneUrl: "",
    creationTime: undefined,
    settings: undefined,
  };
}

export const Project = {
  encode(message: Project, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.teamId !== "") {
      writer.uint32(18).string(message.teamId);
    }
    if (message.userId !== "") {
      writer.uint32(26).string(message.userId);
    }
    if (message.name !== "") {
      writer.uint32(34).string(message.name);
    }
    if (message.slug !== "") {
      writer.uint32(42).string(message.slug);
    }
    if (message.cloneUrl !== "") {
      writer.uint32(50).string(message.cloneUrl);
    }
    if (message.creationTime !== undefined) {
      Timestamp.encode(toTimestamp(message.creationTime), writer.uint32(58).fork()).ldelim();
    }
    if (message.settings !== undefined) {
      ProjectSettings.encode(message.settings, writer.uint32(66).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Project {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseProject();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.teamId = reader.string();
          break;
        case 3:
          message.userId = reader.string();
          break;
        case 4:
          message.name = reader.string();
          break;
        case 5:
          message.slug = reader.string();
          break;
        case 6:
          message.cloneUrl = reader.string();
          break;
        case 7:
          message.creationTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 8:
          message.settings = ProjectSettings.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Project {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      teamId: isSet(object.teamId) ? String(object.teamId) : "",
      userId: isSet(object.userId) ? String(object.userId) : "",
      name: isSet(object.name) ? String(object.name) : "",
      slug: isSet(object.slug) ? String(object.slug) : "",
      cloneUrl: isSet(object.cloneUrl) ? String(object.cloneUrl) : "",
      creationTime: isSet(object.creationTime) ? fromJsonTimestamp(object.creationTime) : undefined,
      settings: isSet(object.settings) ? ProjectSettings.fromJSON(object.settings) : undefined,
    };
  },

  toJSON(message: Project): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.teamId !== undefined && (obj.teamId = message.teamId);
    message.userId !== undefined && (obj.userId = message.userId);
    message.name !== undefined && (obj.name = message.name);
    message.slug !== undefined && (obj.slug = message.slug);
    message.cloneUrl !== undefined && (obj.cloneUrl = message.cloneUrl);
    message.creationTime !== undefined && (obj.creationTime = message.creationTime.toISOString());
    message.settings !== undefined &&
      (obj.settings = message.settings ? ProjectSettings.toJSON(message.settings) : undefined);
    return obj;
  },

  create(base?: DeepPartial<Project>): Project {
    return Project.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Project>): Project {
    const message = createBaseProject();
    message.id = object.id ?? "";
    message.teamId = object.teamId ?? "";
    message.userId = object.userId ?? "";
    message.name = object.name ?? "";
    message.slug = object.slug ?? "";
    message.cloneUrl = object.cloneUrl ?? "";
    message.creationTime = object.creationTime ?? undefined;
    message.settings = (object.settings !== undefined && object.settings !== null)
      ? ProjectSettings.fromPartial(object.settings)
      : undefined;
    return message;
  },
};

function createBaseProjectSettings(): ProjectSettings {
  return { prebuild: undefined, workspace: undefined };
}

export const ProjectSettings = {
  encode(message: ProjectSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prebuild !== undefined) {
      PrebuildSettings.encode(message.prebuild, writer.uint32(10).fork()).ldelim();
    }
    if (message.workspace !== undefined) {
      WorkspaceSettings.encode(message.workspace, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ProjectSettings {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseProjectSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prebuild = PrebuildSettings.decode(reader, reader.uint32());
          break;
        case 2:
          message.workspace = WorkspaceSettings.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ProjectSettings {
    return {
      prebuild: isSet(object.prebuild) ? PrebuildSettings.fromJSON(object.prebuild) : undefined,
      workspace: isSet(object.workspace) ? WorkspaceSettings.fromJSON(object.workspace) : undefined,
    };
  },

  toJSON(message: ProjectSettings): unknown {
    const obj: any = {};
    message.prebuild !== undefined &&
      (obj.prebuild = message.prebuild ? PrebuildSettings.toJSON(message.prebuild) : undefined);
    message.workspace !== undefined &&
      (obj.workspace = message.workspace ? WorkspaceSettings.toJSON(message.workspace) : undefined);
    return obj;
  },

  create(base?: DeepPartial<ProjectSettings>): ProjectSettings {
    return ProjectSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ProjectSettings>): ProjectSettings {
    const message = createBaseProjectSettings();
    message.prebuild = (object.prebuild !== undefined && object.prebuild !== null)
      ? PrebuildSettings.fromPartial(object.prebuild)
      : undefined;
    message.workspace = (object.workspace !== undefined && object.workspace !== null)
      ? WorkspaceSettings.fromPartial(object.workspace)
      : undefined;
    return message;
  },
};

function createBasePrebuildSettings(): PrebuildSettings {
  return {
    enableIncrementalPrebuilds: false,
    keepOutdatedPrebuildsRunning: false,
    usePreviousPrebuilds: false,
    prebuildEveryNth: 0,
  };
}

export const PrebuildSettings = {
  encode(message: PrebuildSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.enableIncrementalPrebuilds === true) {
      writer.uint32(8).bool(message.enableIncrementalPrebuilds);
    }
    if (message.keepOutdatedPrebuildsRunning === true) {
      writer.uint32(16).bool(message.keepOutdatedPrebuildsRunning);
    }
    if (message.usePreviousPrebuilds === true) {
      writer.uint32(24).bool(message.usePreviousPrebuilds);
    }
    if (message.prebuildEveryNth !== 0) {
      writer.uint32(32).int32(message.prebuildEveryNth);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PrebuildSettings {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePrebuildSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.enableIncrementalPrebuilds = reader.bool();
          break;
        case 2:
          message.keepOutdatedPrebuildsRunning = reader.bool();
          break;
        case 3:
          message.usePreviousPrebuilds = reader.bool();
          break;
        case 4:
          message.prebuildEveryNth = reader.int32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PrebuildSettings {
    return {
      enableIncrementalPrebuilds: isSet(object.enableIncrementalPrebuilds)
        ? Boolean(object.enableIncrementalPrebuilds)
        : false,
      keepOutdatedPrebuildsRunning: isSet(object.keepOutdatedPrebuildsRunning)
        ? Boolean(object.keepOutdatedPrebuildsRunning)
        : false,
      usePreviousPrebuilds: isSet(object.usePreviousPrebuilds) ? Boolean(object.usePreviousPrebuilds) : false,
      prebuildEveryNth: isSet(object.prebuildEveryNth) ? Number(object.prebuildEveryNth) : 0,
    };
  },

  toJSON(message: PrebuildSettings): unknown {
    const obj: any = {};
    message.enableIncrementalPrebuilds !== undefined &&
      (obj.enableIncrementalPrebuilds = message.enableIncrementalPrebuilds);
    message.keepOutdatedPrebuildsRunning !== undefined &&
      (obj.keepOutdatedPrebuildsRunning = message.keepOutdatedPrebuildsRunning);
    message.usePreviousPrebuilds !== undefined && (obj.usePreviousPrebuilds = message.usePreviousPrebuilds);
    message.prebuildEveryNth !== undefined && (obj.prebuildEveryNth = Math.round(message.prebuildEveryNth));
    return obj;
  },

  create(base?: DeepPartial<PrebuildSettings>): PrebuildSettings {
    return PrebuildSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<PrebuildSettings>): PrebuildSettings {
    const message = createBasePrebuildSettings();
    message.enableIncrementalPrebuilds = object.enableIncrementalPrebuilds ?? false;
    message.keepOutdatedPrebuildsRunning = object.keepOutdatedPrebuildsRunning ?? false;
    message.usePreviousPrebuilds = object.usePreviousPrebuilds ?? false;
    message.prebuildEveryNth = object.prebuildEveryNth ?? 0;
    return message;
  },
};

function createBaseWorkspaceSettings(): WorkspaceSettings {
  return { enablePersistentVolumeClaim: false, workspaceClass: undefined };
}

export const WorkspaceSettings = {
  encode(message: WorkspaceSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.enablePersistentVolumeClaim === true) {
      writer.uint32(8).bool(message.enablePersistentVolumeClaim);
    }
    if (message.workspaceClass !== undefined) {
      WorkspaceClassSettings.encode(message.workspaceClass, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WorkspaceSettings {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWorkspaceSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.enablePersistentVolumeClaim = reader.bool();
          break;
        case 2:
          message.workspaceClass = WorkspaceClassSettings.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WorkspaceSettings {
    return {
      enablePersistentVolumeClaim: isSet(object.enablePersistentVolumeClaim)
        ? Boolean(object.enablePersistentVolumeClaim)
        : false,
      workspaceClass: isSet(object.workspaceClass) ? WorkspaceClassSettings.fromJSON(object.workspaceClass) : undefined,
    };
  },

  toJSON(message: WorkspaceSettings): unknown {
    const obj: any = {};
    message.enablePersistentVolumeClaim !== undefined &&
      (obj.enablePersistentVolumeClaim = message.enablePersistentVolumeClaim);
    message.workspaceClass !== undefined &&
      (obj.workspaceClass = message.workspaceClass ? WorkspaceClassSettings.toJSON(message.workspaceClass) : undefined);
    return obj;
  },

  create(base?: DeepPartial<WorkspaceSettings>): WorkspaceSettings {
    return WorkspaceSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<WorkspaceSettings>): WorkspaceSettings {
    const message = createBaseWorkspaceSettings();
    message.enablePersistentVolumeClaim = object.enablePersistentVolumeClaim ?? false;
    message.workspaceClass = (object.workspaceClass !== undefined && object.workspaceClass !== null)
      ? WorkspaceClassSettings.fromPartial(object.workspaceClass)
      : undefined;
    return message;
  },
};

function createBaseWorkspaceClassSettings(): WorkspaceClassSettings {
  return { regular: "", prebuild: "" };
}

export const WorkspaceClassSettings = {
  encode(message: WorkspaceClassSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.regular !== "") {
      writer.uint32(10).string(message.regular);
    }
    if (message.prebuild !== "") {
      writer.uint32(18).string(message.prebuild);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WorkspaceClassSettings {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWorkspaceClassSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.regular = reader.string();
          break;
        case 2:
          message.prebuild = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WorkspaceClassSettings {
    return {
      regular: isSet(object.regular) ? String(object.regular) : "",
      prebuild: isSet(object.prebuild) ? String(object.prebuild) : "",
    };
  },

  toJSON(message: WorkspaceClassSettings): unknown {
    const obj: any = {};
    message.regular !== undefined && (obj.regular = message.regular);
    message.prebuild !== undefined && (obj.prebuild = message.prebuild);
    return obj;
  },

  create(base?: DeepPartial<WorkspaceClassSettings>): WorkspaceClassSettings {
    return WorkspaceClassSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<WorkspaceClassSettings>): WorkspaceClassSettings {
    const message = createBaseWorkspaceClassSettings();
    message.regular = object.regular ?? "";
    message.prebuild = object.prebuild ?? "";
    return message;
  },
};

function createBaseCreateProjectRequest(): CreateProjectRequest {
  return { project: undefined };
}

export const CreateProjectRequest = {
  encode(message: CreateProjectRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.project !== undefined) {
      Project.encode(message.project, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateProjectRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateProjectRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.project = Project.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateProjectRequest {
    return { project: isSet(object.project) ? Project.fromJSON(object.project) : undefined };
  },

  toJSON(message: CreateProjectRequest): unknown {
    const obj: any = {};
    message.project !== undefined && (obj.project = message.project ? Project.toJSON(message.project) : undefined);
    return obj;
  },

  create(base?: DeepPartial<CreateProjectRequest>): CreateProjectRequest {
    return CreateProjectRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateProjectRequest>): CreateProjectRequest {
    const message = createBaseCreateProjectRequest();
    message.project = (object.project !== undefined && object.project !== null)
      ? Project.fromPartial(object.project)
      : undefined;
    return message;
  },
};

function createBaseCreateProjectResponse(): CreateProjectResponse {
  return { project: undefined };
}

export const CreateProjectResponse = {
  encode(message: CreateProjectResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.project !== undefined) {
      Project.encode(message.project, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateProjectResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateProjectResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.project = Project.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateProjectResponse {
    return { project: isSet(object.project) ? Project.fromJSON(object.project) : undefined };
  },

  toJSON(message: CreateProjectResponse): unknown {
    const obj: any = {};
    message.project !== undefined && (obj.project = message.project ? Project.toJSON(message.project) : undefined);
    return obj;
  },

  create(base?: DeepPartial<CreateProjectResponse>): CreateProjectResponse {
    return CreateProjectResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateProjectResponse>): CreateProjectResponse {
    const message = createBaseCreateProjectResponse();
    message.project = (object.project !== undefined && object.project !== null)
      ? Project.fromPartial(object.project)
      : undefined;
    return message;
  },
};

function createBaseGetProjectRequest(): GetProjectRequest {
  return { projectId: "" };
}

export const GetProjectRequest = {
  encode(message: GetProjectRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.projectId !== "") {
      writer.uint32(10).string(message.projectId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetProjectRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetProjectRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.projectId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetProjectRequest {
    return { projectId: isSet(object.projectId) ? String(object.projectId) : "" };
  },

  toJSON(message: GetProjectRequest): unknown {
    const obj: any = {};
    message.projectId !== undefined && (obj.projectId = message.projectId);
    return obj;
  },

  create(base?: DeepPartial<GetProjectRequest>): GetProjectRequest {
    return GetProjectRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetProjectRequest>): GetProjectRequest {
    const message = createBaseGetProjectRequest();
    message.projectId = object.projectId ?? "";
    return message;
  },
};

function createBaseGetProjectResponse(): GetProjectResponse {
  return { project: undefined };
}

export const GetProjectResponse = {
  encode(message: GetProjectResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.project !== undefined) {
      Project.encode(message.project, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetProjectResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetProjectResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.project = Project.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetProjectResponse {
    return { project: isSet(object.project) ? Project.fromJSON(object.project) : undefined };
  },

  toJSON(message: GetProjectResponse): unknown {
    const obj: any = {};
    message.project !== undefined && (obj.project = message.project ? Project.toJSON(message.project) : undefined);
    return obj;
  },

  create(base?: DeepPartial<GetProjectResponse>): GetProjectResponse {
    return GetProjectResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetProjectResponse>): GetProjectResponse {
    const message = createBaseGetProjectResponse();
    message.project = (object.project !== undefined && object.project !== null)
      ? Project.fromPartial(object.project)
      : undefined;
    return message;
  },
};

function createBaseListProjectsRequest(): ListProjectsRequest {
  return { userId: "", teamId: "", pagination: undefined };
}

export const ListProjectsRequest = {
  encode(message: ListProjectsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userId !== "") {
      writer.uint32(10).string(message.userId);
    }
    if (message.teamId !== "") {
      writer.uint32(18).string(message.teamId);
    }
    if (message.pagination !== undefined) {
      Pagination.encode(message.pagination, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListProjectsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListProjectsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.userId = reader.string();
          break;
        case 2:
          message.teamId = reader.string();
          break;
        case 3:
          message.pagination = Pagination.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListProjectsRequest {
    return {
      userId: isSet(object.userId) ? String(object.userId) : "",
      teamId: isSet(object.teamId) ? String(object.teamId) : "",
      pagination: isSet(object.pagination) ? Pagination.fromJSON(object.pagination) : undefined,
    };
  },

  toJSON(message: ListProjectsRequest): unknown {
    const obj: any = {};
    message.userId !== undefined && (obj.userId = message.userId);
    message.teamId !== undefined && (obj.teamId = message.teamId);
    message.pagination !== undefined &&
      (obj.pagination = message.pagination ? Pagination.toJSON(message.pagination) : undefined);
    return obj;
  },

  create(base?: DeepPartial<ListProjectsRequest>): ListProjectsRequest {
    return ListProjectsRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListProjectsRequest>): ListProjectsRequest {
    const message = createBaseListProjectsRequest();
    message.userId = object.userId ?? "";
    message.teamId = object.teamId ?? "";
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? Pagination.fromPartial(object.pagination)
      : undefined;
    return message;
  },
};

function createBaseListProjectsResponse(): ListProjectsResponse {
  return { projects: [], totalResults: 0 };
}

export const ListProjectsResponse = {
  encode(message: ListProjectsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.projects) {
      Project.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.totalResults !== 0) {
      writer.uint32(16).int32(message.totalResults);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListProjectsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListProjectsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.projects.push(Project.decode(reader, reader.uint32()));
          break;
        case 2:
          message.totalResults = reader.int32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListProjectsResponse {
    return {
      projects: Array.isArray(object?.projects) ? object.projects.map((e: any) => Project.fromJSON(e)) : [],
      totalResults: isSet(object.totalResults) ? Number(object.totalResults) : 0,
    };
  },

  toJSON(message: ListProjectsResponse): unknown {
    const obj: any = {};
    if (message.projects) {
      obj.projects = message.projects.map((e) => e ? Project.toJSON(e) : undefined);
    } else {
      obj.projects = [];
    }
    message.totalResults !== undefined && (obj.totalResults = Math.round(message.totalResults));
    return obj;
  },

  create(base?: DeepPartial<ListProjectsResponse>): ListProjectsResponse {
    return ListProjectsResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListProjectsResponse>): ListProjectsResponse {
    const message = createBaseListProjectsResponse();
    message.projects = object.projects?.map((e) => Project.fromPartial(e)) || [];
    message.totalResults = object.totalResults ?? 0;
    return message;
  },
};

function createBaseDeleteProjectRequest(): DeleteProjectRequest {
  return { projectId: "" };
}

export const DeleteProjectRequest = {
  encode(message: DeleteProjectRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.projectId !== "") {
      writer.uint32(10).string(message.projectId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteProjectRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteProjectRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.projectId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeleteProjectRequest {
    return { projectId: isSet(object.projectId) ? String(object.projectId) : "" };
  },

  toJSON(message: DeleteProjectRequest): unknown {
    const obj: any = {};
    message.projectId !== undefined && (obj.projectId = message.projectId);
    return obj;
  },

  create(base?: DeepPartial<DeleteProjectRequest>): DeleteProjectRequest {
    return DeleteProjectRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeleteProjectRequest>): DeleteProjectRequest {
    const message = createBaseDeleteProjectRequest();
    message.projectId = object.projectId ?? "";
    return message;
  },
};

function createBaseDeleteProjectResponse(): DeleteProjectResponse {
  return {};
}

export const DeleteProjectResponse = {
  encode(_: DeleteProjectResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteProjectResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteProjectResponse();
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

  fromJSON(_: any): DeleteProjectResponse {
    return {};
  },

  toJSON(_: DeleteProjectResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<DeleteProjectResponse>): DeleteProjectResponse {
    return DeleteProjectResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeleteProjectResponse>): DeleteProjectResponse {
    const message = createBaseDeleteProjectResponse();
    return message;
  },
};

export type ProjectsServiceDefinition = typeof ProjectsServiceDefinition;
export const ProjectsServiceDefinition = {
  name: "ProjectsService",
  fullName: "gitpod.experimental.v1.ProjectsService",
  methods: {
    /** Creates a new project. */
    createProject: {
      name: "CreateProject",
      requestType: CreateProjectRequest,
      requestStream: false,
      responseType: CreateProjectResponse,
      responseStream: false,
      options: {},
    },
    /** Retrieves a project. */
    getProject: {
      name: "GetProject",
      requestType: GetProjectRequest,
      requestStream: false,
      responseType: GetProjectResponse,
      responseStream: false,
      options: {},
    },
    /** Lists projects. */
    listProjects: {
      name: "ListProjects",
      requestType: ListProjectsRequest,
      requestStream: false,
      responseType: ListProjectsResponse,
      responseStream: false,
      options: {},
    },
    /** Deletes a project. */
    deleteProject: {
      name: "DeleteProject",
      requestType: DeleteProjectRequest,
      requestStream: false,
      responseType: DeleteProjectResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface ProjectsServiceImplementation<CallContextExt = {}> {
  /** Creates a new project. */
  createProject(
    request: CreateProjectRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateProjectResponse>>;
  /** Retrieves a project. */
  getProject(
    request: GetProjectRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetProjectResponse>>;
  /** Lists projects. */
  listProjects(
    request: ListProjectsRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ListProjectsResponse>>;
  /** Deletes a project. */
  deleteProject(
    request: DeleteProjectRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<DeleteProjectResponse>>;
}

export interface ProjectsServiceClient<CallOptionsExt = {}> {
  /** Creates a new project. */
  createProject(
    request: DeepPartial<CreateProjectRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateProjectResponse>;
  /** Retrieves a project. */
  getProject(
    request: DeepPartial<GetProjectRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetProjectResponse>;
  /** Lists projects. */
  listProjects(
    request: DeepPartial<ListProjectsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ListProjectsResponse>;
  /** Deletes a project. */
  deleteProject(
    request: DeepPartial<DeleteProjectRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<DeleteProjectResponse>;
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
