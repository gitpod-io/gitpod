/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "authzed.api.v0";

export interface RelationTuple {
  /**
   * Each tupleset specifies keys of a set of relation tuples. The set can
   * include a single tuple key, or all tuples with a given object ID or
   * userset in a namespace, optionally constrained by a relation name.
   *
   * examples:
   * doc:readme#viewer@group:eng#member (fully specified)
   * doc:*#*#group:eng#member (all tuples that this userset relates to)
   * doc:12345#*#* (all tuples with a direct relationship to a document)
   * doc:12345#writer#* (all tuples with direct write relationship with the
   * document) doc:#writer#group:eng#member (all tuples that eng group has write
   * relationship)
   */
  objectAndRelation: ObjectAndRelation | undefined;
  user: User | undefined;
}

export interface ObjectAndRelation {
  namespace: string;
  objectId: string;
  relation: string;
}

export interface RelationReference {
  namespace: string;
  relation: string;
}

export interface User {
  userset: ObjectAndRelation | undefined;
}

function createBaseRelationTuple(): RelationTuple {
  return { objectAndRelation: undefined, user: undefined };
}

export const RelationTuple = {
  encode(message: RelationTuple, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.objectAndRelation !== undefined) {
      ObjectAndRelation.encode(message.objectAndRelation, writer.uint32(10).fork()).ldelim();
    }
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RelationTuple {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRelationTuple();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.objectAndRelation = ObjectAndRelation.decode(reader, reader.uint32());
          break;
        case 2:
          message.user = User.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RelationTuple {
    return {
      objectAndRelation: isSet(object.objectAndRelation)
        ? ObjectAndRelation.fromJSON(object.objectAndRelation)
        : undefined,
      user: isSet(object.user) ? User.fromJSON(object.user) : undefined,
    };
  },

  toJSON(message: RelationTuple): unknown {
    const obj: any = {};
    message.objectAndRelation !== undefined && (obj.objectAndRelation = message.objectAndRelation
      ? ObjectAndRelation.toJSON(message.objectAndRelation)
      : undefined);
    message.user !== undefined && (obj.user = message.user ? User.toJSON(message.user) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<RelationTuple>): RelationTuple {
    const message = createBaseRelationTuple();
    message.objectAndRelation = (object.objectAndRelation !== undefined && object.objectAndRelation !== null)
      ? ObjectAndRelation.fromPartial(object.objectAndRelation)
      : undefined;
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseObjectAndRelation(): ObjectAndRelation {
  return { namespace: "", objectId: "", relation: "" };
}

export const ObjectAndRelation = {
  encode(message: ObjectAndRelation, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.namespace !== "") {
      writer.uint32(10).string(message.namespace);
    }
    if (message.objectId !== "") {
      writer.uint32(18).string(message.objectId);
    }
    if (message.relation !== "") {
      writer.uint32(26).string(message.relation);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ObjectAndRelation {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseObjectAndRelation();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.namespace = reader.string();
          break;
        case 2:
          message.objectId = reader.string();
          break;
        case 3:
          message.relation = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ObjectAndRelation {
    return {
      namespace: isSet(object.namespace) ? String(object.namespace) : "",
      objectId: isSet(object.objectId) ? String(object.objectId) : "",
      relation: isSet(object.relation) ? String(object.relation) : "",
    };
  },

  toJSON(message: ObjectAndRelation): unknown {
    const obj: any = {};
    message.namespace !== undefined && (obj.namespace = message.namespace);
    message.objectId !== undefined && (obj.objectId = message.objectId);
    message.relation !== undefined && (obj.relation = message.relation);
    return obj;
  },

  fromPartial(object: DeepPartial<ObjectAndRelation>): ObjectAndRelation {
    const message = createBaseObjectAndRelation();
    message.namespace = object.namespace ?? "";
    message.objectId = object.objectId ?? "";
    message.relation = object.relation ?? "";
    return message;
  },
};

function createBaseRelationReference(): RelationReference {
  return { namespace: "", relation: "" };
}

export const RelationReference = {
  encode(message: RelationReference, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.namespace !== "") {
      writer.uint32(10).string(message.namespace);
    }
    if (message.relation !== "") {
      writer.uint32(26).string(message.relation);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RelationReference {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRelationReference();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.namespace = reader.string();
          break;
        case 3:
          message.relation = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RelationReference {
    return {
      namespace: isSet(object.namespace) ? String(object.namespace) : "",
      relation: isSet(object.relation) ? String(object.relation) : "",
    };
  },

  toJSON(message: RelationReference): unknown {
    const obj: any = {};
    message.namespace !== undefined && (obj.namespace = message.namespace);
    message.relation !== undefined && (obj.relation = message.relation);
    return obj;
  },

  fromPartial(object: DeepPartial<RelationReference>): RelationReference {
    const message = createBaseRelationReference();
    message.namespace = object.namespace ?? "";
    message.relation = object.relation ?? "";
    return message;
  },
};

function createBaseUser(): User {
  return { userset: undefined };
}

export const User = {
  encode(message: User, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userset !== undefined) {
      ObjectAndRelation.encode(message.userset, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): User {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUser();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          message.userset = ObjectAndRelation.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): User {
    return { userset: isSet(object.userset) ? ObjectAndRelation.fromJSON(object.userset) : undefined };
  },

  toJSON(message: User): unknown {
    const obj: any = {};
    message.userset !== undefined &&
      (obj.userset = message.userset ? ObjectAndRelation.toJSON(message.userset) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<User>): User {
    const message = createBaseUser();
    message.userset = (object.userset !== undefined && object.userset !== null)
      ? ObjectAndRelation.fromPartial(object.userset)
      : undefined;
    return message;
  },
};

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
