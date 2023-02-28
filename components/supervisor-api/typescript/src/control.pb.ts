/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import {
  DebugWorkspaceType,
  debugWorkspaceTypeFromJSON,
  debugWorkspaceTypeToJSON,
  debugWorkspaceTypeToNumber,
} from "./info.pb";
import { ContentSource, contentSourceFromJSON, contentSourceToJSON, contentSourceToNumber } from "./status.pb";

export const protobufPackage = "supervisor";

export interface ExposePortRequest {
  /** local port */
  port: number;
}

export interface ExposePortResponse {
}

export interface CreateSSHKeyPairRequest {
}

export interface CreateSSHKeyPairResponse {
  /** Return privateKey for ws-proxy */
  privateKey: string;
}

export interface CreateDebugEnvRequest {
  /** workspace_type indicates whether it is a regular or prebuild workspace */
  workspaceType: DebugWorkspaceType;
  /** content_source indicates where the workspace content came from */
  contentSource: ContentSource;
  /** workspace_url is an URL for which the workspace is accessed. */
  workspaceUrl: string;
  /** JSON serialized tasks to run */
  tasks: string;
  /** checkout_location is the path where we initialized the workspace content */
  checkoutLocation: string;
  /** workspace_location is the location of the IDE workspace */
  workspaceLocation: string;
  /** logLevel to use in a debug workspace. */
  logLevel: string;
}

export interface CreateDebugEnvResponse {
  envs: string[];
}

function createBaseExposePortRequest(): ExposePortRequest {
  return { port: 0 };
}

export const ExposePortRequest = {
  encode(message: ExposePortRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.port !== 0) {
      writer.uint32(8).uint32(message.port);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ExposePortRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseExposePortRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.port = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ExposePortRequest {
    return { port: isSet(object.port) ? Number(object.port) : 0 };
  },

  toJSON(message: ExposePortRequest): unknown {
    const obj: any = {};
    message.port !== undefined && (obj.port = Math.round(message.port));
    return obj;
  },

  fromPartial(object: DeepPartial<ExposePortRequest>): ExposePortRequest {
    const message = createBaseExposePortRequest();
    message.port = object.port ?? 0;
    return message;
  },
};

function createBaseExposePortResponse(): ExposePortResponse {
  return {};
}

export const ExposePortResponse = {
  encode(_: ExposePortResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ExposePortResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseExposePortResponse();
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

  fromJSON(_: any): ExposePortResponse {
    return {};
  },

  toJSON(_: ExposePortResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ExposePortResponse>): ExposePortResponse {
    const message = createBaseExposePortResponse();
    return message;
  },
};

function createBaseCreateSSHKeyPairRequest(): CreateSSHKeyPairRequest {
  return {};
}

export const CreateSSHKeyPairRequest = {
  encode(_: CreateSSHKeyPairRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateSSHKeyPairRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateSSHKeyPairRequest();
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

  fromJSON(_: any): CreateSSHKeyPairRequest {
    return {};
  },

  toJSON(_: CreateSSHKeyPairRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<CreateSSHKeyPairRequest>): CreateSSHKeyPairRequest {
    const message = createBaseCreateSSHKeyPairRequest();
    return message;
  },
};

function createBaseCreateSSHKeyPairResponse(): CreateSSHKeyPairResponse {
  return { privateKey: "" };
}

export const CreateSSHKeyPairResponse = {
  encode(message: CreateSSHKeyPairResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.privateKey !== "") {
      writer.uint32(10).string(message.privateKey);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateSSHKeyPairResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateSSHKeyPairResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.privateKey = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateSSHKeyPairResponse {
    return { privateKey: isSet(object.privateKey) ? String(object.privateKey) : "" };
  },

  toJSON(message: CreateSSHKeyPairResponse): unknown {
    const obj: any = {};
    message.privateKey !== undefined && (obj.privateKey = message.privateKey);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateSSHKeyPairResponse>): CreateSSHKeyPairResponse {
    const message = createBaseCreateSSHKeyPairResponse();
    message.privateKey = object.privateKey ?? "";
    return message;
  },
};

function createBaseCreateDebugEnvRequest(): CreateDebugEnvRequest {
  return {
    workspaceType: DebugWorkspaceType.noDebug,
    contentSource: ContentSource.from_other,
    workspaceUrl: "",
    tasks: "",
    checkoutLocation: "",
    workspaceLocation: "",
    logLevel: "",
  };
}

export const CreateDebugEnvRequest = {
  encode(message: CreateDebugEnvRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.workspaceType !== DebugWorkspaceType.noDebug) {
      writer.uint32(8).int32(debugWorkspaceTypeToNumber(message.workspaceType));
    }
    if (message.contentSource !== ContentSource.from_other) {
      writer.uint32(16).int32(contentSourceToNumber(message.contentSource));
    }
    if (message.workspaceUrl !== "") {
      writer.uint32(26).string(message.workspaceUrl);
    }
    if (message.tasks !== "") {
      writer.uint32(34).string(message.tasks);
    }
    if (message.checkoutLocation !== "") {
      writer.uint32(42).string(message.checkoutLocation);
    }
    if (message.workspaceLocation !== "") {
      writer.uint32(50).string(message.workspaceLocation);
    }
    if (message.logLevel !== "") {
      writer.uint32(58).string(message.logLevel);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateDebugEnvRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateDebugEnvRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.workspaceType = debugWorkspaceTypeFromJSON(reader.int32());
          break;
        case 2:
          message.contentSource = contentSourceFromJSON(reader.int32());
          break;
        case 3:
          message.workspaceUrl = reader.string();
          break;
        case 4:
          message.tasks = reader.string();
          break;
        case 5:
          message.checkoutLocation = reader.string();
          break;
        case 6:
          message.workspaceLocation = reader.string();
          break;
        case 7:
          message.logLevel = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateDebugEnvRequest {
    return {
      workspaceType: isSet(object.workspaceType)
        ? debugWorkspaceTypeFromJSON(object.workspaceType)
        : DebugWorkspaceType.noDebug,
      contentSource: isSet(object.contentSource)
        ? contentSourceFromJSON(object.contentSource)
        : ContentSource.from_other,
      workspaceUrl: isSet(object.workspaceUrl) ? String(object.workspaceUrl) : "",
      tasks: isSet(object.tasks) ? String(object.tasks) : "",
      checkoutLocation: isSet(object.checkoutLocation) ? String(object.checkoutLocation) : "",
      workspaceLocation: isSet(object.workspaceLocation) ? String(object.workspaceLocation) : "",
      logLevel: isSet(object.logLevel) ? String(object.logLevel) : "",
    };
  },

  toJSON(message: CreateDebugEnvRequest): unknown {
    const obj: any = {};
    message.workspaceType !== undefined && (obj.workspaceType = debugWorkspaceTypeToJSON(message.workspaceType));
    message.contentSource !== undefined && (obj.contentSource = contentSourceToJSON(message.contentSource));
    message.workspaceUrl !== undefined && (obj.workspaceUrl = message.workspaceUrl);
    message.tasks !== undefined && (obj.tasks = message.tasks);
    message.checkoutLocation !== undefined && (obj.checkoutLocation = message.checkoutLocation);
    message.workspaceLocation !== undefined && (obj.workspaceLocation = message.workspaceLocation);
    message.logLevel !== undefined && (obj.logLevel = message.logLevel);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateDebugEnvRequest>): CreateDebugEnvRequest {
    const message = createBaseCreateDebugEnvRequest();
    message.workspaceType = object.workspaceType ?? DebugWorkspaceType.noDebug;
    message.contentSource = object.contentSource ?? ContentSource.from_other;
    message.workspaceUrl = object.workspaceUrl ?? "";
    message.tasks = object.tasks ?? "";
    message.checkoutLocation = object.checkoutLocation ?? "";
    message.workspaceLocation = object.workspaceLocation ?? "";
    message.logLevel = object.logLevel ?? "";
    return message;
  },
};

function createBaseCreateDebugEnvResponse(): CreateDebugEnvResponse {
  return { envs: [] };
}

export const CreateDebugEnvResponse = {
  encode(message: CreateDebugEnvResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.envs) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateDebugEnvResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateDebugEnvResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.envs.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateDebugEnvResponse {
    return { envs: Array.isArray(object?.envs) ? object.envs.map((e: any) => String(e)) : [] };
  },

  toJSON(message: CreateDebugEnvResponse): unknown {
    const obj: any = {};
    if (message.envs) {
      obj.envs = message.envs.map((e) => e);
    } else {
      obj.envs = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<CreateDebugEnvResponse>): CreateDebugEnvResponse {
    const message = createBaseCreateDebugEnvResponse();
    message.envs = object.envs?.map((e) => e) || [];
    return message;
  },
};

/** ControlService provides workspace-facing, misc control related services */
export type ControlServiceDefinition = typeof ControlServiceDefinition;
export const ControlServiceDefinition = {
  name: "ControlService",
  fullName: "supervisor.ControlService",
  methods: {
    /** ExposePort exposes a port */
    exposePort: {
      name: "ExposePort",
      requestType: ExposePortRequest,
      requestStream: false,
      responseType: ExposePortResponse,
      responseStream: false,
      options: {},
    },
    /** CreateSSHKeyPair Create a pair of SSH Keys and put them in ~/.ssh/authorized_keys, this will only be generated once in the entire workspace lifecycle */
    createSSHKeyPair: {
      name: "CreateSSHKeyPair",
      requestType: CreateSSHKeyPairRequest,
      requestStream: false,
      responseType: CreateSSHKeyPairResponse,
      responseStream: false,
      options: {},
    },
    /** CreateDebugEnv creates a debug workspace envs */
    createDebugEnv: {
      name: "CreateDebugEnv",
      requestType: CreateDebugEnvRequest,
      requestStream: false,
      responseType: CreateDebugEnvResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface ControlServiceServiceImplementation<CallContextExt = {}> {
  /** ExposePort exposes a port */
  exposePort(
    request: ExposePortRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ExposePortResponse>>;
  /** CreateSSHKeyPair Create a pair of SSH Keys and put them in ~/.ssh/authorized_keys, this will only be generated once in the entire workspace lifecycle */
  createSSHKeyPair(
    request: CreateSSHKeyPairRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateSSHKeyPairResponse>>;
  /** CreateDebugEnv creates a debug workspace envs */
  createDebugEnv(
    request: CreateDebugEnvRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateDebugEnvResponse>>;
}

export interface ControlServiceClient<CallOptionsExt = {}> {
  /** ExposePort exposes a port */
  exposePort(
    request: DeepPartial<ExposePortRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ExposePortResponse>;
  /** CreateSSHKeyPair Create a pair of SSH Keys and put them in ~/.ssh/authorized_keys, this will only be generated once in the entire workspace lifecycle */
  createSSHKeyPair(
    request: DeepPartial<CreateSSHKeyPairRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateSSHKeyPairResponse>;
  /** CreateDebugEnv creates a debug workspace envs */
  createDebugEnv(
    request: DeepPartial<CreateDebugEnvRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateDebugEnvResponse>;
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
