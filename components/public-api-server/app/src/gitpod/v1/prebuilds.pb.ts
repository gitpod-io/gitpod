/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { WorkspaceContext } from "./workspaces.pb";

export const protobufPackage = "gitpod.v1";

export interface GetPrebuildRequest {
  prebuildId: string;
}

export interface GetPrebuildResponse {
  prebuild: Prebuild | undefined;
}

export interface GetRunningPrebuildRequest {
  contextUrl: string;
}

export interface GetRunningPrebuildResponse {
  prebuild: Prebuild | undefined;
}

export interface ListenToPrebuildStatusRequest {
  prebuildId: string;
}

export interface ListenToPrebuildStatusResponse {
  status: PrebuildStatus | undefined;
}

export interface ListenToPrebuildLogsRequest {
  prebuildId: string;
}

export interface ListenToPrebuildLogsResponse {
  line: string;
}

/** Prebuild describes a prebuild */
export interface Prebuild {
  prebuildId: string;
  spec: PrebuildSpec | undefined;
  status: PrebuildStatus | undefined;
}

/** PrebuildSpec specifies the prebuild input. */
export interface PrebuildSpec {
  context:
    | WorkspaceContext
    | undefined;
  /**
   * Incremental prebuilds are based on other prebuilds. If this field is true,
   * expect the context detail to point to another prebuild.
   */
  incremental: boolean;
}

/** PrebuildStatus describes the prebuild status. */
export interface PrebuildStatus {
  /** Phase is the prebuild phase we're in */
  phase: PrebuildStatus_Phase;
  /**
   * Result indicates what result the prebuild produced, i.e. if it ran
   * successfully or failed for some reason. If phase != done, this field
   * will have RESULT_UNSPECIFIED as value.
   */
  result: PrebuildStatus_Result;
  /**
   * result_message contains a human readable message describing the prebuild
   * result. E.g. if teh result is SYSTEM_FAILURE, the message describes what
   * that failure was.
   */
  resultMessage: string;
}

export enum PrebuildStatus_Phase {
  PHASE_UNSPECIFIED = "PHASE_UNSPECIFIED",
  PHASE_PENDING = "PHASE_PENDING",
  PHASE_RUNNING = "PHASE_RUNNING",
  PHASE_DONE = "PHASE_DONE",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function prebuildStatus_PhaseFromJSON(object: any): PrebuildStatus_Phase {
  switch (object) {
    case 0:
    case "PHASE_UNSPECIFIED":
      return PrebuildStatus_Phase.PHASE_UNSPECIFIED;
    case 1:
    case "PHASE_PENDING":
      return PrebuildStatus_Phase.PHASE_PENDING;
    case 2:
    case "PHASE_RUNNING":
      return PrebuildStatus_Phase.PHASE_RUNNING;
    case 3:
    case "PHASE_DONE":
      return PrebuildStatus_Phase.PHASE_DONE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PrebuildStatus_Phase.UNRECOGNIZED;
  }
}

export function prebuildStatus_PhaseToNumber(object: PrebuildStatus_Phase): number {
  switch (object) {
    case PrebuildStatus_Phase.PHASE_UNSPECIFIED:
      return 0;
    case PrebuildStatus_Phase.PHASE_PENDING:
      return 1;
    case PrebuildStatus_Phase.PHASE_RUNNING:
      return 2;
    case PrebuildStatus_Phase.PHASE_DONE:
      return 3;
    case PrebuildStatus_Phase.UNRECOGNIZED:
    default:
      return -1;
  }
}

export enum PrebuildStatus_Result {
  RESULT_UNSPECIFIED = "RESULT_UNSPECIFIED",
  RESULT_SUCCESS = "RESULT_SUCCESS",
  RESULT_USER_CANCELED = "RESULT_USER_CANCELED",
  RESULT_SYSTEM_FAILURE = "RESULT_SYSTEM_FAILURE",
  RESULT_TASK_FAILURE = "RESULT_TASK_FAILURE",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function prebuildStatus_ResultFromJSON(object: any): PrebuildStatus_Result {
  switch (object) {
    case 0:
    case "RESULT_UNSPECIFIED":
      return PrebuildStatus_Result.RESULT_UNSPECIFIED;
    case 1:
    case "RESULT_SUCCESS":
      return PrebuildStatus_Result.RESULT_SUCCESS;
    case 2:
    case "RESULT_USER_CANCELED":
      return PrebuildStatus_Result.RESULT_USER_CANCELED;
    case 3:
    case "RESULT_SYSTEM_FAILURE":
      return PrebuildStatus_Result.RESULT_SYSTEM_FAILURE;
    case 4:
    case "RESULT_TASK_FAILURE":
      return PrebuildStatus_Result.RESULT_TASK_FAILURE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PrebuildStatus_Result.UNRECOGNIZED;
  }
}

export function prebuildStatus_ResultToNumber(object: PrebuildStatus_Result): number {
  switch (object) {
    case PrebuildStatus_Result.RESULT_UNSPECIFIED:
      return 0;
    case PrebuildStatus_Result.RESULT_SUCCESS:
      return 1;
    case PrebuildStatus_Result.RESULT_USER_CANCELED:
      return 2;
    case PrebuildStatus_Result.RESULT_SYSTEM_FAILURE:
      return 3;
    case PrebuildStatus_Result.RESULT_TASK_FAILURE:
      return 4;
    case PrebuildStatus_Result.UNRECOGNIZED:
    default:
      return -1;
  }
}

function createBaseGetPrebuildRequest(): GetPrebuildRequest {
  return { prebuildId: "" };
}

export const GetPrebuildRequest = {
  encode(message: GetPrebuildRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prebuildId !== "") {
      writer.uint32(10).string(message.prebuildId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetPrebuildRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetPrebuildRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prebuildId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<GetPrebuildRequest>): GetPrebuildRequest {
    const message = createBaseGetPrebuildRequest();
    message.prebuildId = object.prebuildId ?? "";
    return message;
  },
};

function createBaseGetPrebuildResponse(): GetPrebuildResponse {
  return { prebuild: undefined };
}

export const GetPrebuildResponse = {
  encode(message: GetPrebuildResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prebuild !== undefined) {
      Prebuild.encode(message.prebuild, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetPrebuildResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetPrebuildResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prebuild = Prebuild.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<GetPrebuildResponse>): GetPrebuildResponse {
    const message = createBaseGetPrebuildResponse();
    message.prebuild = (object.prebuild !== undefined && object.prebuild !== null)
      ? Prebuild.fromPartial(object.prebuild)
      : undefined;
    return message;
  },
};

function createBaseGetRunningPrebuildRequest(): GetRunningPrebuildRequest {
  return { contextUrl: "" };
}

export const GetRunningPrebuildRequest = {
  encode(message: GetRunningPrebuildRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.contextUrl !== "") {
      writer.uint32(10).string(message.contextUrl);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetRunningPrebuildRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetRunningPrebuildRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.contextUrl = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<GetRunningPrebuildRequest>): GetRunningPrebuildRequest {
    const message = createBaseGetRunningPrebuildRequest();
    message.contextUrl = object.contextUrl ?? "";
    return message;
  },
};

function createBaseGetRunningPrebuildResponse(): GetRunningPrebuildResponse {
  return { prebuild: undefined };
}

export const GetRunningPrebuildResponse = {
  encode(message: GetRunningPrebuildResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prebuild !== undefined) {
      Prebuild.encode(message.prebuild, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetRunningPrebuildResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetRunningPrebuildResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prebuild = Prebuild.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<GetRunningPrebuildResponse>): GetRunningPrebuildResponse {
    const message = createBaseGetRunningPrebuildResponse();
    message.prebuild = (object.prebuild !== undefined && object.prebuild !== null)
      ? Prebuild.fromPartial(object.prebuild)
      : undefined;
    return message;
  },
};

function createBaseListenToPrebuildStatusRequest(): ListenToPrebuildStatusRequest {
  return { prebuildId: "" };
}

export const ListenToPrebuildStatusRequest = {
  encode(message: ListenToPrebuildStatusRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prebuildId !== "") {
      writer.uint32(10).string(message.prebuildId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListenToPrebuildStatusRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListenToPrebuildStatusRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prebuildId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<ListenToPrebuildStatusRequest>): ListenToPrebuildStatusRequest {
    const message = createBaseListenToPrebuildStatusRequest();
    message.prebuildId = object.prebuildId ?? "";
    return message;
  },
};

function createBaseListenToPrebuildStatusResponse(): ListenToPrebuildStatusResponse {
  return { status: undefined };
}

export const ListenToPrebuildStatusResponse = {
  encode(message: ListenToPrebuildStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.status !== undefined) {
      PrebuildStatus.encode(message.status, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListenToPrebuildStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListenToPrebuildStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.status = PrebuildStatus.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<ListenToPrebuildStatusResponse>): ListenToPrebuildStatusResponse {
    const message = createBaseListenToPrebuildStatusResponse();
    message.status = (object.status !== undefined && object.status !== null)
      ? PrebuildStatus.fromPartial(object.status)
      : undefined;
    return message;
  },
};

function createBaseListenToPrebuildLogsRequest(): ListenToPrebuildLogsRequest {
  return { prebuildId: "" };
}

export const ListenToPrebuildLogsRequest = {
  encode(message: ListenToPrebuildLogsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prebuildId !== "") {
      writer.uint32(10).string(message.prebuildId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListenToPrebuildLogsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListenToPrebuildLogsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prebuildId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<ListenToPrebuildLogsRequest>): ListenToPrebuildLogsRequest {
    const message = createBaseListenToPrebuildLogsRequest();
    message.prebuildId = object.prebuildId ?? "";
    return message;
  },
};

function createBaseListenToPrebuildLogsResponse(): ListenToPrebuildLogsResponse {
  return { line: "" };
}

export const ListenToPrebuildLogsResponse = {
  encode(message: ListenToPrebuildLogsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.line !== "") {
      writer.uint32(10).string(message.line);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListenToPrebuildLogsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListenToPrebuildLogsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.line = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<ListenToPrebuildLogsResponse>): ListenToPrebuildLogsResponse {
    const message = createBaseListenToPrebuildLogsResponse();
    message.line = object.line ?? "";
    return message;
  },
};

function createBasePrebuild(): Prebuild {
  return { prebuildId: "", spec: undefined, status: undefined };
}

export const Prebuild = {
  encode(message: Prebuild, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prebuildId !== "") {
      writer.uint32(10).string(message.prebuildId);
    }
    if (message.spec !== undefined) {
      PrebuildSpec.encode(message.spec, writer.uint32(18).fork()).ldelim();
    }
    if (message.status !== undefined) {
      PrebuildStatus.encode(message.status, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Prebuild {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePrebuild();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prebuildId = reader.string();
          break;
        case 2:
          message.spec = PrebuildSpec.decode(reader, reader.uint32());
          break;
        case 3:
          message.status = PrebuildStatus.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<Prebuild>): Prebuild {
    const message = createBasePrebuild();
    message.prebuildId = object.prebuildId ?? "";
    message.spec = (object.spec !== undefined && object.spec !== null)
      ? PrebuildSpec.fromPartial(object.spec)
      : undefined;
    message.status = (object.status !== undefined && object.status !== null)
      ? PrebuildStatus.fromPartial(object.status)
      : undefined;
    return message;
  },
};

function createBasePrebuildSpec(): PrebuildSpec {
  return { context: undefined, incremental: false };
}

export const PrebuildSpec = {
  encode(message: PrebuildSpec, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.context !== undefined) {
      WorkspaceContext.encode(message.context, writer.uint32(10).fork()).ldelim();
    }
    if (message.incremental === true) {
      writer.uint32(16).bool(message.incremental);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PrebuildSpec {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePrebuildSpec();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.context = WorkspaceContext.decode(reader, reader.uint32());
          break;
        case 2:
          message.incremental = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<PrebuildSpec>): PrebuildSpec {
    const message = createBasePrebuildSpec();
    message.context = (object.context !== undefined && object.context !== null)
      ? WorkspaceContext.fromPartial(object.context)
      : undefined;
    message.incremental = object.incremental ?? false;
    return message;
  },
};

function createBasePrebuildStatus(): PrebuildStatus {
  return {
    phase: PrebuildStatus_Phase.PHASE_UNSPECIFIED,
    result: PrebuildStatus_Result.RESULT_UNSPECIFIED,
    resultMessage: "",
  };
}

export const PrebuildStatus = {
  encode(message: PrebuildStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.phase !== PrebuildStatus_Phase.PHASE_UNSPECIFIED) {
      writer.uint32(8).int32(prebuildStatus_PhaseToNumber(message.phase));
    }
    if (message.result !== PrebuildStatus_Result.RESULT_UNSPECIFIED) {
      writer.uint32(16).int32(prebuildStatus_ResultToNumber(message.result));
    }
    if (message.resultMessage !== "") {
      writer.uint32(26).string(message.resultMessage);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PrebuildStatus {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePrebuildStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.phase = prebuildStatus_PhaseFromJSON(reader.int32());
          break;
        case 2:
          message.result = prebuildStatus_ResultFromJSON(reader.int32());
          break;
        case 3:
          message.resultMessage = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromPartial(object: DeepPartial<PrebuildStatus>): PrebuildStatus {
    const message = createBasePrebuildStatus();
    message.phase = object.phase ?? PrebuildStatus_Phase.PHASE_UNSPECIFIED;
    message.result = object.result ?? PrebuildStatus_Result.RESULT_UNSPECIFIED;
    message.resultMessage = object.resultMessage ?? "";
    return message;
  },
};

export type PrebuildsServiceDefinition = typeof PrebuildsServiceDefinition;
export const PrebuildsServiceDefinition = {
  name: "PrebuildsService",
  fullName: "gitpod.v1.PrebuildsService",
  methods: {
    /**
     * GetPrebuild retrieves a single rebuild.
     * Errors:
     *   NOT_FOUND if the prebuild_id does not exist
     */
    getPrebuild: {
      name: "GetPrebuild",
      requestType: GetPrebuildRequest,
      requestStream: false,
      responseType: GetPrebuildResponse,
      responseStream: false,
      options: {},
    },
    /**
     * GetRunningPrebuild returns the prebuild ID of a running prebuild,
     * or NOT_FOUND if there is no prebuild running for the content_url.
     */
    getRunningPrebuild: {
      name: "GetRunningPrebuild",
      requestType: GetRunningPrebuildRequest,
      requestStream: false,
      responseType: GetRunningPrebuildResponse,
      responseStream: false,
      options: {},
    },
    /**
     * ListenToPrebuildStatus streams status updates for a prebuild. If the prebuild is already
     * in the Done phase, only that single status is streamed.
     */
    listenToPrebuildStatus: {
      name: "ListenToPrebuildStatus",
      requestType: ListenToPrebuildStatusRequest,
      requestStream: false,
      responseType: ListenToPrebuildStatusResponse,
      responseStream: true,
      options: {},
    },
    /**
     * ListenToPrebuildLogs returns the log output of a prebuild.
     * This does NOT include an image build if one happened.
     */
    listenToPrebuildLogs: {
      name: "ListenToPrebuildLogs",
      requestType: ListenToPrebuildLogsRequest,
      requestStream: false,
      responseType: ListenToPrebuildLogsResponse,
      responseStream: true,
      options: {},
    },
  },
} as const;

export interface PrebuildsServiceServiceImplementation<CallContextExt = {}> {
  /**
   * GetPrebuild retrieves a single rebuild.
   * Errors:
   *   NOT_FOUND if the prebuild_id does not exist
   */
  getPrebuild(
    request: GetPrebuildRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetPrebuildResponse>>;
  /**
   * GetRunningPrebuild returns the prebuild ID of a running prebuild,
   * or NOT_FOUND if there is no prebuild running for the content_url.
   */
  getRunningPrebuild(
    request: GetRunningPrebuildRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetRunningPrebuildResponse>>;
  /**
   * ListenToPrebuildStatus streams status updates for a prebuild. If the prebuild is already
   * in the Done phase, only that single status is streamed.
   */
  listenToPrebuildStatus(
    request: ListenToPrebuildStatusRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<ListenToPrebuildStatusResponse>>;
  /**
   * ListenToPrebuildLogs returns the log output of a prebuild.
   * This does NOT include an image build if one happened.
   */
  listenToPrebuildLogs(
    request: ListenToPrebuildLogsRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<ListenToPrebuildLogsResponse>>;
}

export interface PrebuildsServiceClient<CallOptionsExt = {}> {
  /**
   * GetPrebuild retrieves a single rebuild.
   * Errors:
   *   NOT_FOUND if the prebuild_id does not exist
   */
  getPrebuild(
    request: DeepPartial<GetPrebuildRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetPrebuildResponse>;
  /**
   * GetRunningPrebuild returns the prebuild ID of a running prebuild,
   * or NOT_FOUND if there is no prebuild running for the content_url.
   */
  getRunningPrebuild(
    request: DeepPartial<GetRunningPrebuildRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetRunningPrebuildResponse>;
  /**
   * ListenToPrebuildStatus streams status updates for a prebuild. If the prebuild is already
   * in the Done phase, only that single status is streamed.
   */
  listenToPrebuildStatus(
    request: DeepPartial<ListenToPrebuildStatusRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<ListenToPrebuildStatusResponse>;
  /**
   * ListenToPrebuildLogs returns the log output of a prebuild.
   * This does NOT include an image build if one happened.
   */
  listenToPrebuildLogs(
    request: DeepPartial<ListenToPrebuildLogsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<ListenToPrebuildLogsResponse>;
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

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
