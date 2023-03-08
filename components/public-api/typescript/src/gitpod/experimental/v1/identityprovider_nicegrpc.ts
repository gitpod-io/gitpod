/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "gitpod.experimental.v1";

export interface GetIDTokenRequest {
  workspaceId: string;
  audience: string[];
}

export interface GetIDTokenResponse {
  token: string;
}

function createBaseGetIDTokenRequest(): GetIDTokenRequest {
  return { workspaceId: "", audience: [] };
}

export const GetIDTokenRequest = {
  encode(message: GetIDTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.workspaceId !== "") {
      writer.uint32(10).string(message.workspaceId);
    }
    for (const v of message.audience) {
      writer.uint32(18).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetIDTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetIDTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.workspaceId = reader.string();
          break;
        case 2:
          message.audience.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetIDTokenRequest {
    return {
      workspaceId: isSet(object.workspaceId) ? String(object.workspaceId) : "",
      audience: Array.isArray(object?.audience) ? object.audience.map((e: any) => String(e)) : [],
    };
  },

  toJSON(message: GetIDTokenRequest): unknown {
    const obj: any = {};
    message.workspaceId !== undefined && (obj.workspaceId = message.workspaceId);
    if (message.audience) {
      obj.audience = message.audience.map((e) => e);
    } else {
      obj.audience = [];
    }
    return obj;
  },

  create(base?: DeepPartial<GetIDTokenRequest>): GetIDTokenRequest {
    return GetIDTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetIDTokenRequest>): GetIDTokenRequest {
    const message = createBaseGetIDTokenRequest();
    message.workspaceId = object.workspaceId ?? "";
    message.audience = object.audience?.map((e) => e) || [];
    return message;
  },
};

function createBaseGetIDTokenResponse(): GetIDTokenResponse {
  return { token: "" };
}

export const GetIDTokenResponse = {
  encode(message: GetIDTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== "") {
      writer.uint32(10).string(message.token);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetIDTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetIDTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetIDTokenResponse {
    return { token: isSet(object.token) ? String(object.token) : "" };
  },

  toJSON(message: GetIDTokenResponse): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token);
    return obj;
  },

  create(base?: DeepPartial<GetIDTokenResponse>): GetIDTokenResponse {
    return GetIDTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetIDTokenResponse>): GetIDTokenResponse {
    const message = createBaseGetIDTokenResponse();
    message.token = object.token ?? "";
    return message;
  },
};

export type IdentityProviderServiceDefinition = typeof IdentityProviderServiceDefinition;
export const IdentityProviderServiceDefinition = {
  name: "IdentityProviderService",
  fullName: "gitpod.experimental.v1.IdentityProviderService",
  methods: {
    /** GetIDToken produces a new OIDC ID token (https://openid.net/specs/openid-connect-core-1_0.html#ImplicitIDToken) */
    getIDToken: {
      name: "GetIDToken",
      requestType: GetIDTokenRequest,
      requestStream: false,
      responseType: GetIDTokenResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface IdentityProviderServiceImplementation<CallContextExt = {}> {
  /** GetIDToken produces a new OIDC ID token (https://openid.net/specs/openid-connect-core-1_0.html#ImplicitIDToken) */
  getIDToken(
    request: GetIDTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetIDTokenResponse>>;
}

export interface IdentityProviderServiceClient<CallOptionsExt = {}> {
  /** GetIDToken produces a new OIDC ID token (https://openid.net/specs/openid-connect-core-1_0.html#ImplicitIDToken) */
  getIDToken(
    request: DeepPartial<GetIDTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetIDTokenResponse>;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
