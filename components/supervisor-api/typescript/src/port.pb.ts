/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "supervisor";

export enum TunnelVisiblity {
  none = "none",
  host = "host",
  network = "network",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function tunnelVisiblityFromJSON(object: any): TunnelVisiblity {
  switch (object) {
    case 0:
    case "none":
      return TunnelVisiblity.none;
    case 1:
    case "host":
      return TunnelVisiblity.host;
    case 2:
    case "network":
      return TunnelVisiblity.network;
    case -1:
    case "UNRECOGNIZED":
    default:
      return TunnelVisiblity.UNRECOGNIZED;
  }
}

export function tunnelVisiblityToJSON(object: TunnelVisiblity): string {
  switch (object) {
    case TunnelVisiblity.none:
      return "none";
    case TunnelVisiblity.host:
      return "host";
    case TunnelVisiblity.network:
      return "network";
    case TunnelVisiblity.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function tunnelVisiblityToNumber(object: TunnelVisiblity): number {
  switch (object) {
    case TunnelVisiblity.none:
      return 0;
    case TunnelVisiblity.host:
      return 1;
    case TunnelVisiblity.network:
      return 2;
    case TunnelVisiblity.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface TunnelPortRequest {
  port: number;
  targetPort: number;
  visibility: TunnelVisiblity;
  clientId: string;
}

export interface TunnelPortResponse {
}

export interface CloseTunnelRequest {
  port: number;
}

export interface CloseTunnelResponse {
}

export interface EstablishTunnelRequest {
  desc: TunnelPortRequest | undefined;
  data: Uint8Array | undefined;
}

export interface EstablishTunnelResponse {
  data: Uint8Array;
}

export interface AutoTunnelRequest {
  enabled: boolean;
}

export interface AutoTunnelResponse {
}

export interface RetryAutoExposeRequest {
  port: number;
}

export interface RetryAutoExposeResponse {
}

function createBaseTunnelPortRequest(): TunnelPortRequest {
  return { port: 0, targetPort: 0, visibility: TunnelVisiblity.none, clientId: "" };
}

export const TunnelPortRequest = {
  encode(message: TunnelPortRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.port !== 0) {
      writer.uint32(8).uint32(message.port);
    }
    if (message.targetPort !== 0) {
      writer.uint32(16).uint32(message.targetPort);
    }
    if (message.visibility !== TunnelVisiblity.none) {
      writer.uint32(24).int32(tunnelVisiblityToNumber(message.visibility));
    }
    if (message.clientId !== "") {
      writer.uint32(34).string(message.clientId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TunnelPortRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTunnelPortRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.port = reader.uint32();
          break;
        case 2:
          message.targetPort = reader.uint32();
          break;
        case 3:
          message.visibility = tunnelVisiblityFromJSON(reader.int32());
          break;
        case 4:
          message.clientId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TunnelPortRequest {
    return {
      port: isSet(object.port) ? Number(object.port) : 0,
      targetPort: isSet(object.targetPort) ? Number(object.targetPort) : 0,
      visibility: isSet(object.visibility) ? tunnelVisiblityFromJSON(object.visibility) : TunnelVisiblity.none,
      clientId: isSet(object.clientId) ? String(object.clientId) : "",
    };
  },

  toJSON(message: TunnelPortRequest): unknown {
    const obj: any = {};
    message.port !== undefined && (obj.port = Math.round(message.port));
    message.targetPort !== undefined && (obj.targetPort = Math.round(message.targetPort));
    message.visibility !== undefined && (obj.visibility = tunnelVisiblityToJSON(message.visibility));
    message.clientId !== undefined && (obj.clientId = message.clientId);
    return obj;
  },

  fromPartial(object: DeepPartial<TunnelPortRequest>): TunnelPortRequest {
    const message = createBaseTunnelPortRequest();
    message.port = object.port ?? 0;
    message.targetPort = object.targetPort ?? 0;
    message.visibility = object.visibility ?? TunnelVisiblity.none;
    message.clientId = object.clientId ?? "";
    return message;
  },
};

function createBaseTunnelPortResponse(): TunnelPortResponse {
  return {};
}

export const TunnelPortResponse = {
  encode(_: TunnelPortResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TunnelPortResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTunnelPortResponse();
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

  fromJSON(_: any): TunnelPortResponse {
    return {};
  },

  toJSON(_: TunnelPortResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<TunnelPortResponse>): TunnelPortResponse {
    const message = createBaseTunnelPortResponse();
    return message;
  },
};

function createBaseCloseTunnelRequest(): CloseTunnelRequest {
  return { port: 0 };
}

export const CloseTunnelRequest = {
  encode(message: CloseTunnelRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.port !== 0) {
      writer.uint32(8).uint32(message.port);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CloseTunnelRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCloseTunnelRequest();
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

  fromJSON(object: any): CloseTunnelRequest {
    return { port: isSet(object.port) ? Number(object.port) : 0 };
  },

  toJSON(message: CloseTunnelRequest): unknown {
    const obj: any = {};
    message.port !== undefined && (obj.port = Math.round(message.port));
    return obj;
  },

  fromPartial(object: DeepPartial<CloseTunnelRequest>): CloseTunnelRequest {
    const message = createBaseCloseTunnelRequest();
    message.port = object.port ?? 0;
    return message;
  },
};

function createBaseCloseTunnelResponse(): CloseTunnelResponse {
  return {};
}

export const CloseTunnelResponse = {
  encode(_: CloseTunnelResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CloseTunnelResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCloseTunnelResponse();
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

  fromJSON(_: any): CloseTunnelResponse {
    return {};
  },

  toJSON(_: CloseTunnelResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<CloseTunnelResponse>): CloseTunnelResponse {
    const message = createBaseCloseTunnelResponse();
    return message;
  },
};

function createBaseEstablishTunnelRequest(): EstablishTunnelRequest {
  return { desc: undefined, data: undefined };
}

export const EstablishTunnelRequest = {
  encode(message: EstablishTunnelRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.desc !== undefined) {
      TunnelPortRequest.encode(message.desc, writer.uint32(10).fork()).ldelim();
    }
    if (message.data !== undefined) {
      writer.uint32(18).bytes(message.data);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EstablishTunnelRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEstablishTunnelRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.desc = TunnelPortRequest.decode(reader, reader.uint32());
          break;
        case 2:
          message.data = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): EstablishTunnelRequest {
    return {
      desc: isSet(object.desc) ? TunnelPortRequest.fromJSON(object.desc) : undefined,
      data: isSet(object.data) ? bytesFromBase64(object.data) : undefined,
    };
  },

  toJSON(message: EstablishTunnelRequest): unknown {
    const obj: any = {};
    message.desc !== undefined && (obj.desc = message.desc ? TunnelPortRequest.toJSON(message.desc) : undefined);
    message.data !== undefined && (obj.data = message.data !== undefined ? base64FromBytes(message.data) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<EstablishTunnelRequest>): EstablishTunnelRequest {
    const message = createBaseEstablishTunnelRequest();
    message.desc = (object.desc !== undefined && object.desc !== null)
      ? TunnelPortRequest.fromPartial(object.desc)
      : undefined;
    message.data = object.data ?? undefined;
    return message;
  },
};

function createBaseEstablishTunnelResponse(): EstablishTunnelResponse {
  return { data: new Uint8Array() };
}

export const EstablishTunnelResponse = {
  encode(message: EstablishTunnelResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.data.length !== 0) {
      writer.uint32(10).bytes(message.data);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EstablishTunnelResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEstablishTunnelResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.data = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): EstablishTunnelResponse {
    return { data: isSet(object.data) ? bytesFromBase64(object.data) : new Uint8Array() };
  },

  toJSON(message: EstablishTunnelResponse): unknown {
    const obj: any = {};
    message.data !== undefined &&
      (obj.data = base64FromBytes(message.data !== undefined ? message.data : new Uint8Array()));
    return obj;
  },

  fromPartial(object: DeepPartial<EstablishTunnelResponse>): EstablishTunnelResponse {
    const message = createBaseEstablishTunnelResponse();
    message.data = object.data ?? new Uint8Array();
    return message;
  },
};

function createBaseAutoTunnelRequest(): AutoTunnelRequest {
  return { enabled: false };
}

export const AutoTunnelRequest = {
  encode(message: AutoTunnelRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.enabled === true) {
      writer.uint32(8).bool(message.enabled);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AutoTunnelRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAutoTunnelRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.enabled = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AutoTunnelRequest {
    return { enabled: isSet(object.enabled) ? Boolean(object.enabled) : false };
  },

  toJSON(message: AutoTunnelRequest): unknown {
    const obj: any = {};
    message.enabled !== undefined && (obj.enabled = message.enabled);
    return obj;
  },

  fromPartial(object: DeepPartial<AutoTunnelRequest>): AutoTunnelRequest {
    const message = createBaseAutoTunnelRequest();
    message.enabled = object.enabled ?? false;
    return message;
  },
};

function createBaseAutoTunnelResponse(): AutoTunnelResponse {
  return {};
}

export const AutoTunnelResponse = {
  encode(_: AutoTunnelResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AutoTunnelResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAutoTunnelResponse();
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

  fromJSON(_: any): AutoTunnelResponse {
    return {};
  },

  toJSON(_: AutoTunnelResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<AutoTunnelResponse>): AutoTunnelResponse {
    const message = createBaseAutoTunnelResponse();
    return message;
  },
};

function createBaseRetryAutoExposeRequest(): RetryAutoExposeRequest {
  return { port: 0 };
}

export const RetryAutoExposeRequest = {
  encode(message: RetryAutoExposeRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.port !== 0) {
      writer.uint32(8).uint32(message.port);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RetryAutoExposeRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRetryAutoExposeRequest();
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

  fromJSON(object: any): RetryAutoExposeRequest {
    return { port: isSet(object.port) ? Number(object.port) : 0 };
  },

  toJSON(message: RetryAutoExposeRequest): unknown {
    const obj: any = {};
    message.port !== undefined && (obj.port = Math.round(message.port));
    return obj;
  },

  fromPartial(object: DeepPartial<RetryAutoExposeRequest>): RetryAutoExposeRequest {
    const message = createBaseRetryAutoExposeRequest();
    message.port = object.port ?? 0;
    return message;
  },
};

function createBaseRetryAutoExposeResponse(): RetryAutoExposeResponse {
  return {};
}

export const RetryAutoExposeResponse = {
  encode(_: RetryAutoExposeResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RetryAutoExposeResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRetryAutoExposeResponse();
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

  fromJSON(_: any): RetryAutoExposeResponse {
    return {};
  },

  toJSON(_: RetryAutoExposeResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<RetryAutoExposeResponse>): RetryAutoExposeResponse {
    const message = createBaseRetryAutoExposeResponse();
    return message;
  },
};

export type PortServiceDefinition = typeof PortServiceDefinition;
export const PortServiceDefinition = {
  name: "PortService",
  fullName: "supervisor.PortService",
  methods: {
    /**
     * Tunnel notifies clients to install listeners on remote machines.
     * After that such clients should call EstablishTunnel to forward incoming connections.
     */
    tunnel: {
      name: "Tunnel",
      requestType: TunnelPortRequest,
      requestStream: false,
      responseType: TunnelPortResponse,
      responseStream: false,
      options: {},
    },
    /** CloseTunnel notifies clients to remove listeners on remote machines. */
    closeTunnel: {
      name: "CloseTunnel",
      requestType: CloseTunnelRequest,
      requestStream: false,
      responseType: CloseTunnelResponse,
      responseStream: false,
      options: {},
    },
    /** EstablishTunnel actually establishes the tunnel for an incoming connection on a remote machine. */
    establishTunnel: {
      name: "EstablishTunnel",
      requestType: EstablishTunnelRequest,
      requestStream: true,
      responseType: EstablishTunnelResponse,
      responseStream: true,
      options: {},
    },
    /** AutoTunnel controls enablement of auto tunneling */
    autoTunnel: {
      name: "AutoTunnel",
      requestType: AutoTunnelRequest,
      requestStream: false,
      responseType: AutoTunnelResponse,
      responseStream: false,
      options: {},
    },
    /** RetryAutoExpose retries auto exposing the give port */
    retryAutoExpose: {
      name: "RetryAutoExpose",
      requestType: RetryAutoExposeRequest,
      requestStream: false,
      responseType: RetryAutoExposeResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface PortServiceServiceImplementation<CallContextExt = {}> {
  /**
   * Tunnel notifies clients to install listeners on remote machines.
   * After that such clients should call EstablishTunnel to forward incoming connections.
   */
  tunnel(request: TunnelPortRequest, context: CallContext & CallContextExt): Promise<DeepPartial<TunnelPortResponse>>;
  /** CloseTunnel notifies clients to remove listeners on remote machines. */
  closeTunnel(
    request: CloseTunnelRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CloseTunnelResponse>>;
  /** EstablishTunnel actually establishes the tunnel for an incoming connection on a remote machine. */
  establishTunnel(
    request: AsyncIterable<EstablishTunnelRequest>,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<EstablishTunnelResponse>>;
  /** AutoTunnel controls enablement of auto tunneling */
  autoTunnel(
    request: AutoTunnelRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<AutoTunnelResponse>>;
  /** RetryAutoExpose retries auto exposing the give port */
  retryAutoExpose(
    request: RetryAutoExposeRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<RetryAutoExposeResponse>>;
}

export interface PortServiceClient<CallOptionsExt = {}> {
  /**
   * Tunnel notifies clients to install listeners on remote machines.
   * After that such clients should call EstablishTunnel to forward incoming connections.
   */
  tunnel(request: DeepPartial<TunnelPortRequest>, options?: CallOptions & CallOptionsExt): Promise<TunnelPortResponse>;
  /** CloseTunnel notifies clients to remove listeners on remote machines. */
  closeTunnel(
    request: DeepPartial<CloseTunnelRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CloseTunnelResponse>;
  /** EstablishTunnel actually establishes the tunnel for an incoming connection on a remote machine. */
  establishTunnel(
    request: AsyncIterable<DeepPartial<EstablishTunnelRequest>>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<EstablishTunnelResponse>;
  /** AutoTunnel controls enablement of auto tunneling */
  autoTunnel(
    request: DeepPartial<AutoTunnelRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<AutoTunnelResponse>;
  /** RetryAutoExpose retries auto exposing the give port */
  retryAutoExpose(
    request: DeepPartial<RetryAutoExposeRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<RetryAutoExposeResponse>;
}

export interface DataLoaderOptions {
  cache?: boolean;
}

export interface DataLoaders {
  rpcDataLoaderOptions?: DataLoaderOptions;
  getDataLoader<T>(identifier: string, constructorFn: () => T): T;
}

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
var globalThis: any = (() => {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw "Unable to locate global object";
})();

function bytesFromBase64(b64: string): Uint8Array {
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin: string[] = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
