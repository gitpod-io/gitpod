/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Struct } from "../../../google/protobuf/struct.pb";
import { Status } from "../../../google/rpc/status.pb";
import { Cursor, ObjectReference, PartialCaveatInfo, Relationship, SubjectReference, ZedToken } from "./core.pb";
import {
  CheckPermissionResponse_Permissionship,
  checkPermissionResponse_PermissionshipFromJSON,
  checkPermissionResponse_PermissionshipToJSON,
  checkPermissionResponse_PermissionshipToNumber,
  Consistency,
} from "./permission_service.pb";

export const protobufPackage = "authzed.api.v1";

export interface StreamingBulkCheckPermissionRequest {
  consistency: Consistency | undefined;
  items: BulkCheckPermissionRequestItem[];
}

export interface BulkCheckPermissionRequest {
  consistency: Consistency | undefined;
  items: BulkCheckPermissionRequestItem[];
}

export interface BulkCheckPermissionRequestItem {
  resource: ObjectReference | undefined;
  permission: string;
  subject: SubjectReference | undefined;
  context: { [key: string]: any } | undefined;
}

export interface BulkCheckPermissionResponse {
  checkedAt: ZedToken | undefined;
  pairs: BulkCheckPermissionPair[];
}

export interface StreamingBulkCheckPermissionResponse {
  checkedAt: ZedToken | undefined;
  pairs: BulkCheckPermissionPair[];
}

export interface BulkCheckPermissionPair {
  request: BulkCheckPermissionRequestItem | undefined;
  item: BulkCheckPermissionResponseItem | undefined;
  error: Status | undefined;
}

export interface BulkCheckPermissionResponseItem {
  permissionship: CheckPermissionResponse_Permissionship;
  partialCaveatInfo: PartialCaveatInfo | undefined;
}

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

function createBaseStreamingBulkCheckPermissionRequest(): StreamingBulkCheckPermissionRequest {
  return { consistency: undefined, items: [] };
}

export const StreamingBulkCheckPermissionRequest = {
  encode(message: StreamingBulkCheckPermissionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.items) {
      BulkCheckPermissionRequestItem.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StreamingBulkCheckPermissionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStreamingBulkCheckPermissionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.items.push(BulkCheckPermissionRequestItem.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): StreamingBulkCheckPermissionRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      items: Array.isArray(object?.items)
        ? object.items.map((e: any) => BulkCheckPermissionRequestItem.fromJSON(e))
        : [],
    };
  },

  toJSON(message: StreamingBulkCheckPermissionRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    if (message.items) {
      obj.items = message.items.map((e) => e ? BulkCheckPermissionRequestItem.toJSON(e) : undefined);
    } else {
      obj.items = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<StreamingBulkCheckPermissionRequest>): StreamingBulkCheckPermissionRequest {
    const message = createBaseStreamingBulkCheckPermissionRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.items = object.items?.map((e) => BulkCheckPermissionRequestItem.fromPartial(e)) || [];
    return message;
  },
};

function createBaseBulkCheckPermissionRequest(): BulkCheckPermissionRequest {
  return { consistency: undefined, items: [] };
}

export const BulkCheckPermissionRequest = {
  encode(message: BulkCheckPermissionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.consistency !== undefined) {
      Consistency.encode(message.consistency, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.items) {
      BulkCheckPermissionRequestItem.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkCheckPermissionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkCheckPermissionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.consistency = Consistency.decode(reader, reader.uint32());
          break;
        case 2:
          message.items.push(BulkCheckPermissionRequestItem.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkCheckPermissionRequest {
    return {
      consistency: isSet(object.consistency) ? Consistency.fromJSON(object.consistency) : undefined,
      items: Array.isArray(object?.items)
        ? object.items.map((e: any) => BulkCheckPermissionRequestItem.fromJSON(e))
        : [],
    };
  },

  toJSON(message: BulkCheckPermissionRequest): unknown {
    const obj: any = {};
    message.consistency !== undefined &&
      (obj.consistency = message.consistency ? Consistency.toJSON(message.consistency) : undefined);
    if (message.items) {
      obj.items = message.items.map((e) => e ? BulkCheckPermissionRequestItem.toJSON(e) : undefined);
    } else {
      obj.items = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<BulkCheckPermissionRequest>): BulkCheckPermissionRequest {
    const message = createBaseBulkCheckPermissionRequest();
    message.consistency = (object.consistency !== undefined && object.consistency !== null)
      ? Consistency.fromPartial(object.consistency)
      : undefined;
    message.items = object.items?.map((e) => BulkCheckPermissionRequestItem.fromPartial(e)) || [];
    return message;
  },
};

function createBaseBulkCheckPermissionRequestItem(): BulkCheckPermissionRequestItem {
  return { resource: undefined, permission: "", subject: undefined, context: undefined };
}

export const BulkCheckPermissionRequestItem = {
  encode(message: BulkCheckPermissionRequestItem, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.resource !== undefined) {
      ObjectReference.encode(message.resource, writer.uint32(10).fork()).ldelim();
    }
    if (message.permission !== "") {
      writer.uint32(18).string(message.permission);
    }
    if (message.subject !== undefined) {
      SubjectReference.encode(message.subject, writer.uint32(26).fork()).ldelim();
    }
    if (message.context !== undefined) {
      Struct.encode(Struct.wrap(message.context), writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkCheckPermissionRequestItem {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkCheckPermissionRequestItem();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.resource = ObjectReference.decode(reader, reader.uint32());
          break;
        case 2:
          message.permission = reader.string();
          break;
        case 3:
          message.subject = SubjectReference.decode(reader, reader.uint32());
          break;
        case 4:
          message.context = Struct.unwrap(Struct.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkCheckPermissionRequestItem {
    return {
      resource: isSet(object.resource) ? ObjectReference.fromJSON(object.resource) : undefined,
      permission: isSet(object.permission) ? String(object.permission) : "",
      subject: isSet(object.subject) ? SubjectReference.fromJSON(object.subject) : undefined,
      context: isObject(object.context) ? object.context : undefined,
    };
  },

  toJSON(message: BulkCheckPermissionRequestItem): unknown {
    const obj: any = {};
    message.resource !== undefined &&
      (obj.resource = message.resource ? ObjectReference.toJSON(message.resource) : undefined);
    message.permission !== undefined && (obj.permission = message.permission);
    message.subject !== undefined &&
      (obj.subject = message.subject ? SubjectReference.toJSON(message.subject) : undefined);
    message.context !== undefined && (obj.context = message.context);
    return obj;
  },

  fromPartial(object: DeepPartial<BulkCheckPermissionRequestItem>): BulkCheckPermissionRequestItem {
    const message = createBaseBulkCheckPermissionRequestItem();
    message.resource = (object.resource !== undefined && object.resource !== null)
      ? ObjectReference.fromPartial(object.resource)
      : undefined;
    message.permission = object.permission ?? "";
    message.subject = (object.subject !== undefined && object.subject !== null)
      ? SubjectReference.fromPartial(object.subject)
      : undefined;
    message.context = object.context ?? undefined;
    return message;
  },
};

function createBaseBulkCheckPermissionResponse(): BulkCheckPermissionResponse {
  return { checkedAt: undefined, pairs: [] };
}

export const BulkCheckPermissionResponse = {
  encode(message: BulkCheckPermissionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.checkedAt !== undefined) {
      ZedToken.encode(message.checkedAt, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.pairs) {
      BulkCheckPermissionPair.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkCheckPermissionResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkCheckPermissionResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.checkedAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.pairs.push(BulkCheckPermissionPair.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkCheckPermissionResponse {
    return {
      checkedAt: isSet(object.checkedAt) ? ZedToken.fromJSON(object.checkedAt) : undefined,
      pairs: Array.isArray(object?.pairs) ? object.pairs.map((e: any) => BulkCheckPermissionPair.fromJSON(e)) : [],
    };
  },

  toJSON(message: BulkCheckPermissionResponse): unknown {
    const obj: any = {};
    message.checkedAt !== undefined &&
      (obj.checkedAt = message.checkedAt ? ZedToken.toJSON(message.checkedAt) : undefined);
    if (message.pairs) {
      obj.pairs = message.pairs.map((e) => e ? BulkCheckPermissionPair.toJSON(e) : undefined);
    } else {
      obj.pairs = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<BulkCheckPermissionResponse>): BulkCheckPermissionResponse {
    const message = createBaseBulkCheckPermissionResponse();
    message.checkedAt = (object.checkedAt !== undefined && object.checkedAt !== null)
      ? ZedToken.fromPartial(object.checkedAt)
      : undefined;
    message.pairs = object.pairs?.map((e) => BulkCheckPermissionPair.fromPartial(e)) || [];
    return message;
  },
};

function createBaseStreamingBulkCheckPermissionResponse(): StreamingBulkCheckPermissionResponse {
  return { checkedAt: undefined, pairs: [] };
}

export const StreamingBulkCheckPermissionResponse = {
  encode(message: StreamingBulkCheckPermissionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.checkedAt !== undefined) {
      ZedToken.encode(message.checkedAt, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.pairs) {
      BulkCheckPermissionPair.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StreamingBulkCheckPermissionResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStreamingBulkCheckPermissionResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.checkedAt = ZedToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.pairs.push(BulkCheckPermissionPair.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): StreamingBulkCheckPermissionResponse {
    return {
      checkedAt: isSet(object.checkedAt) ? ZedToken.fromJSON(object.checkedAt) : undefined,
      pairs: Array.isArray(object?.pairs) ? object.pairs.map((e: any) => BulkCheckPermissionPair.fromJSON(e)) : [],
    };
  },

  toJSON(message: StreamingBulkCheckPermissionResponse): unknown {
    const obj: any = {};
    message.checkedAt !== undefined &&
      (obj.checkedAt = message.checkedAt ? ZedToken.toJSON(message.checkedAt) : undefined);
    if (message.pairs) {
      obj.pairs = message.pairs.map((e) => e ? BulkCheckPermissionPair.toJSON(e) : undefined);
    } else {
      obj.pairs = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<StreamingBulkCheckPermissionResponse>): StreamingBulkCheckPermissionResponse {
    const message = createBaseStreamingBulkCheckPermissionResponse();
    message.checkedAt = (object.checkedAt !== undefined && object.checkedAt !== null)
      ? ZedToken.fromPartial(object.checkedAt)
      : undefined;
    message.pairs = object.pairs?.map((e) => BulkCheckPermissionPair.fromPartial(e)) || [];
    return message;
  },
};

function createBaseBulkCheckPermissionPair(): BulkCheckPermissionPair {
  return { request: undefined, item: undefined, error: undefined };
}

export const BulkCheckPermissionPair = {
  encode(message: BulkCheckPermissionPair, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.request !== undefined) {
      BulkCheckPermissionRequestItem.encode(message.request, writer.uint32(10).fork()).ldelim();
    }
    if (message.item !== undefined) {
      BulkCheckPermissionResponseItem.encode(message.item, writer.uint32(18).fork()).ldelim();
    }
    if (message.error !== undefined) {
      Status.encode(message.error, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkCheckPermissionPair {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkCheckPermissionPair();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.request = BulkCheckPermissionRequestItem.decode(reader, reader.uint32());
          break;
        case 2:
          message.item = BulkCheckPermissionResponseItem.decode(reader, reader.uint32());
          break;
        case 3:
          message.error = Status.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkCheckPermissionPair {
    return {
      request: isSet(object.request) ? BulkCheckPermissionRequestItem.fromJSON(object.request) : undefined,
      item: isSet(object.item) ? BulkCheckPermissionResponseItem.fromJSON(object.item) : undefined,
      error: isSet(object.error) ? Status.fromJSON(object.error) : undefined,
    };
  },

  toJSON(message: BulkCheckPermissionPair): unknown {
    const obj: any = {};
    message.request !== undefined &&
      (obj.request = message.request ? BulkCheckPermissionRequestItem.toJSON(message.request) : undefined);
    message.item !== undefined &&
      (obj.item = message.item ? BulkCheckPermissionResponseItem.toJSON(message.item) : undefined);
    message.error !== undefined && (obj.error = message.error ? Status.toJSON(message.error) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<BulkCheckPermissionPair>): BulkCheckPermissionPair {
    const message = createBaseBulkCheckPermissionPair();
    message.request = (object.request !== undefined && object.request !== null)
      ? BulkCheckPermissionRequestItem.fromPartial(object.request)
      : undefined;
    message.item = (object.item !== undefined && object.item !== null)
      ? BulkCheckPermissionResponseItem.fromPartial(object.item)
      : undefined;
    message.error = (object.error !== undefined && object.error !== null)
      ? Status.fromPartial(object.error)
      : undefined;
    return message;
  },
};

function createBaseBulkCheckPermissionResponseItem(): BulkCheckPermissionResponseItem {
  return {
    permissionship: CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
    partialCaveatInfo: undefined,
  };
}

export const BulkCheckPermissionResponseItem = {
  encode(message: BulkCheckPermissionResponseItem, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.permissionship !== CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED) {
      writer.uint32(8).int32(checkPermissionResponse_PermissionshipToNumber(message.permissionship));
    }
    if (message.partialCaveatInfo !== undefined) {
      PartialCaveatInfo.encode(message.partialCaveatInfo, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BulkCheckPermissionResponseItem {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBulkCheckPermissionResponseItem();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.permissionship = checkPermissionResponse_PermissionshipFromJSON(reader.int32());
          break;
        case 2:
          message.partialCaveatInfo = PartialCaveatInfo.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BulkCheckPermissionResponseItem {
    return {
      permissionship: isSet(object.permissionship)
        ? checkPermissionResponse_PermissionshipFromJSON(object.permissionship)
        : CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
      partialCaveatInfo: isSet(object.partialCaveatInfo)
        ? PartialCaveatInfo.fromJSON(object.partialCaveatInfo)
        : undefined,
    };
  },

  toJSON(message: BulkCheckPermissionResponseItem): unknown {
    const obj: any = {};
    message.permissionship !== undefined &&
      (obj.permissionship = checkPermissionResponse_PermissionshipToJSON(message.permissionship));
    message.partialCaveatInfo !== undefined && (obj.partialCaveatInfo = message.partialCaveatInfo
      ? PartialCaveatInfo.toJSON(message.partialCaveatInfo)
      : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<BulkCheckPermissionResponseItem>): BulkCheckPermissionResponseItem {
    const message = createBaseBulkCheckPermissionResponseItem();
    message.permissionship = object.permissionship ?? CheckPermissionResponse_Permissionship.PERMISSIONSHIP_UNSPECIFIED;
    message.partialCaveatInfo = (object.partialCaveatInfo !== undefined && object.partialCaveatInfo !== null)
      ? PartialCaveatInfo.fromPartial(object.partialCaveatInfo)
      : undefined;
    return message;
  },
};

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
    streamingBulkCheckPermission: {
      name: "StreamingBulkCheckPermission",
      requestType: StreamingBulkCheckPermissionRequest,
      requestStream: false,
      responseType: StreamingBulkCheckPermissionResponse,
      responseStream: true,
      options: {},
    },
    bulkCheckPermission: {
      name: "BulkCheckPermission",
      requestType: BulkCheckPermissionRequest,
      requestStream: false,
      responseType: BulkCheckPermissionResponse,
      responseStream: false,
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
  streamingBulkCheckPermission(
    request: StreamingBulkCheckPermissionRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<StreamingBulkCheckPermissionResponse>>;
  bulkCheckPermission(
    request: BulkCheckPermissionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<BulkCheckPermissionResponse>>;
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
  streamingBulkCheckPermission(
    request: DeepPartial<StreamingBulkCheckPermissionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<StreamingBulkCheckPermissionResponse>;
  bulkCheckPermission(
    request: DeepPartial<BulkCheckPermissionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<BulkCheckPermissionResponse>;
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

function isObject(value: any): boolean {
  return typeof value === "object" && value !== null;
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
