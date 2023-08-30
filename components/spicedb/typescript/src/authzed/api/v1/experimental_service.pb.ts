/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Cursor, Relationship } from "./core.pb";
import { Consistency } from "./permission_service.pb";

export const protobufPackage = "authzed.api.v1";

/**
 * BulkImportRelationshipsRequest represents one batch of the streaming
 * BulkImportRelationships API. The maximum size is only limited by the backing
 * datastore, and optimal size should be determined by the calling client
 * experimentally.
 */
export interface BulkImportRelationshipsRequest {
  relationships: Relationship[];
}

/**
 * BulkImportRelationshipsResponse is returned on successful completion of the
 * bulk load stream, and contains the total number of relationships loaded.
 */
export interface BulkImportRelationshipsResponse {
  numLoaded: number;
}

/**
 * BulkExportRelationshipsRequest represents a resumable request for
 * all relationships from the server.
 */
export interface BulkExportRelationshipsRequest {
  consistency:
    | Consistency
    | undefined;
  /**
   * optional_limit, if non-zero, specifies the limit on the number of
   * relationships the server can return in one page. By default, the server
   * will pick a page size, and the server is free to choose a smaller size
   * at will.
   */
  optionalLimit: number;
  /**
   * optional_cursor, if specified, indicates the cursor after which results
   * should resume being returned. The cursor can be found on the
   * BulkExportRelationshipsResponse object.
   */
  optionalCursor: Cursor | undefined;
}

/**
 * BulkExportRelationshipsResponse is one page in a stream of relationship
 * groups that meet the criteria specified by the originating request. The
 * server will continue to stream back relationship groups as quickly as it can
 * until all relationships have been transmitted back.
 */
export interface BulkExportRelationshipsResponse {
  afterResultCursor: Cursor | undefined;
  relationships: Relationship[];
}

function createBaseBulkImportRelationshipsRequest(): BulkImportRelationshipsRequest {
  return { relationships: [] };
}

export const BulkImportRelationshipsRequest = {
  encode(message: BulkImportRelationshipsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.relationships) {
      Relationship.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkImportRelationshipsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkImportRelationshipsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.relationships.push(Relationship.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkImportRelationshipsRequest {
    return {
      relationships: Array.isArray(object?.relationships)
        ? object.relationships.map((e: any) => Relationship.fromJSON(e))
        : [],
    };
  },

  toJSON(message: BulkImportRelationshipsRequest): unknown {
    const obj: any = {};
    if (message.relationships) {
      obj.relationships = message.relationships.map((e) => e ? Relationship.toJSON(e) : undefined);
    } else {
      obj.relationships = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<BulkImportRelationshipsRequest>): BulkImportRelationshipsRequest {
    const message = createBaseBulkImportRelationshipsRequest();
    message.relationships = object.relationships?.map((e) => Relationship.fromPartial(e)) || [];
    return message;
  },
};

function createBaseBulkImportRelationshipsResponse(): BulkImportRelationshipsResponse {
  return { numLoaded: 0 };
}

export const BulkImportRelationshipsResponse = {
  encode(message: BulkImportRelationshipsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.numLoaded !== 0) {
      writer.uint32(8).uint64(message.numLoaded);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkImportRelationshipsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkImportRelationshipsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.numLoaded = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkImportRelationshipsResponse {
    return { numLoaded: isSet(object.numLoaded) ? Number(object.numLoaded) : 0 };
  },

  toJSON(message: BulkImportRelationshipsResponse): unknown {
    const obj: any = {};
    message.numLoaded !== undefined && (obj.numLoaded = Math.round(message.numLoaded));
    return obj;
  },

  fromPartial(object: DeepPartial<BulkImportRelationshipsResponse>): BulkImportRelationshipsResponse {
    const message = createBaseBulkImportRelationshipsResponse();
    message.numLoaded = object.numLoaded ?? 0;
    return message;
  },
};

function createBaseBulkExportRelationshipsRequest(): BulkExportRelationshipsRequest {
  return { consistency: undefined, optionalLimit: 0, optionalCursor: undefined };
}

export const BulkExportRelationshipsRequest = {
  encode(message: BulkExportRelationshipsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    if (message.optionalLimit !== 0) {
      writer.uint32(16).uint32(message.optionalLimit);
    }
    if (message.optionalCursor !== undefined) {
      Cursor.encode(message.optionalCursor, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkExportRelationshipsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkExportRelationshipsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.optionalLimit = reader.uint32();
          break;
        case 3:
          message.optionalCursor = Cursor.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkExportRelationshipsRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      optionalLimit: isSet(object.optionalLimit) ? Number(object.optionalLimit) : 0,
      optionalCursor: isSet(object.optionalCursor) ? Cursor.fromJSON(object.optionalCursor) : undefined,
    };
  },

  toJSON(message: BulkExportRelationshipsRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    message.optionalLimit !== undefined && (obj.optionalLimit = Math.round(message.optionalLimit));
    message.optionalCursor !== undefined &&
      (obj.optionalCursor = message.optionalCursor ? Cursor.toJSON(message.optionalCursor) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<BulkExportRelationshipsRequest>): BulkExportRelationshipsRequest {
    const message = createBaseBulkExportRelationshipsRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.optionalLimit = object.optionalLimit ?? 0;
    message.optionalCursor = (object.optionalCursor !== undefined && object.optionalCursor !== null)
      ? Cursor.fromPartial(object.optionalCursor)
      : undefined;
    return message;
  },
};

function createBaseBulkExportRelationshipsResponse(): BulkExportRelationshipsResponse {
  return { afterResultCursor: undefined, relationships: [] };
}

export const BulkExportRelationshipsResponse = {
  encode(message: BulkExportRelationshipsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.afterResultCursor !== undefined) {
      Cursor.encode(message.afterResultCursor, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.relationships) {
      Relationship.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkExportRelationshipsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkExportRelationshipsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.afterResultCursor = Cursor.decode(reader, reader.uint32());
          break;
        case 2:
          message.relationships.push(Relationship.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkExportRelationshipsResponse {
    return {
      afterResultCursor: isSet(object.afterResultCursor) ? Cursor.fromJSON(object.afterResultCursor) : undefined,
      relationships: Array.isArray(object?.relationships)
        ? object.relationships.map((e: any) => Relationship.fromJSON(e))
        : [],
    };
  },

  toJSON(message: BulkExportRelationshipsResponse): unknown {
    const obj: any = {};
    message.afterResultCursor !== undefined &&
      (obj.afterResultCursor = message.afterResultCursor ? Cursor.toJSON(message.afterResultCursor) : undefined);
    if (message.relationships) {
      obj.relationships = message.relationships.map((e) => e ? Relationship.toJSON(e) : undefined);
    } else {
      obj.relationships = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<BulkExportRelationshipsResponse>): BulkExportRelationshipsResponse {
    const message = createBaseBulkExportRelationshipsResponse();
    message.afterResultCursor = (object.afterResultCursor !== undefined && object.afterResultCursor !== null)
      ? Cursor.fromPartial(object.afterResultCursor)
      : undefined;
    message.relationships = object.relationships?.map((e) => Relationship.fromPartial(e)) || [];
    return message;
  },
};

/**
 * ExperimentalService exposes a number of APIs that are currently being
 * prototyped and tested for future inclusion in the stable API.
 */
export type ExperimentalServiceDefinition = typeof ExperimentalServiceDefinition;
export const ExperimentalServiceDefinition = {
  name: "ExperimentalService",
  fullName: "authzed.api.v1.ExperimentalService",
  methods: {
    /**
     * BulkImportRelationships is a faster path to writing a large number of
     * relationships at once. It is both batched and streaming. For maximum
     * performance, the caller should attempt to write relationships in as close
     * to relationship sort order as possible: (resource.object_type,
     * resource.object_id, relation, subject.object.object_type,
     * subject.object.object_id, subject.optional_relation)
     *
     * EXPERIMENTAL
     * https://github.com/authzed/spicedb/issues/1303
     */
    bulkImportRelationships: {
      name: "BulkImportRelationships",
      requestType: BulkImportRelationshipsRequest,
      requestStream: true,
      responseType: BulkImportRelationshipsResponse,
      responseStream: false,
      options: {},
    },
    /**
     * BulkExportRelationships is the fastest path available to exporting
     * relationships from the server. It is resumable, and will return results
     * in an order determined by the server.
     */
    bulkExportRelationships: {
      name: "BulkExportRelationships",
      requestType: BulkExportRelationshipsRequest,
      requestStream: false,
      responseType: BulkExportRelationshipsResponse,
      responseStream: true,
      options: {},
    },
  },
} as const;

export interface ExperimentalServiceServiceImplementation<CallContextExt = {}> {
  /**
   * BulkImportRelationships is a faster path to writing a large number of
   * relationships at once. It is both batched and streaming. For maximum
   * performance, the caller should attempt to write relationships in as close
   * to relationship sort order as possible: (resource.object_type,
   * resource.object_id, relation, subject.object.object_type,
   * subject.object.object_id, subject.optional_relation)
   *
   * EXPERIMENTAL
   * https://github.com/authzed/spicedb/issues/1303
   */
  bulkImportRelationships(
    request: AsyncIterable<BulkImportRelationshipsRequest>,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<BulkImportRelationshipsResponse>>;
  /**
   * BulkExportRelationships is the fastest path available to exporting
   * relationships from the server. It is resumable, and will return results
   * in an order determined by the server.
   */
  bulkExportRelationships(
    request: BulkExportRelationshipsRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<BulkExportRelationshipsResponse>>;
}

export interface ExperimentalServiceClient<CallOptionsExt = {}> {
  /**
   * BulkImportRelationships is a faster path to writing a large number of
   * relationships at once. It is both batched and streaming. For maximum
   * performance, the caller should attempt to write relationships in as close
   * to relationship sort order as possible: (resource.object_type,
   * resource.object_id, relation, subject.object.object_type,
   * subject.object.object_id, subject.optional_relation)
   *
   * EXPERIMENTAL
   * https://github.com/authzed/spicedb/issues/1303
   */
  bulkImportRelationships(
    request: AsyncIterable<DeepPartial<BulkImportRelationshipsRequest>>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<BulkImportRelationshipsResponse>;
  /**
   * BulkExportRelationships is the fastest path available to exporting
   * relationships from the server. It is resumable, and will return results
   * in an order determined by the server.
   */
  bulkExportRelationships(
    request: DeepPartial<BulkExportRelationshipsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<BulkExportRelationshipsResponse>;
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

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  return long.toNumber();
}

// If you get a compile-error about 'Constructor<Long> and ... have no overlap',
// add '--ts_proto_opt=esModuleInterop=true' as a flag when calling 'protoc'.
if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
