/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as _m0 from "protobufjs/minimal";
import { Struct } from "../../../google/protobuf/struct.pb";

export const protobufPackage = "authzed.api.v1";

/**
 * Relationship specifies how a resource relates to a subject. Relationships
 * form the data for the graph over which all permissions questions are
 * answered.
 */
export interface Relationship {
  /** resource is the resource to which the subject is related, in some manner */
  resource:
    | ObjectReference
    | undefined;
  /** relation is how the resource and subject are related. */
  relation: string;
  /** subject is the subject to which the resource is related, in some manner. */
  subject:
    | SubjectReference
    | undefined;
  /** optional_caveat is a reference to a the caveat that must be enforced over the relationship */
  optionalCaveat: ContextualizedCaveat | undefined;
}

/**
 * ContextualizedCaveat represents a reference to a caveat to be used by caveated relationships.
 * The context consists of key-value pairs that will be injected at evaluation time.
 * The keys must match the arguments defined on the caveat in the schema.
 */
export interface ContextualizedCaveat {
  /** caveat_name is the name of the caveat expression to use, as defined in the schema */
  caveatName: string;
  /** context consists of any named values that are defined at write time for the caveat expression */
  context: { [key: string]: any } | undefined;
}

/**
 * SubjectReference is used for referring to the subject portion of a
 * Relationship. The relation component is optional and is used for defining a
 * sub-relation on the subject, e.g. group:123#members
 */
export interface SubjectReference {
  object: ObjectReference | undefined;
  optionalRelation: string;
}

/** ObjectReference is used to refer to a specific object in the system. */
export interface ObjectReference {
  objectType: string;
  objectId: string;
}

/**
 * ZedToken is used to provide causality metadata between Write and Check
 * requests.
 *
 * See the authzed.api.v1.Consistency message for more information.
 */
export interface ZedToken {
  token: string;
}

/**
 * Cursor is used to provide resumption of listing between calls to APIs
 * such as LookupResources.
 */
export interface Cursor {
  token: string;
}

/**
 * RelationshipUpdate is used for mutating a single relationship within the
 * service.
 *
 * CREATE will create the relationship only if it doesn't exist, and error
 * otherwise.
 *
 * TOUCH will upsert the relationship, and will not error if it
 * already exists.
 *
 * DELETE will delete the relationship. If the relationship does not exist,
 * this operation will no-op.
 */
export interface RelationshipUpdate {
  operation: RelationshipUpdate_Operation;
  relationship: Relationship | undefined;
}

export enum RelationshipUpdate_Operation {
  OPERATION_UNSPECIFIED = "OPERATION_UNSPECIFIED",
  OPERATION_CREATE = "OPERATION_CREATE",
  OPERATION_TOUCH = "OPERATION_TOUCH",
  OPERATION_DELETE = "OPERATION_DELETE",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function relationshipUpdate_OperationFromJSON(object: any): RelationshipUpdate_Operation {
  switch (object) {
    case 0:
    case "OPERATION_UNSPECIFIED":
      return RelationshipUpdate_Operation.OPERATION_UNSPECIFIED;
    case 1:
    case "OPERATION_CREATE":
      return RelationshipUpdate_Operation.OPERATION_CREATE;
    case 2:
    case "OPERATION_TOUCH":
      return RelationshipUpdate_Operation.OPERATION_TOUCH;
    case 3:
    case "OPERATION_DELETE":
      return RelationshipUpdate_Operation.OPERATION_DELETE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return RelationshipUpdate_Operation.UNRECOGNIZED;
  }
}

export function relationshipUpdate_OperationToJSON(object: RelationshipUpdate_Operation): string {
  switch (object) {
    case RelationshipUpdate_Operation.OPERATION_UNSPECIFIED:
      return "OPERATION_UNSPECIFIED";
    case RelationshipUpdate_Operation.OPERATION_CREATE:
      return "OPERATION_CREATE";
    case RelationshipUpdate_Operation.OPERATION_TOUCH:
      return "OPERATION_TOUCH";
    case RelationshipUpdate_Operation.OPERATION_DELETE:
      return "OPERATION_DELETE";
    case RelationshipUpdate_Operation.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function relationshipUpdate_OperationToNumber(object: RelationshipUpdate_Operation): number {
  switch (object) {
    case RelationshipUpdate_Operation.OPERATION_UNSPECIFIED:
      return 0;
    case RelationshipUpdate_Operation.OPERATION_CREATE:
      return 1;
    case RelationshipUpdate_Operation.OPERATION_TOUCH:
      return 2;
    case RelationshipUpdate_Operation.OPERATION_DELETE:
      return 3;
    case RelationshipUpdate_Operation.UNRECOGNIZED:
    default:
      return -1;
  }
}

/**
 * PermissionRelationshipTree is used for representing a tree of a resource and
 * its permission relationships with other objects.
 */
export interface PermissionRelationshipTree {
  intermediate: AlgebraicSubjectSet | undefined;
  leaf: DirectSubjectSet | undefined;
  expandedObject: ObjectReference | undefined;
  expandedRelation: string;
}

/**
 * AlgebraicSubjectSet is a subject set which is computed based on applying the
 * specified operation to the operands according to the algebra of sets.
 *
 * UNION is a logical set containing the subject members from all operands.
 *
 * INTERSECTION is a logical set containing only the subject members which are
 * present in all operands.
 *
 * EXCLUSION is a logical set containing only the subject members which are
 * present in the first operand, and none of the other operands.
 */
export interface AlgebraicSubjectSet {
  operation: AlgebraicSubjectSet_Operation;
  children: PermissionRelationshipTree[];
}

export enum AlgebraicSubjectSet_Operation {
  OPERATION_UNSPECIFIED = "OPERATION_UNSPECIFIED",
  OPERATION_UNION = "OPERATION_UNION",
  OPERATION_INTERSECTION = "OPERATION_INTERSECTION",
  OPERATION_EXCLUSION = "OPERATION_EXCLUSION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function algebraicSubjectSet_OperationFromJSON(object: any): AlgebraicSubjectSet_Operation {
  switch (object) {
    case 0:
    case "OPERATION_UNSPECIFIED":
      return AlgebraicSubjectSet_Operation.OPERATION_UNSPECIFIED;
    case 1:
    case "OPERATION_UNION":
      return AlgebraicSubjectSet_Operation.OPERATION_UNION;
    case 2:
    case "OPERATION_INTERSECTION":
      return AlgebraicSubjectSet_Operation.OPERATION_INTERSECTION;
    case 3:
    case "OPERATION_EXCLUSION":
      return AlgebraicSubjectSet_Operation.OPERATION_EXCLUSION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return AlgebraicSubjectSet_Operation.UNRECOGNIZED;
  }
}

export function algebraicSubjectSet_OperationToJSON(object: AlgebraicSubjectSet_Operation): string {
  switch (object) {
    case AlgebraicSubjectSet_Operation.OPERATION_UNSPECIFIED:
      return "OPERATION_UNSPECIFIED";
    case AlgebraicSubjectSet_Operation.OPERATION_UNION:
      return "OPERATION_UNION";
    case AlgebraicSubjectSet_Operation.OPERATION_INTERSECTION:
      return "OPERATION_INTERSECTION";
    case AlgebraicSubjectSet_Operation.OPERATION_EXCLUSION:
      return "OPERATION_EXCLUSION";
    case AlgebraicSubjectSet_Operation.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function algebraicSubjectSet_OperationToNumber(object: AlgebraicSubjectSet_Operation): number {
  switch (object) {
    case AlgebraicSubjectSet_Operation.OPERATION_UNSPECIFIED:
      return 0;
    case AlgebraicSubjectSet_Operation.OPERATION_UNION:
      return 1;
    case AlgebraicSubjectSet_Operation.OPERATION_INTERSECTION:
      return 2;
    case AlgebraicSubjectSet_Operation.OPERATION_EXCLUSION:
      return 3;
    case AlgebraicSubjectSet_Operation.UNRECOGNIZED:
    default:
      return -1;
  }
}

/** DirectSubjectSet is a subject set which is simply a collection of subjects. */
export interface DirectSubjectSet {
  subjects: SubjectReference[];
}

/**
 * PartialCaveatInfo carries information necessary for the client to take action
 * in the event a response contains a partially evaluated caveat
 */
export interface PartialCaveatInfo {
  /**
   * missing_required_context is a list of one or more fields that were missing and prevented caveats
   * from being fully evaluated
   */
  missingRequiredContext: string[];
}

function createBaseRelationship(): Relationship {
  return { resource: undefined, relation: "", subject: undefined, optionalCaveat: undefined };
}

export const Relationship = {
  encode(message: Relationship, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.resource !== undefined) {
      ObjectReference.encode(message.resource, writer.uint32(10).fork()).ldelim();
    }
    if (message.relation !== "") {
      writer.uint32(18).string(message.relation);
    }
    if (message.subject !== undefined) {
      SubjectReference.encode(message.subject, writer.uint32(26).fork()).ldelim();
    }
    if (message.optionalCaveat !== undefined) {
      ContextualizedCaveat.encode(message.optionalCaveat, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Relationship {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRelationship();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.resource = ObjectReference.decode(reader, reader.uint32());
          break;
        case 2:
          message.relation = reader.string();
          break;
        case 3:
          message.subject = SubjectReference.decode(reader, reader.uint32());
          break;
        case 4:
          message.optionalCaveat = ContextualizedCaveat.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Relationship {
    return {
      resource: isSet(object.resource) ? ObjectReference.fromJSON(object.resource) : undefined,
      relation: isSet(object.relation) ? String(object.relation) : "",
      subject: isSet(object.subject) ? SubjectReference.fromJSON(object.subject) : undefined,
      optionalCaveat: isSet(object.optionalCaveat) ? ContextualizedCaveat.fromJSON(object.optionalCaveat) : undefined,
    };
  },

  toJSON(message: Relationship): unknown {
    const obj: any = {};
    message.resource !== undefined &&
      (obj.resource = message.resource ? ObjectReference.toJSON(message.resource) : undefined);
    message.relation !== undefined && (obj.relation = message.relation);
    message.subject !== undefined &&
      (obj.subject = message.subject ? SubjectReference.toJSON(message.subject) : undefined);
    message.optionalCaveat !== undefined &&
      (obj.optionalCaveat = message.optionalCaveat ? ContextualizedCaveat.toJSON(message.optionalCaveat) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<Relationship>): Relationship {
    const message = createBaseRelationship();
    message.resource = (object.resource !== undefined && object.resource !== null)
      ? ObjectReference.fromPartial(object.resource)
      : undefined;
    message.relation = object.relation ?? "";
    message.subject = (object.subject !== undefined && object.subject !== null)
      ? SubjectReference.fromPartial(object.subject)
      : undefined;
    message.optionalCaveat = (object.optionalCaveat !== undefined && object.optionalCaveat !== null)
      ? ContextualizedCaveat.fromPartial(object.optionalCaveat)
      : undefined;
    return message;
  },
};

function createBaseContextualizedCaveat(): ContextualizedCaveat {
  return { caveatName: "", context: undefined };
}

export const ContextualizedCaveat = {
  encode(message: ContextualizedCaveat, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.caveatName !== "") {
      writer.uint32(10).string(message.caveatName);
    }
    if (message.context !== undefined) {
      Struct.encode(Struct.wrap(message.context), writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ContextualizedCaveat {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseContextualizedCaveat();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.caveatName = reader.string();
          break;
        case 2:
          message.context = Struct.unwrap(Struct.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ContextualizedCaveat {
    return {
      caveatName: isSet(object.caveatName) ? String(object.caveatName) : "",
      context: isObject(object.context) ? object.context : undefined,
    };
  },

  toJSON(message: ContextualizedCaveat): unknown {
    const obj: any = {};
    message.caveatName !== undefined && (obj.caveatName = message.caveatName);
    message.context !== undefined && (obj.context = message.context);
    return obj;
  },

  fromPartial(object: DeepPartial<ContextualizedCaveat>): ContextualizedCaveat {
    const message = createBaseContextualizedCaveat();
    message.caveatName = object.caveatName ?? "";
    message.context = object.context ?? undefined;
    return message;
  },
};

function createBaseSubjectReference(): SubjectReference {
  return { object: undefined, optionalRelation: "" };
}

export const SubjectReference = {
  encode(message: SubjectReference, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.object !== undefined) {
      ObjectReference.encode(message.object, writer.uint32(10).fork()).ldelim();
    }
    if (message.optionalRelation !== "") {
      writer.uint32(18).string(message.optionalRelation);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubjectReference {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubjectReference();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.object = ObjectReference.decode(reader, reader.uint32());
          break;
        case 2:
          message.optionalRelation = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SubjectReference {
    return {
      object: isSet(object.object) ? ObjectReference.fromJSON(object.object) : undefined,
      optionalRelation: isSet(object.optionalRelation) ? String(object.optionalRelation) : "",
    };
  },

  toJSON(message: SubjectReference): unknown {
    const obj: any = {};
    message.object !== undefined && (obj.object = message.object ? ObjectReference.toJSON(message.object) : undefined);
    message.optionalRelation !== undefined && (obj.optionalRelation = message.optionalRelation);
    return obj;
  },

  fromPartial(object: DeepPartial<SubjectReference>): SubjectReference {
    const message = createBaseSubjectReference();
    message.object = (object.object !== undefined && object.object !== null)
      ? ObjectReference.fromPartial(object.object)
      : undefined;
    message.optionalRelation = object.optionalRelation ?? "";
    return message;
  },
};

function createBaseObjectReference(): ObjectReference {
  return { objectType: "", objectId: "" };
}

export const ObjectReference = {
  encode(message: ObjectReference, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.objectType !== "") {
      writer.uint32(10).string(message.objectType);
    }
    if (message.objectId !== "") {
      writer.uint32(18).string(message.objectId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ObjectReference {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseObjectReference();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.objectType = reader.string();
          break;
        case 2:
          message.objectId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ObjectReference {
    return {
      objectType: isSet(object.objectType) ? String(object.objectType) : "",
      objectId: isSet(object.objectId) ? String(object.objectId) : "",
    };
  },

  toJSON(message: ObjectReference): unknown {
    const obj: any = {};
    message.objectType !== undefined && (obj.objectType = message.objectType);
    message.objectId !== undefined && (obj.objectId = message.objectId);
    return obj;
  },

  fromPartial(object: DeepPartial<ObjectReference>): ObjectReference {
    const message = createBaseObjectReference();
    message.objectType = object.objectType ?? "";
    message.objectId = object.objectId ?? "";
    return message;
  },
};

function createBaseZedToken(): ZedToken {
  return { token: "" };
}

export const ZedToken = {
  encode(message: ZedToken, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== "") {
      writer.uint32(10).string(message.token);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ZedToken {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseZedToken();
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

  fromJSON(object: any): ZedToken {
    return { token: isSet(object.token) ? String(object.token) : "" };
  },

  toJSON(message: ZedToken): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token);
    return obj;
  },

  fromPartial(object: DeepPartial<ZedToken>): ZedToken {
    const message = createBaseZedToken();
    message.token = object.token ?? "";
    return message;
  },
};

function createBaseCursor(): Cursor {
  return { token: "" };
}

export const Cursor = {
  encode(message: Cursor, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== "") {
      writer.uint32(10).string(message.token);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Cursor {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCursor();
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

  fromJSON(object: any): Cursor {
    return { token: isSet(object.token) ? String(object.token) : "" };
  },

  toJSON(message: Cursor): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token);
    return obj;
  },

  fromPartial(object: DeepPartial<Cursor>): Cursor {
    const message = createBaseCursor();
    message.token = object.token ?? "";
    return message;
  },
};

function createBaseRelationshipUpdate(): RelationshipUpdate {
  return { operation: RelationshipUpdate_Operation.OPERATION_UNSPECIFIED, relationship: undefined };
}

export const RelationshipUpdate = {
  encode(message: RelationshipUpdate, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.operation !== RelationshipUpdate_Operation.OPERATION_UNSPECIFIED) {
      writer.uint32(8).int32(relationshipUpdate_OperationToNumber(message.operation));
    }
    if (message.relationship !== undefined) {
      Relationship.encode(message.relationship, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RelationshipUpdate {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRelationshipUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.operation = relationshipUpdate_OperationFromJSON(reader.int32());
          break;
        case 2:
          message.relationship = Relationship.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RelationshipUpdate {
    return {
      operation: isSet(object.operation)
        ? relationshipUpdate_OperationFromJSON(object.operation)
        : RelationshipUpdate_Operation.OPERATION_UNSPECIFIED,
      relationship: isSet(object.relationship) ? Relationship.fromJSON(object.relationship) : undefined,
    };
  },

  toJSON(message: RelationshipUpdate): unknown {
    const obj: any = {};
    message.operation !== undefined && (obj.operation = relationshipUpdate_OperationToJSON(message.operation));
    message.relationship !== undefined &&
      (obj.relationship = message.relationship ? Relationship.toJSON(message.relationship) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<RelationshipUpdate>): RelationshipUpdate {
    const message = createBaseRelationshipUpdate();
    message.operation = object.operation ?? RelationshipUpdate_Operation.OPERATION_UNSPECIFIED;
    message.relationship = (object.relationship !== undefined && object.relationship !== null)
      ? Relationship.fromPartial(object.relationship)
      : undefined;
    return message;
  },
};

function createBasePermissionRelationshipTree(): PermissionRelationshipTree {
  return { intermediate: undefined, leaf: undefined, expandedObject: undefined, expandedRelation: "" };
}

export const PermissionRelationshipTree = {
  encode(message: PermissionRelationshipTree, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.intermediate !== undefined) {
      AlgebraicSubjectSet.encode(message.intermediate, writer.uint32(10).fork()).ldelim();
    }
    if (message.leaf !== undefined) {
      DirectSubjectSet.encode(message.leaf, writer.uint32(18).fork()).ldelim();
    }
    if (message.expandedObject !== undefined) {
      ObjectReference.encode(message.expandedObject, writer.uint32(26).fork()).ldelim();
    }
    if (message.expandedRelation !== "") {
      writer.uint32(34).string(message.expandedRelation);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PermissionRelationshipTree {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePermissionRelationshipTree();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.intermediate = AlgebraicSubjectSet.decode(reader, reader.uint32());
          break;
        case 2:
          message.leaf = DirectSubjectSet.decode(reader, reader.uint32());
          break;
        case 3:
          message.expandedObject = ObjectReference.decode(reader, reader.uint32());
          break;
        case 4:
          message.expandedRelation = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PermissionRelationshipTree {
    return {
      intermediate: isSet(object.intermediate) ? AlgebraicSubjectSet.fromJSON(object.intermediate) : undefined,
      leaf: isSet(object.leaf) ? DirectSubjectSet.fromJSON(object.leaf) : undefined,
      expandedObject: isSet(object.expandedObject) ? ObjectReference.fromJSON(object.expandedObject) : undefined,
      expandedRelation: isSet(object.expandedRelation) ? String(object.expandedRelation) : "",
    };
  },

  toJSON(message: PermissionRelationshipTree): unknown {
    const obj: any = {};
    message.intermediate !== undefined &&
      (obj.intermediate = message.intermediate ? AlgebraicSubjectSet.toJSON(message.intermediate) : undefined);
    message.leaf !== undefined && (obj.leaf = message.leaf ? DirectSubjectSet.toJSON(message.leaf) : undefined);
    message.expandedObject !== undefined &&
      (obj.expandedObject = message.expandedObject ? ObjectReference.toJSON(message.expandedObject) : undefined);
    message.expandedRelation !== undefined && (obj.expandedRelation = message.expandedRelation);
    return obj;
  },

  fromPartial(object: DeepPartial<PermissionRelationshipTree>): PermissionRelationshipTree {
    const message = createBasePermissionRelationshipTree();
    message.intermediate = (object.intermediate !== undefined && object.intermediate !== null)
      ? AlgebraicSubjectSet.fromPartial(object.intermediate)
      : undefined;
    message.leaf = (object.leaf !== undefined && object.leaf !== null)
      ? DirectSubjectSet.fromPartial(object.leaf)
      : undefined;
    message.expandedObject = (object.expandedObject !== undefined && object.expandedObject !== null)
      ? ObjectReference.fromPartial(object.expandedObject)
      : undefined;
    message.expandedRelation = object.expandedRelation ?? "";
    return message;
  },
};

function createBaseAlgebraicSubjectSet(): AlgebraicSubjectSet {
  return { operation: AlgebraicSubjectSet_Operation.OPERATION_UNSPECIFIED, children: [] };
}

export const AlgebraicSubjectSet = {
  encode(message: AlgebraicSubjectSet, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.operation !== AlgebraicSubjectSet_Operation.OPERATION_UNSPECIFIED) {
      writer.uint32(8).int32(algebraicSubjectSet_OperationToNumber(message.operation));
    }
    for (const v of message.children) {
      PermissionRelationshipTree.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AlgebraicSubjectSet {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAlgebraicSubjectSet();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.operation = algebraicSubjectSet_OperationFromJSON(reader.int32());
          break;
        case 2:
          message.children.push(PermissionRelationshipTree.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): AlgebraicSubjectSet {
    return {
      operation: isSet(object.operation)
        ? algebraicSubjectSet_OperationFromJSON(object.operation)
        : AlgebraicSubjectSet_Operation.OPERATION_UNSPECIFIED,
      children: Array.isArray(object?.children)
        ? object.children.map((e: any) => PermissionRelationshipTree.fromJSON(e))
        : [],
    };
  },

  toJSON(message: AlgebraicSubjectSet): unknown {
    const obj: any = {};
    message.operation !== undefined && (obj.operation = algebraicSubjectSet_OperationToJSON(message.operation));
    if (message.children) {
      obj.children = message.children.map((e) => e ? PermissionRelationshipTree.toJSON(e) : undefined);
    } else {
      obj.children = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<AlgebraicSubjectSet>): AlgebraicSubjectSet {
    const message = createBaseAlgebraicSubjectSet();
    message.operation = object.operation ?? AlgebraicSubjectSet_Operation.OPERATION_UNSPECIFIED;
    message.children = object.children?.map((e) => PermissionRelationshipTree.fromPartial(e)) || [];
    return message;
  },
};

function createBaseDirectSubjectSet(): DirectSubjectSet {
  return { subjects: [] };
}

export const DirectSubjectSet = {
  encode(message: DirectSubjectSet, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.subjects) {
      SubjectReference.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DirectSubjectSet {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDirectSubjectSet();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.subjects.push(SubjectReference.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DirectSubjectSet {
    return {
      subjects: Array.isArray(object?.subjects) ? object.subjects.map((e: any) => SubjectReference.fromJSON(e)) : [],
    };
  },

  toJSON(message: DirectSubjectSet): unknown {
    const obj: any = {};
    if (message.subjects) {
      obj.subjects = message.subjects.map((e) => e ? SubjectReference.toJSON(e) : undefined);
    } else {
      obj.subjects = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<DirectSubjectSet>): DirectSubjectSet {
    const message = createBaseDirectSubjectSet();
    message.subjects = object.subjects?.map((e) => SubjectReference.fromPartial(e)) || [];
    return message;
  },
};

function createBasePartialCaveatInfo(): PartialCaveatInfo {
  return { missingRequiredContext: [] };
}

export const PartialCaveatInfo = {
  encode(message: PartialCaveatInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.missingRequiredContext) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PartialCaveatInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePartialCaveatInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.missingRequiredContext.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PartialCaveatInfo {
    return {
      missingRequiredContext: Array.isArray(object?.missingRequiredContext)
        ? object.missingRequiredContext.map((e: any) => String(e))
        : [],
    };
  },

  toJSON(message: PartialCaveatInfo): unknown {
    const obj: any = {};
    if (message.missingRequiredContext) {
      obj.missingRequiredContext = message.missingRequiredContext.map((e) => e);
    } else {
      obj.missingRequiredContext = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<PartialCaveatInfo>): PartialCaveatInfo {
    const message = createBasePartialCaveatInfo();
    message.missingRequiredContext = object.missingRequiredContext?.map((e) => e) || [];
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

function isObject(value: any): boolean {
  return typeof value === "object" && value !== null;
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
