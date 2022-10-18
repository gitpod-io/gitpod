/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "ide_service_api";

export interface GetConfigRequest {
}

export interface GetConfigResponse {
  content: string;
}

function createBaseGetConfigRequest(): GetConfigRequest {
  return {};
}

export const GetConfigRequest = {
  encode(_: GetConfigRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetConfigRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetConfigRequest();
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

  fromJSON(_: any): GetConfigRequest {
    return {};
  },

  toJSON(_: GetConfigRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<GetConfigRequest>): GetConfigRequest {
    const message = createBaseGetConfigRequest();
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
      options: {},
    },
  },
} as const;

export interface IDEServiceServiceImplementation<CallContextExt = {}> {
  getConfig(request: GetConfigRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetConfigResponse>>;
}

export interface IDEServiceClient<CallOptionsExt = {}> {
  getConfig(request: DeepPartial<GetConfigRequest>, options?: CallOptions & CallOptionsExt): Promise<GetConfigResponse>;
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
