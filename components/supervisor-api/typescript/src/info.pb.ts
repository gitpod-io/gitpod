/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "supervisor";

export enum DebugWorkspaceType {
  noDebug = "noDebug",
  regular = "regular",
  prebuild = "prebuild",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function debugWorkspaceTypeFromJSON(object: any): DebugWorkspaceType {
  switch (object) {
    case 0:
    case "noDebug":
      return DebugWorkspaceType.noDebug;
    case 1:
    case "regular":
      return DebugWorkspaceType.regular;
    case 2:
    case "prebuild":
      return DebugWorkspaceType.prebuild;
    case -1:
    case "UNRECOGNIZED":
    default:
      return DebugWorkspaceType.UNRECOGNIZED;
  }
}

export function debugWorkspaceTypeToJSON(object: DebugWorkspaceType): string {
  switch (object) {
    case DebugWorkspaceType.noDebug:
      return "noDebug";
    case DebugWorkspaceType.regular:
      return "regular";
    case DebugWorkspaceType.prebuild:
      return "prebuild";
    case DebugWorkspaceType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function debugWorkspaceTypeToNumber(object: DebugWorkspaceType): number {
  switch (object) {
    case DebugWorkspaceType.noDebug:
      return 0;
    case DebugWorkspaceType.regular:
      return 1;
    case DebugWorkspaceType.prebuild:
      return 2;
    case DebugWorkspaceType.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface WorkspaceInfoRequest {
}

export interface WorkspaceInfoResponse {
  /** workspace_id is the workspace ID of this workspace. */
  workspaceId: string;
  /** instance_id is the instance ID of this workspace. */
  instanceId: string;
  /** checkout_location is the path where we initialized the workspace content */
  checkoutLocation: string;
  /** file means the workspace root is a file describing the workspace layout. */
  workspaceLocationFile:
    | string
    | undefined;
  /** folder means the workspace root is a simple folder. */
  workspaceLocationFolder:
    | string
    | undefined;
  /** user_home is the path to the user's home. */
  userHome: string;
  /** GitpodAPI provides information to reach the Gitpod server API. */
  gitpodApi:
    | WorkspaceInfoResponse_GitpodAPI
    | undefined;
  /** gitpod_host provides Gitpod host URL. */
  gitpodHost: string;
  /** workspace_context_url is an URL for which the workspace was created. */
  workspaceContextUrl: string;
  /** repository is a repository from which this workspace was created */
  repository:
    | WorkspaceInfoResponse_Repository
    | undefined;
  /** workspace_cluster_host provides the cluster host under which this workspace is served, e.g. ws-eu11.gitpod.io */
  workspaceClusterHost: string;
  /** workspace_url is an URL for which the workspace is accessed. */
  workspaceUrl: string;
  /** ide_alias is an alias of IDE to be run. Possible values: "code", "code-latest", "theia" */
  ideAlias: string;
  /** ide_port is the port on which the IDE is to be run */
  idePort: number;
  /** workspace_class denotes the class of the workspace */
  workspaceClass:
    | WorkspaceInfoResponse_WorkspaceClass
    | undefined;
  /** owner_id is user id who owns the workspace */
  ownerId: string;
  /** debug_workspace_type indicates whether it is a regular or prebuild debug workspace */
  debugWorkspaceType: DebugWorkspaceType;
}

export interface WorkspaceInfoResponse_GitpodAPI {
  /** endpoint is the websocket URL on which the token-accessible Gitpod API is served on */
  endpoint: string;
  /** host is the host of the endpoint. Use this host to ask supervisor a token. */
  host: string;
}

export interface WorkspaceInfoResponse_Repository {
  /** owner is the repository owner */
  owner: string;
  /** name is the repository name */
  name: string;
}

export interface WorkspaceInfoResponse_WorkspaceClass {
  /** id is the id of the workspace class */
  id: string;
  /** display_name is the display_name of the workspace class */
  displayName: string;
  /** description is the description of the workspace class */
  description: string;
}

function createBaseWorkspaceInfoRequest(): WorkspaceInfoRequest {
  return {};
}

export const WorkspaceInfoRequest = {
  encode(_: WorkspaceInfoRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WorkspaceInfoRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWorkspaceInfoRequest();
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

  fromJSON(_: any): WorkspaceInfoRequest {
    return {};
  },

  toJSON(_: WorkspaceInfoRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<WorkspaceInfoRequest>): WorkspaceInfoRequest {
    const message = createBaseWorkspaceInfoRequest();
    return message;
  },
};

function createBaseWorkspaceInfoResponse(): WorkspaceInfoResponse {
  return {
    workspaceId: "",
    instanceId: "",
    checkoutLocation: "",
    workspaceLocationFile: undefined,
    workspaceLocationFolder: undefined,
    userHome: "",
    gitpodApi: undefined,
    gitpodHost: "",
    workspaceContextUrl: "",
    repository: undefined,
    workspaceClusterHost: "",
    workspaceUrl: "",
    ideAlias: "",
    idePort: 0,
    workspaceClass: undefined,
    ownerId: "",
    debugWorkspaceType: DebugWorkspaceType.noDebug,
  };
}

export const WorkspaceInfoResponse = {
  encode(message: WorkspaceInfoResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.workspaceId !== "") {
      writer.uint32(10).string(message.workspaceId);
    }
    if (message.instanceId !== "") {
      writer.uint32(18).string(message.instanceId);
    }
    if (message.checkoutLocation !== "") {
      writer.uint32(26).string(message.checkoutLocation);
    }
    if (message.workspaceLocationFile !== undefined) {
      writer.uint32(34).string(message.workspaceLocationFile);
    }
    if (message.workspaceLocationFolder !== undefined) {
      writer.uint32(42).string(message.workspaceLocationFolder);
    }
    if (message.userHome !== "") {
      writer.uint32(50).string(message.userHome);
    }
    if (message.gitpodApi !== undefined) {
      WorkspaceInfoResponse_GitpodAPI.encode(message.gitpodApi, writer.uint32(58).fork()).ldelim();
    }
    if (message.gitpodHost !== "") {
      writer.uint32(66).string(message.gitpodHost);
    }
    if (message.workspaceContextUrl !== "") {
      writer.uint32(74).string(message.workspaceContextUrl);
    }
    if (message.repository !== undefined) {
      WorkspaceInfoResponse_Repository.encode(message.repository, writer.uint32(82).fork()).ldelim();
    }
    if (message.workspaceClusterHost !== "") {
      writer.uint32(90).string(message.workspaceClusterHost);
    }
    if (message.workspaceUrl !== "") {
      writer.uint32(98).string(message.workspaceUrl);
    }
    if (message.ideAlias !== "") {
      writer.uint32(106).string(message.ideAlias);
    }
    if (message.idePort !== 0) {
      writer.uint32(112).uint32(message.idePort);
    }
    if (message.workspaceClass !== undefined) {
      WorkspaceInfoResponse_WorkspaceClass.encode(message.workspaceClass, writer.uint32(122).fork()).ldelim();
    }
    if (message.ownerId !== "") {
      writer.uint32(130).string(message.ownerId);
    }
    if (message.debugWorkspaceType !== DebugWorkspaceType.noDebug) {
      writer.uint32(136).int32(debugWorkspaceTypeToNumber(message.debugWorkspaceType));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WorkspaceInfoResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWorkspaceInfoResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.workspaceId = reader.string();
          break;
        case 2:
          message.instanceId = reader.string();
          break;
        case 3:
          message.checkoutLocation = reader.string();
          break;
        case 4:
          message.workspaceLocationFile = reader.string();
          break;
        case 5:
          message.workspaceLocationFolder = reader.string();
          break;
        case 6:
          message.userHome = reader.string();
          break;
        case 7:
          message.gitpodApi = WorkspaceInfoResponse_GitpodAPI.decode(reader, reader.uint32());
          break;
        case 8:
          message.gitpodHost = reader.string();
          break;
        case 9:
          message.workspaceContextUrl = reader.string();
          break;
        case 10:
          message.repository = WorkspaceInfoResponse_Repository.decode(reader, reader.uint32());
          break;
        case 11:
          message.workspaceClusterHost = reader.string();
          break;
        case 12:
          message.workspaceUrl = reader.string();
          break;
        case 13:
          message.ideAlias = reader.string();
          break;
        case 14:
          message.idePort = reader.uint32();
          break;
        case 15:
          message.workspaceClass = WorkspaceInfoResponse_WorkspaceClass.decode(reader, reader.uint32());
          break;
        case 16:
          message.ownerId = reader.string();
          break;
        case 17:
          message.debugWorkspaceType = debugWorkspaceTypeFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WorkspaceInfoResponse {
    return {
      workspaceId: isSet(object.workspaceId) ? String(object.workspaceId) : "",
      instanceId: isSet(object.instanceId) ? String(object.instanceId) : "",
      checkoutLocation: isSet(object.checkoutLocation) ? String(object.checkoutLocation) : "",
      workspaceLocationFile: isSet(object.workspaceLocationFile) ? String(object.workspaceLocationFile) : undefined,
      workspaceLocationFolder: isSet(object.workspaceLocationFolder)
        ? String(object.workspaceLocationFolder)
        : undefined,
      userHome: isSet(object.userHome) ? String(object.userHome) : "",
      gitpodApi: isSet(object.gitpodApi) ? WorkspaceInfoResponse_GitpodAPI.fromJSON(object.gitpodApi) : undefined,
      gitpodHost: isSet(object.gitpodHost) ? String(object.gitpodHost) : "",
      workspaceContextUrl: isSet(object.workspaceContextUrl) ? String(object.workspaceContextUrl) : "",
      repository: isSet(object.repository) ? WorkspaceInfoResponse_Repository.fromJSON(object.repository) : undefined,
      workspaceClusterHost: isSet(object.workspaceClusterHost) ? String(object.workspaceClusterHost) : "",
      workspaceUrl: isSet(object.workspaceUrl) ? String(object.workspaceUrl) : "",
      ideAlias: isSet(object.ideAlias) ? String(object.ideAlias) : "",
      idePort: isSet(object.idePort) ? Number(object.idePort) : 0,
      workspaceClass: isSet(object.workspaceClass)
        ? WorkspaceInfoResponse_WorkspaceClass.fromJSON(object.workspaceClass)
        : undefined,
      ownerId: isSet(object.ownerId) ? String(object.ownerId) : "",
      debugWorkspaceType: isSet(object.debugWorkspaceType)
        ? debugWorkspaceTypeFromJSON(object.debugWorkspaceType)
        : DebugWorkspaceType.noDebug,
    };
  },

  toJSON(message: WorkspaceInfoResponse): unknown {
    const obj: any = {};
    message.workspaceId !== undefined && (obj.workspaceId = message.workspaceId);
    message.instanceId !== undefined && (obj.instanceId = message.instanceId);
    message.checkoutLocation !== undefined && (obj.checkoutLocation = message.checkoutLocation);
    message.workspaceLocationFile !== undefined && (obj.workspaceLocationFile = message.workspaceLocationFile);
    message.workspaceLocationFolder !== undefined && (obj.workspaceLocationFolder = message.workspaceLocationFolder);
    message.userHome !== undefined && (obj.userHome = message.userHome);
    message.gitpodApi !== undefined &&
      (obj.gitpodApi = message.gitpodApi ? WorkspaceInfoResponse_GitpodAPI.toJSON(message.gitpodApi) : undefined);
    message.gitpodHost !== undefined && (obj.gitpodHost = message.gitpodHost);
    message.workspaceContextUrl !== undefined && (obj.workspaceContextUrl = message.workspaceContextUrl);
    message.repository !== undefined &&
      (obj.repository = message.repository ? WorkspaceInfoResponse_Repository.toJSON(message.repository) : undefined);
    message.workspaceClusterHost !== undefined && (obj.workspaceClusterHost = message.workspaceClusterHost);
    message.workspaceUrl !== undefined && (obj.workspaceUrl = message.workspaceUrl);
    message.ideAlias !== undefined && (obj.ideAlias = message.ideAlias);
    message.idePort !== undefined && (obj.idePort = Math.round(message.idePort));
    message.workspaceClass !== undefined && (obj.workspaceClass = message.workspaceClass
      ? WorkspaceInfoResponse_WorkspaceClass.toJSON(message.workspaceClass)
      : undefined);
    message.ownerId !== undefined && (obj.ownerId = message.ownerId);
    message.debugWorkspaceType !== undefined &&
      (obj.debugWorkspaceType = debugWorkspaceTypeToJSON(message.debugWorkspaceType));
    return obj;
  },

  fromPartial(object: DeepPartial<WorkspaceInfoResponse>): WorkspaceInfoResponse {
    const message = createBaseWorkspaceInfoResponse();
    message.workspaceId = object.workspaceId ?? "";
    message.instanceId = object.instanceId ?? "";
    message.checkoutLocation = object.checkoutLocation ?? "";
    message.workspaceLocationFile = object.workspaceLocationFile ?? undefined;
    message.workspaceLocationFolder = object.workspaceLocationFolder ?? undefined;
    message.userHome = object.userHome ?? "";
    message.gitpodApi = (object.gitpodApi !== undefined && object.gitpodApi !== null)
      ? WorkspaceInfoResponse_GitpodAPI.fromPartial(object.gitpodApi)
      : undefined;
    message.gitpodHost = object.gitpodHost ?? "";
    message.workspaceContextUrl = object.workspaceContextUrl ?? "";
    message.repository = (object.repository !== undefined && object.repository !== null)
      ? WorkspaceInfoResponse_Repository.fromPartial(object.repository)
      : undefined;
    message.workspaceClusterHost = object.workspaceClusterHost ?? "";
    message.workspaceUrl = object.workspaceUrl ?? "";
    message.ideAlias = object.ideAlias ?? "";
    message.idePort = object.idePort ?? 0;
    message.workspaceClass = (object.workspaceClass !== undefined && object.workspaceClass !== null)
      ? WorkspaceInfoResponse_WorkspaceClass.fromPartial(object.workspaceClass)
      : undefined;
    message.ownerId = object.ownerId ?? "";
    message.debugWorkspaceType = object.debugWorkspaceType ?? DebugWorkspaceType.noDebug;
    return message;
  },
};

function createBaseWorkspaceInfoResponse_GitpodAPI(): WorkspaceInfoResponse_GitpodAPI {
  return { endpoint: "", host: "" };
}

export const WorkspaceInfoResponse_GitpodAPI = {
  encode(message: WorkspaceInfoResponse_GitpodAPI, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.endpoint !== "") {
      writer.uint32(10).string(message.endpoint);
    }
    if (message.host !== "") {
      writer.uint32(18).string(message.host);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WorkspaceInfoResponse_GitpodAPI {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWorkspaceInfoResponse_GitpodAPI();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.endpoint = reader.string();
          break;
        case 2:
          message.host = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WorkspaceInfoResponse_GitpodAPI {
    return {
      endpoint: isSet(object.endpoint) ? String(object.endpoint) : "",
      host: isSet(object.host) ? String(object.host) : "",
    };
  },

  toJSON(message: WorkspaceInfoResponse_GitpodAPI): unknown {
    const obj: any = {};
    message.endpoint !== undefined && (obj.endpoint = message.endpoint);
    message.host !== undefined && (obj.host = message.host);
    return obj;
  },

  fromPartial(object: DeepPartial<WorkspaceInfoResponse_GitpodAPI>): WorkspaceInfoResponse_GitpodAPI {
    const message = createBaseWorkspaceInfoResponse_GitpodAPI();
    message.endpoint = object.endpoint ?? "";
    message.host = object.host ?? "";
    return message;
  },
};

function createBaseWorkspaceInfoResponse_Repository(): WorkspaceInfoResponse_Repository {
  return { owner: "", name: "" };
}

export const WorkspaceInfoResponse_Repository = {
  encode(message: WorkspaceInfoResponse_Repository, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.owner !== "") {
      writer.uint32(10).string(message.owner);
    }
    if (message.name !== "") {
      writer.uint32(18).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WorkspaceInfoResponse_Repository {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWorkspaceInfoResponse_Repository();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.owner = reader.string();
          break;
        case 2:
          message.name = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WorkspaceInfoResponse_Repository {
    return {
      owner: isSet(object.owner) ? String(object.owner) : "",
      name: isSet(object.name) ? String(object.name) : "",
    };
  },

  toJSON(message: WorkspaceInfoResponse_Repository): unknown {
    const obj: any = {};
    message.owner !== undefined && (obj.owner = message.owner);
    message.name !== undefined && (obj.name = message.name);
    return obj;
  },

  fromPartial(object: DeepPartial<WorkspaceInfoResponse_Repository>): WorkspaceInfoResponse_Repository {
    const message = createBaseWorkspaceInfoResponse_Repository();
    message.owner = object.owner ?? "";
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseWorkspaceInfoResponse_WorkspaceClass(): WorkspaceInfoResponse_WorkspaceClass {
  return { id: "", displayName: "", description: "" };
}

export const WorkspaceInfoResponse_WorkspaceClass = {
  encode(message: WorkspaceInfoResponse_WorkspaceClass, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.displayName !== "") {
      writer.uint32(18).string(message.displayName);
    }
    if (message.description !== "") {
      writer.uint32(26).string(message.description);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WorkspaceInfoResponse_WorkspaceClass {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWorkspaceInfoResponse_WorkspaceClass();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.displayName = reader.string();
          break;
        case 3:
          message.description = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WorkspaceInfoResponse_WorkspaceClass {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      displayName: isSet(object.displayName) ? String(object.displayName) : "",
      description: isSet(object.description) ? String(object.description) : "",
    };
  },

  toJSON(message: WorkspaceInfoResponse_WorkspaceClass): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.displayName !== undefined && (obj.displayName = message.displayName);
    message.description !== undefined && (obj.description = message.description);
    return obj;
  },

  fromPartial(object: DeepPartial<WorkspaceInfoResponse_WorkspaceClass>): WorkspaceInfoResponse_WorkspaceClass {
    const message = createBaseWorkspaceInfoResponse_WorkspaceClass();
    message.id = object.id ?? "";
    message.displayName = object.displayName ?? "";
    message.description = object.description ?? "";
    return message;
  },
};

export type InfoServiceDefinition = typeof InfoServiceDefinition;
export const InfoServiceDefinition = {
  name: "InfoService",
  fullName: "supervisor.InfoService",
  methods: {
    workspaceInfo: {
      name: "WorkspaceInfo",
      requestType: WorkspaceInfoRequest,
      requestStream: false,
      responseType: WorkspaceInfoResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface InfoServiceServiceImplementation<CallContextExt = {}> {
  workspaceInfo(
    request: WorkspaceInfoRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<WorkspaceInfoResponse>>;
}

export interface InfoServiceClient<CallOptionsExt = {}> {
  workspaceInfo(
    request: DeepPartial<WorkspaceInfoRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<WorkspaceInfoResponse>;
}

export interface DataLoaderOptions {
  cache?: boolean;
}

export interface DataLoaders {
  rpcDataLoaderOptions?: DataLoaderOptions;
  getDataLoader<T>(identifier: string, constructorFn: () => T): T;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
