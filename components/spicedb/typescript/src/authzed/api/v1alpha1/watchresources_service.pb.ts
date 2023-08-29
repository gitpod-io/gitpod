/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { ObjectReference, SubjectReference, ZedToken } from "../v1/core.pb";

export const protobufPackage = "authzed.api.v1alpha1";

/**
 * WatchResourcesRequest starts a watch for specific permission updates
 * for the given resource and subject types.
 */
export interface WatchResourcesRequest {
  /**
   * resource_object_type is the type of resource object for which we will
   * watch for changes.
   */
  resourceObjectType: string;
  /**
   * permission is the name of the permission or relation for which we will
   * watch for changes.
   */
  permission: string;
  /**
   * subject_object_type is the type of the subject resource for which we will
   * watch for changes.
   */
  subjectObjectType: string;
  /**
   * optional_subject_relation allows you to specify a group of subjects to watch
   * for a given subject type.
   */
  optionalSubjectRelation: string;
  optionalStartCursor: ZedToken | undefined;
}

/**
 * PermissionUpdate represents a single permission update for a specific
 * subject's permissions.
 */
export interface PermissionUpdate {
  /** subject defines the subject resource whose permissions have changed. */
  subject:
    | SubjectReference
    | undefined;
  /** resource defines the specific object in the system. */
  resource: ObjectReference | undefined;
  relation: string;
  updatedPermission: PermissionUpdate_Permissionship;
}

/**
 * todo: work this into the v1 core API at some point since it's used
 * across services.
 */
export enum PermissionUpdate_Permissionship {
  PERMISSIONSHIP_UNSPECIFIED = "PERMISSIONSHIP_UNSPECIFIED",
  PERMISSIONSHIP_NO_PERMISSION = "PERMISSIONSHIP_NO_PERMISSION",
  PERMISSIONSHIP_HAS_PERMISSION = "PERMISSIONSHIP_HAS_PERMISSION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function permissionUpdate_PermissionshipFromJSON(object: any): PermissionUpdate_Permissionship {
  switch (object) {
    case 0:
    case "PERMISSIONSHIP_UNSPECIFIED":
      return PermissionUpdate_Permissionship.PERMISSIONSHIP_UNSPECIFIED;
    case 1:
    case "PERMISSIONSHIP_NO_PERMISSION":
      return PermissionUpdate_Permissionship.PERMISSIONSHIP_NO_PERMISSION;
    case 2:
    case "PERMISSIONSHIP_HAS_PERMISSION":
      return PermissionUpdate_Permissionship.PERMISSIONSHIP_HAS_PERMISSION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PermissionUpdate_Permissionship.UNRECOGNIZED;
  }
}

export function permissionUpdate_PermissionshipToJSON(object: PermissionUpdate_Permissionship): string {
  switch (object) {
    case PermissionUpdate_Permissionship.PERMISSIONSHIP_UNSPECIFIED:
      return "PERMISSIONSHIP_UNSPECIFIED";
    case PermissionUpdate_Permissionship.PERMISSIONSHIP_NO_PERMISSION:
      return "PERMISSIONSHIP_NO_PERMISSION";
    case PermissionUpdate_Permissionship.PERMISSIONSHIP_HAS_PERMISSION:
      return "PERMISSIONSHIP_HAS_PERMISSION";
    case PermissionUpdate_Permissionship.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function permissionUpdate_PermissionshipToNumber(object: PermissionUpdate_Permissionship): number {
  switch (object) {
    case PermissionUpdate_Permissionship.PERMISSIONSHIP_UNSPECIFIED:
      return 0;
    case PermissionUpdate_Permissionship.PERMISSIONSHIP_NO_PERMISSION:
      return 1;
    case PermissionUpdate_Permissionship.PERMISSIONSHIP_HAS_PERMISSION:
      return 2;
    case PermissionUpdate_Permissionship.UNRECOGNIZED:
    default:
      return -1;
  }
}

/**
 * WatchResourcesResponse enumerates the list of permission updates that have
 * occurred as a result of one or more relationship updates.
 */
export interface WatchResourcesResponse {
  updates: PermissionUpdate[];
  changesThrough: ZedToken | undefined;
}

function createBaseWatchResourcesRequest(): WatchResourcesRequest {
  return {
    resourceObjectType: "",
    permission: "",
    subjectObjectType: "",
    optionalSubjectRelation: "",
    optionalStartCursor: undefined,
  };
}

export const WatchResourcesRequest = {
  encode(message: WatchResourcesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.resourceObjectType !== "") {
      writer.uint32(10).string(message.resourceObjectType);
    }
    if (message.permission !== "") {
      writer.uint32(18).string(message.permission);
    }
    if (message.subjectObjectType !== "") {
      writer.uint32(26).string(message.subjectObjectType);
    }
    if (message.optionalSubjectRelation !== "") {
      writer.uint32(34).string(message.optionalSubjectRelation);
    }
    if (message.optionalStartCursor !== undefined) {
      ZedToken.encode(message.optionalStartCursor, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WatchResourcesRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWatchResourcesRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.resourceObjectType = reader.string();
          break;
        case 2:
          message.permission = reader.string();
          break;
        case 3:
          message.subjectObjectType = reader.string();
          break;
        case 4:
          message.optionalSubjectRelation = reader.string();
          break;
        case 5:
          message.optionalStartCursor = ZedToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WatchResourcesRequest {
    return {
      resourceObjectType: isSet(object.resourceObjectType) ? String(object.resourceObjectType) : "",
      permission: isSet(object.permission) ? String(object.permission) : "",
      subjectObjectType: isSet(object.subjectObjectType) ? String(object.subjectObjectType) : "",
      optionalSubjectRelation: isSet(object.optionalSubjectRelation) ? String(object.optionalSubjectRelation) : "",
      optionalStartCursor: isSet(object.optionalStartCursor)
        ? ZedToken.fromJSON(object.optionalStartCursor)
        : undefined,
    };
  },

  toJSON(message: WatchResourcesRequest): unknown {
    const obj: any = {};
    message.resourceObjectType !== undefined && (obj.resourceObjectType = message.resourceObjectType);
    message.permission !== undefined && (obj.permission = message.permission);
    message.subjectObjectType !== undefined && (obj.subjectObjectType = message.subjectObjectType);
    message.optionalSubjectRelation !== undefined && (obj.optionalSubjectRelation = message.optionalSubjectRelation);
    message.optionalStartCursor !== undefined &&
      (obj.optionalStartCursor = message.optionalStartCursor
        ? ZedToken.toJSON(message.optionalStartCursor)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<WatchResourcesRequest>): WatchResourcesRequest {
    const message = createBaseWatchResourcesRequest();
    message.resourceObjectType = object.resourceObjectType ?? "";
    message.permission = object.permission ?? "";
    message.subjectObjectType = object.subjectObjectType ?? "";
    message.optionalSubjectRelation = object.optionalSubjectRelation ?? "";
    message.optionalStartCursor = (object.optionalStartCursor !== undefined && object.optionalStartCursor !== null)
      ? ZedToken.fromPartial(object.optionalStartCursor)
      : undefined;
    return message;
  },
};

function createBasePermissionUpdate(): PermissionUpdate {
  return {
    subject: undefined,
    resource: undefined,
    relation: "",
    updatedPermission: PermissionUpdate_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
  };
}

export const PermissionUpdate = {
  encode(message: PermissionUpdate, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.subject !== undefined) {
      SubjectReference.encode(message.subject, writer.uint32(10).fork()).ldelim();
    }
    if (message.resource !== undefined) {
      ObjectReference.encode(message.resource, writer.uint32(18).fork()).ldelim();
    }
    if (message.relation !== "") {
      writer.uint32(26).string(message.relation);
    }
    if (message.updatedPermission !== PermissionUpdate_Permissionship.PERMISSIONSHIP_UNSPECIFIED) {
      writer.uint32(32).int32(permissionUpdate_PermissionshipToNumber(message.updatedPermission));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PermissionUpdate {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePermissionUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.subject = SubjectReference.decode(reader, reader.uint32());
          break;
        case 2:
          message.resource = ObjectReference.decode(reader, reader.uint32());
          break;
        case 3:
          message.relation = reader.string();
          break;
        case 4:
          message.updatedPermission = permissionUpdate_PermissionshipFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PermissionUpdate {
    return {
      subject: isSet(object.subject) ? SubjectReference.fromJSON(object.subject) : undefined,
      resource: isSet(object.resource) ? ObjectReference.fromJSON(object.resource) : undefined,
      relation: isSet(object.relation) ? String(object.relation) : "",
      updatedPermission: isSet(object.updatedPermission)
        ? permissionUpdate_PermissionshipFromJSON(object.updatedPermission)
        : PermissionUpdate_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
    };
  },

  toJSON(message: PermissionUpdate): unknown {
    const obj: any = {};
    message.subject !== undefined &&
      (obj.subject = message.subject ? SubjectReference.toJSON(message.subject) : undefined);
    message.resource !== undefined &&
      (obj.resource = message.resource ? ObjectReference.toJSON(message.resource) : undefined);
    message.relation !== undefined && (obj.relation = message.relation);
    message.updatedPermission !== undefined &&
      (obj.updatedPermission = permissionUpdate_PermissionshipToJSON(message.updatedPermission));
    return obj;
  },

  fromPartial(object: DeepPartial<PermissionUpdate>): PermissionUpdate {
    const message = createBasePermissionUpdate();
    message.subject = (object.subject !== undefined && object.subject !== null)
      ? SubjectReference.fromPartial(object.subject)
      : undefined;
    message.resource = (object.resource !== undefined && object.resource !== null)
      ? ObjectReference.fromPartial(object.resource)
      : undefined;
    message.relation = object.relation ?? "";
    message.updatedPermission = object.updatedPermission ?? PermissionUpdate_Permissionship.PERMISSIONSHIP_UNSPECIFIED;
    return message;
  },
};

function createBaseWatchResourcesResponse(): WatchResourcesResponse {
  return { updates: [], changesThrough: undefined };
}

export const WatchResourcesResponse = {
  encode(message: WatchResourcesResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.updates) {
      PermissionUpdate.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.changesThrough !== undefined) {
      ZedToken.encode(message.changesThrough, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WatchResourcesResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWatchResourcesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.updates.push(PermissionUpdate.decode(reader, reader.uint32()));
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

  fromJSON(object: any): WatchResourcesResponse {
    return {
      updates: Array.isArray(object?.updates) ? object.updates.map((e: any) => PermissionUpdate.fromJSON(e)) : [],
      changesThrough: isSet(object.changesThrough) ? ZedToken.fromJSON(object.changesThrough) : undefined,
    };
  },

  toJSON(message: WatchResourcesResponse): unknown {
    const obj: any = {};
    if (message.updates) {
      obj.updates = message.updates.map((e) => e ? PermissionUpdate.toJSON(e) : undefined);
    } else {
      obj.updates = [];
    }
    message.changesThrough !== undefined &&
      (obj.changesThrough = message.changesThrough ? ZedToken.toJSON(message.changesThrough) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<WatchResourcesResponse>): WatchResourcesResponse {
    const message = createBaseWatchResourcesResponse();
    message.updates = object.updates?.map((e) => PermissionUpdate.fromPartial(e)) || [];
    message.changesThrough = (object.changesThrough !== undefined && object.changesThrough !== null)
      ? ZedToken.fromPartial(object.changesThrough)
      : undefined;
    return message;
  },
};

/**
 * WatchResourcesService is used to receive a stream of updates for resources of a
 * specific (resource type, permission, subject) combination.
 */
export type WatchResourcesServiceDefinition = typeof WatchResourcesServiceDefinition;
export const WatchResourcesServiceDefinition = {
  name: "WatchResourcesService",
  fullName: "authzed.api.v1alpha1.WatchResourcesService",
  methods: {
    /**
     * WatchResources initiates a watch for permission changes for the provided
     * (resource type, permission, subject) pair.
     */
    watchResources: {
      name: "WatchResources",
      requestType: WatchResourcesRequest,
      requestStream: false,
      responseType: WatchResourcesResponse,
      responseStream: true,
      options: {},
    },
  },
} as const;

export interface WatchResourcesServiceServiceImplementation<CallContextExt = {}> {
  /**
   * WatchResources initiates a watch for permission changes for the provided
   * (resource type, permission, subject) pair.
   */
  watchResources(
    request: WatchResourcesRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<WatchResourcesResponse>>;
}

export interface WatchResourcesServiceClient<CallOptionsExt = {}> {
  /**
   * WatchResources initiates a watch for permission changes for the provided
   * (resource type, permission, subject) pair.
   */
  watchResources(
    request: DeepPartial<WatchResourcesRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<WatchResourcesResponse>;
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
