/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { RelationshipUpdate, ZedToken } from "./core.pb";

export const protobufPackage = "authzed.api.v1";

/**
 * WatchRequest specifies the object definitions for which we want to start
 * watching mutations, and an optional start snapshot for when to start
 * watching.
 */
export interface WatchRequest {
  optionalObjectTypes: string[];
  /**
   * optional_start_cursor is the ZedToken holding the point-in-time at
   * which to start watching for changes.
   * If not specified, the watch will begin at the current head revision
   * of the datastore, returning any updates that occur after the caller
   * makes the request.
   * Note that if this cursor references a point-in-time containing data
   * that has been garbage collected, an error will be returned.
   */
  optionalStartCursor: ZedToken | undefined;
}

/**
 * WatchResponse contains all tuple modification events in ascending
 * timestamp order, from the requested start snapshot to a snapshot
 * encoded in the watch response. The client can use the snapshot to resume
 * watching where the previous watch response left off.
 */
export interface WatchResponse {
  updates: RelationshipUpdate[];
  changesThrough: ZedToken | undefined;
}

function createBaseWatchRequest(): WatchRequest {
  return { optionalObjectTypes: [], optionalStartCursor: undefined };
}

export const WatchRequest = {
  encode(message: WatchRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.optionalObjectTypes) {
      writer.uint32(10).string(v!);
    }
    if (message.optionalStartCursor !== undefined) {
      ZedToken.encode(message.optionalStartCursor, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WatchRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWatchRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.optionalObjectTypes.push(reader.string());
          break;
        case 2:
          message.optionalStartCursor = ZedToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WatchRequest {
    return {
      optionalObjectTypes: Array.isArray(object?.optionalObjectTypes)
        ? object.optionalObjectTypes.map((e: any) => String(e))
        : [],
      optionalStartCursor: isSet(object.optionalStartCursor)
        ? ZedToken.fromJSON(object.optionalStartCursor)
        : undefined,
    };
  },

  toJSON(message: WatchRequest): unknown {
    const obj: any = {};
    if (message.optionalObjectTypes) {
      obj.optionalObjectTypes = message.optionalObjectTypes.map((e) => e);
    } else {
      obj.optionalObjectTypes = [];
    }
    message.optionalStartCursor !== undefined &&
      (obj.optionalStartCursor = message.optionalStartCursor
        ? ZedToken.toJSON(message.optionalStartCursor)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<WatchRequest>): WatchRequest {
    const message = createBaseWatchRequest();
    message.optionalObjectTypes = object.optionalObjectTypes?.map((e) => e) || [];
    message.optionalStartCursor = (object.optionalStartCursor !== undefined && object.optionalStartCursor !== null)
      ? ZedToken.fromPartial(object.optionalStartCursor)
      : undefined;
    return message;
  },
};

function createBaseWatchResponse(): WatchResponse {
  return { updates: [], changesThrough: undefined };
}

export const WatchResponse = {
  encode(message: WatchResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.updates) {
      RelationshipUpdate.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.changesThrough !== undefined) {
      ZedToken.encode(message.changesThrough, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WatchResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWatchResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.updates.push(RelationshipUpdate.decode(reader, reader.uint32()));
          break;
        case 2:
          message.changesThrough = ZedToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WatchResponse {
    return {
      updates: Array.isArray(object?.updates) ? object.updates.map((e: any) => RelationshipUpdate.fromJSON(e)) : [],
      changesThrough: isSet(object.changesThrough) ? ZedToken.fromJSON(object.changesThrough) : undefined,
    };
  },

  toJSON(message: WatchResponse): unknown {
    const obj: any = {};
    if (message.updates) {
      obj.updates = message.updates.map((e) => e ? RelationshipUpdate.toJSON(e) : undefined);
    } else {
      obj.updates = [];
    }
    message.changesThrough !== undefined &&
      (obj.changesThrough = message.changesThrough ? ZedToken.toJSON(message.changesThrough) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<WatchResponse>): WatchResponse {
    const message = createBaseWatchResponse();
    message.updates = object.updates?.map((e) => RelationshipUpdate.fromPartial(e)) || [];
    message.changesThrough = (object.changesThrough !== undefined && object.changesThrough !== null)
      ? ZedToken.fromPartial(object.changesThrough)
      : undefined;
    return message;
  },
};

export type WatchServiceDefinition = typeof WatchServiceDefinition;
export const WatchServiceDefinition = {
  name: "WatchService",
  fullName: "authzed.api.v1.WatchService",
  methods: {
    watch: {
      name: "Watch",
      requestType: WatchRequest,
      requestStream: false,
      responseType: WatchResponse,
      responseStream: true,
      options: {},
    },
  },
} as const;

export interface WatchServiceServiceImplementation<CallContextExt = {}> {
  watch(
    request: WatchRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<WatchResponse>>;
}

export interface WatchServiceClient<CallOptionsExt = {}> {
  watch(request: DeepPartial<WatchRequest>, options?: CallOptions & CallOptionsExt): AsyncIterable<WatchResponse>;
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

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
