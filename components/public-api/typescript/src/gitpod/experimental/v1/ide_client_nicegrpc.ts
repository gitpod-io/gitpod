/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "gitpod.experimental.v1";

export interface SendHeartbeatRequest {
  workspaceId: string;
}

export interface SendHeartbeatResponse {
}

export interface SendDidCloseRequest {
  workspaceId: string;
}

export interface SendDidCloseResponse {
}

function createBaseSendHeartbeatRequest(): SendHeartbeatRequest {
  return { workspaceId: "" };
}

export const SendHeartbeatRequest = {
  encode(message: SendHeartbeatRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.workspaceId !== "") {
      writer.uint32(10).string(message.workspaceId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SendHeartbeatRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSendHeartbeatRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.workspaceId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SendHeartbeatRequest {
    return { workspaceId: isSet(object.workspaceId) ? String(object.workspaceId) : "" };
  },

  toJSON(message: SendHeartbeatRequest): unknown {
    const obj: any = {};
    message.workspaceId !== undefined && (obj.workspaceId = message.workspaceId);
    return obj;
  },

  create(base?: DeepPartial<SendHeartbeatRequest>): SendHeartbeatRequest {
    return SendHeartbeatRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<SendHeartbeatRequest>): SendHeartbeatRequest {
    const message = createBaseSendHeartbeatRequest();
    message.workspaceId = object.workspaceId ?? "";
    return message;
  },
};

function createBaseSendHeartbeatResponse(): SendHeartbeatResponse {
  return {};
}

export const SendHeartbeatResponse = {
  encode(_: SendHeartbeatResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SendHeartbeatResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSendHeartbeatResponse();
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

  fromJSON(_: any): SendHeartbeatResponse {
    return {};
  },

  toJSON(_: SendHeartbeatResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<SendHeartbeatResponse>): SendHeartbeatResponse {
    return SendHeartbeatResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<SendHeartbeatResponse>): SendHeartbeatResponse {
    const message = createBaseSendHeartbeatResponse();
    return message;
  },
};

function createBaseSendDidCloseRequest(): SendDidCloseRequest {
  return { workspaceId: "" };
}

export const SendDidCloseRequest = {
  encode(message: SendDidCloseRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.workspaceId !== "") {
      writer.uint32(10).string(message.workspaceId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SendDidCloseRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSendDidCloseRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.workspaceId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SendDidCloseRequest {
    return { workspaceId: isSet(object.workspaceId) ? String(object.workspaceId) : "" };
  },

  toJSON(message: SendDidCloseRequest): unknown {
    const obj: any = {};
    message.workspaceId !== undefined && (obj.workspaceId = message.workspaceId);
    return obj;
  },

  create(base?: DeepPartial<SendDidCloseRequest>): SendDidCloseRequest {
    return SendDidCloseRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<SendDidCloseRequest>): SendDidCloseRequest {
    const message = createBaseSendDidCloseRequest();
    message.workspaceId = object.workspaceId ?? "";
    return message;
  },
};

function createBaseSendDidCloseResponse(): SendDidCloseResponse {
  return {};
}

export const SendDidCloseResponse = {
  encode(_: SendDidCloseResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SendDidCloseResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSendDidCloseResponse();
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

  fromJSON(_: any): SendDidCloseResponse {
    return {};
  },

  toJSON(_: SendDidCloseResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<SendDidCloseResponse>): SendDidCloseResponse {
    return SendDidCloseResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<SendDidCloseResponse>): SendDidCloseResponse {
    const message = createBaseSendDidCloseResponse();
    return message;
  },
};

export type IDEClientServiceDefinition = typeof IDEClientServiceDefinition;
export const IDEClientServiceDefinition = {
  name: "IDEClientService",
  fullName: "gitpod.experimental.v1.IDEClientService",
  methods: {
    /** SendHeartbeat sends a clientheartbeat signal for a running workspace. */
    sendHeartbeat: {
      name: "SendHeartbeat",
      requestType: SendHeartbeatRequest,
      requestStream: false,
      responseType: SendHeartbeatResponse,
      responseStream: false,
      options: {},
    },
    /** SendDidClose sends a client close signal for a running workspace. */
    sendDidClose: {
      name: "SendDidClose",
      requestType: SendDidCloseRequest,
      requestStream: false,
      responseType: SendDidCloseResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface IDEClientServiceImplementation<CallContextExt = {}> {
  /** SendHeartbeat sends a clientheartbeat signal for a running workspace. */
  sendHeartbeat(
    request: SendHeartbeatRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<SendHeartbeatResponse>>;
  /** SendDidClose sends a client close signal for a running workspace. */
  sendDidClose(
    request: SendDidCloseRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<SendDidCloseResponse>>;
}

export interface IDEClientServiceClient<CallOptionsExt = {}> {
  /** SendHeartbeat sends a clientheartbeat signal for a running workspace. */
  sendHeartbeat(
    request: DeepPartial<SendHeartbeatRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<SendHeartbeatResponse>;
  /** SendDidClose sends a client close signal for a running workspace. */
  sendDidClose(
    request: DeepPartial<SendDidCloseRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<SendDidCloseResponse>;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
