/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "./google/protobuf/timestamp.pb";

export const protobufPackage = "supervisor";

export enum TokenReuse {
  /**
   * REUSE_NEVER - REUSE_NEVER means the token can never be re-used.
   * This mode only makes sense when providing a token in response to a request.
   */
  REUSE_NEVER = "REUSE_NEVER",
  /**
   * REUSE_EXACTLY - REUSE_EXACTLY means the token can only be reused when the requested scopes
   * exactly match those of the token.
   */
  REUSE_EXACTLY = "REUSE_EXACTLY",
  /**
   * REUSE_WHEN_POSSIBLE - REUSE_WHEN_POSSIBLE means the token can be reused when the requested scopes
   * are a subset of the token's scopes.
   */
  REUSE_WHEN_POSSIBLE = "REUSE_WHEN_POSSIBLE",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function tokenReuseFromJSON(object: any): TokenReuse {
  switch (object) {
    case 0:
    case "REUSE_NEVER":
      return TokenReuse.REUSE_NEVER;
    case 1:
    case "REUSE_EXACTLY":
      return TokenReuse.REUSE_EXACTLY;
    case 2:
    case "REUSE_WHEN_POSSIBLE":
      return TokenReuse.REUSE_WHEN_POSSIBLE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return TokenReuse.UNRECOGNIZED;
  }
}

export function tokenReuseToJSON(object: TokenReuse): string {
  switch (object) {
    case TokenReuse.REUSE_NEVER:
      return "REUSE_NEVER";
    case TokenReuse.REUSE_EXACTLY:
      return "REUSE_EXACTLY";
    case TokenReuse.REUSE_WHEN_POSSIBLE:
      return "REUSE_WHEN_POSSIBLE";
    case TokenReuse.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function tokenReuseToNumber(object: TokenReuse): number {
  switch (object) {
    case TokenReuse.REUSE_NEVER:
      return 0;
    case TokenReuse.REUSE_EXACTLY:
      return 1;
    case TokenReuse.REUSE_WHEN_POSSIBLE:
      return 2;
    case TokenReuse.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface GetTokenRequest {
  host: string;
  scope: string[];
  description: string;
  kind: string;
}

export interface GetTokenResponse {
  token: string;
  /** The username of the account associated with the token. */
  user: string;
  scope: string[];
}

export interface SetTokenRequest {
  host: string;
  scope: string[];
  token: string;
  expiryDate: Date | undefined;
  reuse: TokenReuse;
  kind: string;
}

export interface SetTokenResponse {
}

export interface ClearTokenRequest {
  value: string | undefined;
  all: boolean | undefined;
  kind: string;
}

export interface ClearTokenResponse {
}

export interface ProvideTokenRequest {
  registration: ProvideTokenRequest_RegisterProvider | undefined;
  answer: SetTokenRequest | undefined;
}

export interface ProvideTokenRequest_RegisterProvider {
  kind: string;
}

export interface ProvideTokenResponse {
  request: GetTokenRequest | undefined;
}

function createBaseGetTokenRequest(): GetTokenRequest {
  return { host: "", scope: [], description: "", kind: "" };
}

export const GetTokenRequest = {
  encode(message: GetTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.host !== "") {
      writer.uint32(10).string(message.host);
    }
    for (const v of message.scope) {
      writer.uint32(18).string(v!);
    }
    if (message.description !== "") {
      writer.uint32(26).string(message.description);
    }
    if (message.kind !== "") {
      writer.uint32(34).string(message.kind);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.host = reader.string();
          break;
        case 2:
          message.scope.push(reader.string());
          break;
        case 3:
          message.description = reader.string();
          break;
        case 4:
          message.kind = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetTokenRequest {
    return {
      host: isSet(object.host) ? String(object.host) : "",
      scope: Array.isArray(object?.scope) ? object.scope.map((e: any) => String(e)) : [],
      description: isSet(object.description) ? String(object.description) : "",
      kind: isSet(object.kind) ? String(object.kind) : "",
    };
  },

  toJSON(message: GetTokenRequest): unknown {
    const obj: any = {};
    message.host !== undefined && (obj.host = message.host);
    if (message.scope) {
      obj.scope = message.scope.map((e) => e);
    } else {
      obj.scope = [];
    }
    message.description !== undefined && (obj.description = message.description);
    message.kind !== undefined && (obj.kind = message.kind);
    return obj;
  },

  fromPartial(object: DeepPartial<GetTokenRequest>): GetTokenRequest {
    const message = createBaseGetTokenRequest();
    message.host = object.host ?? "";
    message.scope = object.scope?.map((e) => e) || [];
    message.description = object.description ?? "";
    message.kind = object.kind ?? "";
    return message;
  },
};

function createBaseGetTokenResponse(): GetTokenResponse {
  return { token: "", user: "", scope: [] };
}

export const GetTokenResponse = {
  encode(message: GetTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== "") {
      writer.uint32(10).string(message.token);
    }
    if (message.user !== "") {
      writer.uint32(18).string(message.user);
    }
    for (const v of message.scope) {
      writer.uint32(26).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = reader.string();
          break;
        case 2:
          message.user = reader.string();
          break;
        case 3:
          message.scope.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetTokenResponse {
    return {
      token: isSet(object.token) ? String(object.token) : "",
      user: isSet(object.user) ? String(object.user) : "",
      scope: Array.isArray(object?.scope) ? object.scope.map((e: any) => String(e)) : [],
    };
  },

  toJSON(message: GetTokenResponse): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token);
    message.user !== undefined && (obj.user = message.user);
    if (message.scope) {
      obj.scope = message.scope.map((e) => e);
    } else {
      obj.scope = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<GetTokenResponse>): GetTokenResponse {
    const message = createBaseGetTokenResponse();
    message.token = object.token ?? "";
    message.user = object.user ?? "";
    message.scope = object.scope?.map((e) => e) || [];
    return message;
  },
};

function createBaseSetTokenRequest(): SetTokenRequest {
  return { host: "", scope: [], token: "", expiryDate: undefined, reuse: TokenReuse.REUSE_NEVER, kind: "" };
}

export const SetTokenRequest = {
  encode(message: SetTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.host !== "") {
      writer.uint32(10).string(message.host);
    }
    for (const v of message.scope) {
      writer.uint32(18).string(v!);
    }
    if (message.token !== "") {
      writer.uint32(26).string(message.token);
    }
    if (message.expiryDate !== undefined) {
      Timestamp.encode(toTimestamp(message.expiryDate), writer.uint32(34).fork()).ldelim();
    }
    if (message.reuse !== TokenReuse.REUSE_NEVER) {
      writer.uint32(40).int32(tokenReuseToNumber(message.reuse));
    }
    if (message.kind !== "") {
      writer.uint32(50).string(message.kind);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.host = reader.string();
          break;
        case 2:
          message.scope.push(reader.string());
          break;
        case 3:
          message.token = reader.string();
          break;
        case 4:
          message.expiryDate = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 5:
          message.reuse = tokenReuseFromJSON(reader.int32());
          break;
        case 6:
          message.kind = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetTokenRequest {
    return {
      host: isSet(object.host) ? String(object.host) : "",
      scope: Array.isArray(object?.scope) ? object.scope.map((e: any) => String(e)) : [],
      token: isSet(object.token) ? String(object.token) : "",
      expiryDate: isSet(object.expiryDate) ? fromJsonTimestamp(object.expiryDate) : undefined,
      reuse: isSet(object.reuse) ? tokenReuseFromJSON(object.reuse) : TokenReuse.REUSE_NEVER,
      kind: isSet(object.kind) ? String(object.kind) : "",
    };
  },

  toJSON(message: SetTokenRequest): unknown {
    const obj: any = {};
    message.host !== undefined && (obj.host = message.host);
    if (message.scope) {
      obj.scope = message.scope.map((e) => e);
    } else {
      obj.scope = [];
    }
    message.token !== undefined && (obj.token = message.token);
    message.expiryDate !== undefined && (obj.expiryDate = message.expiryDate.toISOString());
    message.reuse !== undefined && (obj.reuse = tokenReuseToJSON(message.reuse));
    message.kind !== undefined && (obj.kind = message.kind);
    return obj;
  },

  fromPartial(object: DeepPartial<SetTokenRequest>): SetTokenRequest {
    const message = createBaseSetTokenRequest();
    message.host = object.host ?? "";
    message.scope = object.scope?.map((e) => e) || [];
    message.token = object.token ?? "";
    message.expiryDate = object.expiryDate ?? undefined;
    message.reuse = object.reuse ?? TokenReuse.REUSE_NEVER;
    message.kind = object.kind ?? "";
    return message;
  },
};

function createBaseSetTokenResponse(): SetTokenResponse {
  return {};
}

export const SetTokenResponse = {
  encode(_: SetTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTokenResponse();
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

  fromJSON(_: any): SetTokenResponse {
    return {};
  },

  toJSON(_: SetTokenResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<SetTokenResponse>): SetTokenResponse {
    const message = createBaseSetTokenResponse();
    return message;
  },
};

function createBaseClearTokenRequest(): ClearTokenRequest {
  return { value: undefined, all: undefined, kind: "" };
}

export const ClearTokenRequest = {
  encode(message: ClearTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.value !== undefined) {
      writer.uint32(10).string(message.value);
    }
    if (message.all !== undefined) {
      writer.uint32(16).bool(message.all);
    }
    if (message.kind !== "") {
      writer.uint32(26).string(message.kind);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ClearTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseClearTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.value = reader.string();
          break;
        case 2:
          message.all = reader.bool();
          break;
        case 3:
          message.kind = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ClearTokenRequest {
    return {
      value: isSet(object.value) ? String(object.value) : undefined,
      all: isSet(object.all) ? Boolean(object.all) : undefined,
      kind: isSet(object.kind) ? String(object.kind) : "",
    };
  },

  toJSON(message: ClearTokenRequest): unknown {
    const obj: any = {};
    message.value !== undefined && (obj.value = message.value);
    message.all !== undefined && (obj.all = message.all);
    message.kind !== undefined && (obj.kind = message.kind);
    return obj;
  },

  fromPartial(object: DeepPartial<ClearTokenRequest>): ClearTokenRequest {
    const message = createBaseClearTokenRequest();
    message.value = object.value ?? undefined;
    message.all = object.all ?? undefined;
    message.kind = object.kind ?? "";
    return message;
  },
};

function createBaseClearTokenResponse(): ClearTokenResponse {
  return {};
}

export const ClearTokenResponse = {
  encode(_: ClearTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ClearTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseClearTokenResponse();
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

  fromJSON(_: any): ClearTokenResponse {
    return {};
  },

  toJSON(_: ClearTokenResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ClearTokenResponse>): ClearTokenResponse {
    const message = createBaseClearTokenResponse();
    return message;
  },
};

function createBaseProvideTokenRequest(): ProvideTokenRequest {
  return { registration: undefined, answer: undefined };
}

export const ProvideTokenRequest = {
  encode(message: ProvideTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.registration !== undefined) {
      ProvideTokenRequest_RegisterProvider.encode(message.registration, writer.uint32(10).fork()).ldelim();
    }
    if (message.answer !== undefined) {
      SetTokenRequest.encode(message.answer, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ProvideTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseProvideTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.registration = ProvideTokenRequest_RegisterProvider.decode(reader, reader.uint32());
          break;
        case 2:
          message.answer = SetTokenRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ProvideTokenRequest {
    return {
      registration: isSet(object.registration)
        ? ProvideTokenRequest_RegisterProvider.fromJSON(object.registration)
        : undefined,
      answer: isSet(object.answer) ? SetTokenRequest.fromJSON(object.answer) : undefined,
    };
  },

  toJSON(message: ProvideTokenRequest): unknown {
    const obj: any = {};
    message.registration !== undefined && (obj.registration = message.registration
      ? ProvideTokenRequest_RegisterProvider.toJSON(message.registration)
      : undefined);
    message.answer !== undefined && (obj.answer = message.answer ? SetTokenRequest.toJSON(message.answer) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ProvideTokenRequest>): ProvideTokenRequest {
    const message = createBaseProvideTokenRequest();
    message.registration = (object.registration !== undefined && object.registration !== null)
      ? ProvideTokenRequest_RegisterProvider.fromPartial(object.registration)
      : undefined;
    message.answer = (object.answer !== undefined && object.answer !== null)
      ? SetTokenRequest.fromPartial(object.answer)
      : undefined;
    return message;
  },
};

function createBaseProvideTokenRequest_RegisterProvider(): ProvideTokenRequest_RegisterProvider {
  return { kind: "" };
}

export const ProvideTokenRequest_RegisterProvider = {
  encode(message: ProvideTokenRequest_RegisterProvider, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.kind !== "") {
      writer.uint32(10).string(message.kind);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ProvideTokenRequest_RegisterProvider {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseProvideTokenRequest_RegisterProvider();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.kind = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ProvideTokenRequest_RegisterProvider {
    return { kind: isSet(object.kind) ? String(object.kind) : "" };
  },

  toJSON(message: ProvideTokenRequest_RegisterProvider): unknown {
    const obj: any = {};
    message.kind !== undefined && (obj.kind = message.kind);
    return obj;
  },

  fromPartial(object: DeepPartial<ProvideTokenRequest_RegisterProvider>): ProvideTokenRequest_RegisterProvider {
    const message = createBaseProvideTokenRequest_RegisterProvider();
    message.kind = object.kind ?? "";
    return message;
  },
};

function createBaseProvideTokenResponse(): ProvideTokenResponse {
  return { request: undefined };
}

export const ProvideTokenResponse = {
  encode(message: ProvideTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.request !== undefined) {
      GetTokenRequest.encode(message.request, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ProvideTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseProvideTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.request = GetTokenRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ProvideTokenResponse {
    return { request: isSet(object.request) ? GetTokenRequest.fromJSON(object.request) : undefined };
  },

  toJSON(message: ProvideTokenResponse): unknown {
    const obj: any = {};
    message.request !== undefined &&
      (obj.request = message.request ? GetTokenRequest.toJSON(message.request) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ProvideTokenResponse>): ProvideTokenResponse {
    const message = createBaseProvideTokenResponse();
    message.request = (object.request !== undefined && object.request !== null)
      ? GetTokenRequest.fromPartial(object.request)
      : undefined;
    return message;
  },
};

export type TokenServiceDefinition = typeof TokenServiceDefinition;
export const TokenServiceDefinition = {
  name: "TokenService",
  fullName: "supervisor.TokenService",
  methods: {
    getToken: {
      name: "GetToken",
      requestType: GetTokenRequest,
      requestStream: false,
      responseType: GetTokenResponse,
      responseStream: false,
      options: {},
    },
    setToken: {
      name: "SetToken",
      requestType: SetTokenRequest,
      requestStream: false,
      responseType: SetTokenResponse,
      responseStream: false,
      options: {},
    },
    clearToken: {
      name: "ClearToken",
      requestType: ClearTokenRequest,
      requestStream: false,
      responseType: ClearTokenResponse,
      responseStream: false,
      options: {},
    },
    provideToken: {
      name: "ProvideToken",
      requestType: ProvideTokenRequest,
      requestStream: true,
      responseType: ProvideTokenResponse,
      responseStream: true,
      options: {},
    },
  },
} as const;

export interface TokenServiceServiceImplementation<CallContextExt = {}> {
  getToken(request: GetTokenRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetTokenResponse>>;
  setToken(request: SetTokenRequest, context: CallContext & CallContextExt): Promise<DeepPartial<SetTokenResponse>>;
  clearToken(
    request: ClearTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ClearTokenResponse>>;
  provideToken(
    request: AsyncIterable<ProvideTokenRequest>,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<ProvideTokenResponse>>;
}

export interface TokenServiceClient<CallOptionsExt = {}> {
  getToken(request: DeepPartial<GetTokenRequest>, options?: CallOptions & CallOptionsExt): Promise<GetTokenResponse>;
  setToken(request: DeepPartial<SetTokenRequest>, options?: CallOptions & CallOptionsExt): Promise<SetTokenResponse>;
  clearToken(
    request: DeepPartial<ClearTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ClearTokenResponse>;
  provideToken(
    request: AsyncIterable<DeepPartial<ProvideTokenRequest>>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<ProvideTokenResponse>;
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

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
