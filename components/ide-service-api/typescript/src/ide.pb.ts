/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "ide_service_api";

export enum WorkspaceType {
  REGULAR = "REGULAR",
  PREBUILD = "PREBUILD",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function workspaceTypeFromJSON(object: any): WorkspaceType {
  switch (object) {
    case 0:
    case "REGULAR":
      return WorkspaceType.REGULAR;
    case 1:
    case "PREBUILD":
      return WorkspaceType.PREBUILD;
    case -1:
    case "UNRECOGNIZED":
    default:
      return WorkspaceType.UNRECOGNIZED;
  }
}

export function workspaceTypeToJSON(object: WorkspaceType): string {
  switch (object) {
    case WorkspaceType.REGULAR:
      return "REGULAR";
    case WorkspaceType.PREBUILD:
      return "PREBUILD";
    case WorkspaceType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function workspaceTypeToNumber(object: WorkspaceType): number {
  switch (object) {
    case WorkspaceType.REGULAR:
      return 0;
    case WorkspaceType.PREBUILD:
      return 1;
    case WorkspaceType.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface GetConfigRequest {
  user: User | undefined;
}

export interface GetConfigResponse {
  content: string;
}

/**
 * TODO: import type from other packages
 * EnvironmentVariable describes an env var as key/value pair
 */
export interface EnvironmentVariable {
  name: string;
  value: string;
}

export interface User {
  id: string;
  email?: string | undefined;
}

export interface ResolveWorkspaceConfigRequest {
  type: WorkspaceType;
  context: string;
  ideSettings: string;
  workspaceConfig: string;
  user: User | undefined;
}

export interface ResolveWorkspaceConfigResponse {
  envvars: EnvironmentVariable[];
  supervisorImage: string;
  webImage: string;
  ideImageLayers: string[];
  /** control whether to configure default IDE for a user */
  refererIde: string;
  tasks: string;
  ideSettings: string;
}

function createBaseGetConfigRequest(): GetConfigRequest {
  return { user: undefined };
}

export const GetConfigRequest = {
  encode(message: GetConfigRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetConfigRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetConfigRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.user = User.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetConfigRequest {
    return { user: isSet(object.user) ? User.fromJSON(object.user) : undefined };
  },

  toJSON(message: GetConfigRequest): unknown {
    const obj: any = {};
    message.user !== undefined && (obj.user = message.user ? User.toJSON(message.user) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<GetConfigRequest>): GetConfigRequest {
    const message = createBaseGetConfigRequest();
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseGetConfigResponse(): GetConfigResponse {
  return { content: "" };
}

export const GetConfigResponse = {
  encode(message: GetConfigResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.content !== "") {
      writer.uint32(10).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetConfigResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetConfigResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.content = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetConfigResponse {
    return { content: isSet(object.content) ? String(object.content) : "" };
  },

  toJSON(message: GetConfigResponse): unknown {
    const obj: any = {};
    message.content !== undefined && (obj.content = message.content);
    return obj;
  },

  fromPartial(object: DeepPartial<GetConfigResponse>): GetConfigResponse {
    const message = createBaseGetConfigResponse();
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseEnvironmentVariable(): EnvironmentVariable {
  return { name: "", value: "" };
}

export const EnvironmentVariable = {
  encode(message: EnvironmentVariable, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EnvironmentVariable {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEnvironmentVariable();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        case 2:
          message.value = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): EnvironmentVariable {
    return {
      name: isSet(object.name) ? String(object.name) : "",
      value: isSet(object.value) ? String(object.value) : "",
    };
  },

  toJSON(message: EnvironmentVariable): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    message.value !== undefined && (obj.value = message.value);
    return obj;
  },

  fromPartial(object: DeepPartial<EnvironmentVariable>): EnvironmentVariable {
    const message = createBaseEnvironmentVariable();
    message.name = object.name ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseUser(): User {
  return { id: "", email: undefined };
}

export const User = {
  encode(message: User, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.email !== undefined) {
      writer.uint32(18).string(message.email);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): User {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUser();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.email = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): User {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      email: isSet(object.email) ? String(object.email) : undefined,
    };
  },

  toJSON(message: User): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.email !== undefined && (obj.email = message.email);
    return obj;
  },

  fromPartial(object: DeepPartial<User>): User {
    const message = createBaseUser();
    message.id = object.id ?? "";
    message.email = object.email ?? undefined;
    return message;
  },
};

function createBaseResolveWorkspaceConfigRequest(): ResolveWorkspaceConfigRequest {
  return { type: WorkspaceType.REGULAR, context: "", ideSettings: "", workspaceConfig: "", user: undefined };
}

export const ResolveWorkspaceConfigRequest = {
  encode(message: ResolveWorkspaceConfigRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.type !== WorkspaceType.REGULAR) {
      writer.uint32(8).int32(workspaceTypeToNumber(message.type));
    }
    if (message.context !== "") {
      writer.uint32(18).string(message.context);
    }
    if (message.ideSettings !== "") {
      writer.uint32(26).string(message.ideSettings);
    }
    if (message.workspaceConfig !== "") {
      writer.uint32(34).string(message.workspaceConfig);
    }
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResolveWorkspaceConfigRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResolveWorkspaceConfigRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.type = workspaceTypeFromJSON(reader.int32());
          break;
        case 2:
          message.context = reader.string();
          break;
        case 3:
          message.ideSettings = reader.string();
          break;
        case 4:
          message.workspaceConfig = reader.string();
          break;
        case 5:
          message.user = User.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ResolveWorkspaceConfigRequest {
    return {
      type: isSet(object.type) ? workspaceTypeFromJSON(object.type) : WorkspaceType.REGULAR,
      context: isSet(object.context) ? String(object.context) : "",
      ideSettings: isSet(object.ideSettings) ? String(object.ideSettings) : "",
      workspaceConfig: isSet(object.workspaceConfig) ? String(object.workspaceConfig) : "",
      user: isSet(object.user) ? User.fromJSON(object.user) : undefined,
    };
  },

  toJSON(message: ResolveWorkspaceConfigRequest): unknown {
    const obj: any = {};
    message.type !== undefined && (obj.type = workspaceTypeToJSON(message.type));
    message.context !== undefined && (obj.context = message.context);
    message.ideSettings !== undefined && (obj.ideSettings = message.ideSettings);
    message.workspaceConfig !== undefined && (obj.workspaceConfig = message.workspaceConfig);
    message.user !== undefined && (obj.user = message.user ? User.toJSON(message.user) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ResolveWorkspaceConfigRequest>): ResolveWorkspaceConfigRequest {
    const message = createBaseResolveWorkspaceConfigRequest();
    message.type = object.type ?? WorkspaceType.REGULAR;
    message.context = object.context ?? "";
    message.ideSettings = object.ideSettings ?? "";
    message.workspaceConfig = object.workspaceConfig ?? "";
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseResolveWorkspaceConfigResponse(): ResolveWorkspaceConfigResponse {
  return {
    envvars: [],
    supervisorImage: "",
    webImage: "",
    ideImageLayers: [],
    refererIde: "",
    tasks: "",
    ideSettings: "",
  };
}

export const ResolveWorkspaceConfigResponse = {
  encode(message: ResolveWorkspaceConfigResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.envvars) {
      EnvironmentVariable.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.supervisorImage !== "") {
      writer.uint32(18).string(message.supervisorImage);
    }
    if (message.webImage !== "") {
      writer.uint32(26).string(message.webImage);
    }
    for (const v of message.ideImageLayers) {
      writer.uint32(34).string(v!);
    }
    if (message.refererIde !== "") {
      writer.uint32(42).string(message.refererIde);
    }
    if (message.tasks !== "") {
      writer.uint32(50).string(message.tasks);
    }
    if (message.ideSettings !== "") {
      writer.uint32(58).string(message.ideSettings);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResolveWorkspaceConfigResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResolveWorkspaceConfigResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.envvars.push(EnvironmentVariable.decode(reader, reader.uint32()));
          break;
        case 2:
          message.supervisorImage = reader.string();
          break;
        case 3:
          message.webImage = reader.string();
          break;
        case 4:
          message.ideImageLayers.push(reader.string());
          break;
        case 5:
          message.refererIde = reader.string();
          break;
        case 6:
          message.tasks = reader.string();
          break;
        case 7:
          message.ideSettings = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ResolveWorkspaceConfigResponse {
    return {
      envvars: Array.isArray(object?.envvars) ? object.envvars.map((e: any) => EnvironmentVariable.fromJSON(e)) : [],
      supervisorImage: isSet(object.supervisorImage) ? String(object.supervisorImage) : "",
      webImage: isSet(object.webImage) ? String(object.webImage) : "",
      ideImageLayers: Array.isArray(object?.ideImageLayers) ? object.ideImageLayers.map((e: any) => String(e)) : [],
      refererIde: isSet(object.refererIde) ? String(object.refererIde) : "",
      tasks: isSet(object.tasks) ? String(object.tasks) : "",
      ideSettings: isSet(object.ideSettings) ? String(object.ideSettings) : "",
    };
  },

  toJSON(message: ResolveWorkspaceConfigResponse): unknown {
    const obj: any = {};
    if (message.envvars) {
      obj.envvars = message.envvars.map((e) => e ? EnvironmentVariable.toJSON(e) : undefined);
    } else {
      obj.envvars = [];
    }
    message.supervisorImage !== undefined && (obj.supervisorImage = message.supervisorImage);
    message.webImage !== undefined && (obj.webImage = message.webImage);
    if (message.ideImageLayers) {
      obj.ideImageLayers = message.ideImageLayers.map((e) => e);
    } else {
      obj.ideImageLayers = [];
    }
    message.refererIde !== undefined && (obj.refererIde = message.refererIde);
    message.tasks !== undefined && (obj.tasks = message.tasks);
    message.ideSettings !== undefined && (obj.ideSettings = message.ideSettings);
    return obj;
  },

  fromPartial(object: DeepPartial<ResolveWorkspaceConfigResponse>): ResolveWorkspaceConfigResponse {
    const message = createBaseResolveWorkspaceConfigResponse();
    message.envvars = object.envvars?.map((e) => EnvironmentVariable.fromPartial(e)) || [];
    message.supervisorImage = object.supervisorImage ?? "";
    message.webImage = object.webImage ?? "";
    message.ideImageLayers = object.ideImageLayers?.map((e) => e) || [];
    message.refererIde = object.refererIde ?? "";
    message.tasks = object.tasks ?? "";
    message.ideSettings = object.ideSettings ?? "";
    return message;
  },
};

export type IDEServiceDefinition = typeof IDEServiceDefinition;
export const IDEServiceDefinition = {
  name: "IDEService",
  fullName: "ide_service_api.IDEService",
  methods: {
    getConfig: {
      name: "GetConfig",
      requestType: GetConfigRequest,
      requestStream: false,
      responseType: GetConfigResponse,
      responseStream: false,
      options: { idempotencyLevel: "IDEMPOTENT" },
    },
    resolveWorkspaceConfig: {
      name: "ResolveWorkspaceConfig",
      requestType: ResolveWorkspaceConfigRequest,
      requestStream: false,
      responseType: ResolveWorkspaceConfigResponse,
      responseStream: false,
      options: { idempotencyLevel: "IDEMPOTENT" },
    },
  },
} as const;

export interface IDEServiceServiceImplementation<CallContextExt = {}> {
  getConfig(request: GetConfigRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetConfigResponse>>;
  resolveWorkspaceConfig(
    request: ResolveWorkspaceConfigRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ResolveWorkspaceConfigResponse>>;
}

export interface IDEServiceClient<CallOptionsExt = {}> {
  getConfig(request: DeepPartial<GetConfigRequest>, options?: CallOptions & CallOptionsExt): Promise<GetConfigResponse>;
  resolveWorkspaceConfig(
    request: DeepPartial<ResolveWorkspaceConfigRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ResolveWorkspaceConfigResponse>;
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
