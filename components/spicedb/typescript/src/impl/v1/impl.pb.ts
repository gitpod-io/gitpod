/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as _m0 from "protobufjs/minimal";
import { CheckedExpr } from "../../google/api/expr/v1alpha1/checked.pb";
import Long = require("long");

export const protobufPackage = "impl.v1";

export interface DecodedCaveat {
  cel?: CheckedExpr | undefined;
  name: string;
}

export interface DecodedZookie {
  version: number;
  v1?: DecodedZookie_V1Zookie | undefined;
  v2?: DecodedZookie_V2Zookie | undefined;
}

export interface DecodedZookie_V1Zookie {
  revision: number;
}

export interface DecodedZookie_V2Zookie {
  revision: string;
}

export interface DecodedZedToken {
  deprecatedV1Zookie?: DecodedZedToken_V1Zookie | undefined;
  v1?: DecodedZedToken_V1ZedToken | undefined;
}

export interface DecodedZedToken_V1Zookie {
  revision: number;
}

export interface DecodedZedToken_V1ZedToken {
  revision: string;
}

export interface DecodedCursor {
  v1?: V1Cursor | undefined;
}

export interface V1Cursor {
  /** revision is the string form of the revision for the cursor. */
  revision: string;
  /** sections are the sections of the dispatching cursor. */
  sections: string[];
  /**
   * call_and_parameters_hash is a hash of the call that manufactured this cursor and all its
   * parameters, including limits and zedtoken, to ensure no inputs changed when using this cursor.
   */
  callAndParametersHash: string;
}

export interface DocComment {
  comment: string;
}

export interface RelationMetadata {
  kind: RelationMetadata_RelationKind;
}

export enum RelationMetadata_RelationKind {
  UNKNOWN_KIND = "UNKNOWN_KIND",
  RELATION = "RELATION",
  PERMISSION = "PERMISSION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function relationMetadata_RelationKindFromJSON(object: any): RelationMetadata_RelationKind {
  switch (object) {
    case 0:
    case "UNKNOWN_KIND":
      return RelationMetadata_RelationKind.UNKNOWN_KIND;
    case 1:
    case "RELATION":
      return RelationMetadata_RelationKind.RELATION;
    case 2:
    case "PERMISSION":
      return RelationMetadata_RelationKind.PERMISSION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return RelationMetadata_RelationKind.UNRECOGNIZED;
  }
}

export function relationMetadata_RelationKindToJSON(object: RelationMetadata_RelationKind): string {
  switch (object) {
    case RelationMetadata_RelationKind.UNKNOWN_KIND:
      return "UNKNOWN_KIND";
    case RelationMetadata_RelationKind.RELATION:
      return "RELATION";
    case RelationMetadata_RelationKind.PERMISSION:
      return "PERMISSION";
    case RelationMetadata_RelationKind.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function relationMetadata_RelationKindToNumber(object: RelationMetadata_RelationKind): number {
  switch (object) {
    case RelationMetadata_RelationKind.UNKNOWN_KIND:
      return 0;
    case RelationMetadata_RelationKind.RELATION:
      return 1;
    case RelationMetadata_RelationKind.PERMISSION:
      return 2;
    case RelationMetadata_RelationKind.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface NamespaceAndRevision {
  namespaceName: string;
  revision: string;
}

export interface V1Alpha1Revision {
  nsRevisions: NamespaceAndRevision[];
}

function createBaseDecodedCaveat(): DecodedCaveat {
  return { cel: undefined, name: "" };
}

export const DecodedCaveat = {
  encode(message: DecodedCaveat, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.cel !== undefined) {
      CheckedExpr.encode(message.cel, writer.uint32(10).fork()).ldelim();
    }
    if (message.name !== "") {
      writer.uint32(18).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedCaveat {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedCaveat();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.cel = CheckedExpr.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.name = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedCaveat {
    return {
      cel: isSet(object.cel) ? CheckedExpr.fromJSON(object.cel) : undefined,
      name: isSet(object.name) ? String(object.name) : "",
    };
  },

  toJSON(message: DecodedCaveat): unknown {
    const obj: any = {};
    if (message.cel !== undefined) {
      obj.cel = CheckedExpr.toJSON(message.cel);
    }
    if (message.name !== "") {
      obj.name = message.name;
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedCaveat>): DecodedCaveat {
    return DecodedCaveat.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedCaveat>): DecodedCaveat {
    const message = createBaseDecodedCaveat();
    message.cel = (object.cel !== undefined && object.cel !== null) ? CheckedExpr.fromPartial(object.cel) : undefined;
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseDecodedZookie(): DecodedZookie {
  return { version: 0, v1: undefined, v2: undefined };
}

export const DecodedZookie = {
  encode(message: DecodedZookie, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.version !== 0) {
      writer.uint32(8).uint32(message.version);
    }
    if (message.v1 !== undefined) {
      DecodedZookie_V1Zookie.encode(message.v1, writer.uint32(18).fork()).ldelim();
    }
    if (message.v2 !== undefined) {
      DecodedZookie_V2Zookie.encode(message.v2, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedZookie {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedZookie();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.version = reader.uint32();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.v1 = DecodedZookie_V1Zookie.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.v2 = DecodedZookie_V2Zookie.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedZookie {
    return {
      version: isSet(object.version) ? Number(object.version) : 0,
      v1: isSet(object.v1) ? DecodedZookie_V1Zookie.fromJSON(object.v1) : undefined,
      v2: isSet(object.v2) ? DecodedZookie_V2Zookie.fromJSON(object.v2) : undefined,
    };
  },

  toJSON(message: DecodedZookie): unknown {
    const obj: any = {};
    if (message.version !== 0) {
      obj.version = Math.round(message.version);
    }
    if (message.v1 !== undefined) {
      obj.v1 = DecodedZookie_V1Zookie.toJSON(message.v1);
    }
    if (message.v2 !== undefined) {
      obj.v2 = DecodedZookie_V2Zookie.toJSON(message.v2);
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedZookie>): DecodedZookie {
    return DecodedZookie.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedZookie>): DecodedZookie {
    const message = createBaseDecodedZookie();
    message.version = object.version ?? 0;
    message.v1 = (object.v1 !== undefined && object.v1 !== null)
      ? DecodedZookie_V1Zookie.fromPartial(object.v1)
      : undefined;
    message.v2 = (object.v2 !== undefined && object.v2 !== null)
      ? DecodedZookie_V2Zookie.fromPartial(object.v2)
      : undefined;
    return message;
  },
};

function createBaseDecodedZookie_V1Zookie(): DecodedZookie_V1Zookie {
  return { revision: 0 };
}

export const DecodedZookie_V1Zookie = {
  encode(message: DecodedZookie_V1Zookie, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.revision !== 0) {
      writer.uint32(8).uint64(message.revision);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedZookie_V1Zookie {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedZookie_V1Zookie();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.revision = longToNumber(reader.uint64() as Long);
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedZookie_V1Zookie {
    return { revision: isSet(object.revision) ? Number(object.revision) : 0 };
  },

  toJSON(message: DecodedZookie_V1Zookie): unknown {
    const obj: any = {};
    if (message.revision !== 0) {
      obj.revision = Math.round(message.revision);
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedZookie_V1Zookie>): DecodedZookie_V1Zookie {
    return DecodedZookie_V1Zookie.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedZookie_V1Zookie>): DecodedZookie_V1Zookie {
    const message = createBaseDecodedZookie_V1Zookie();
    message.revision = object.revision ?? 0;
    return message;
  },
};

function createBaseDecodedZookie_V2Zookie(): DecodedZookie_V2Zookie {
  return { revision: "" };
}

export const DecodedZookie_V2Zookie = {
  encode(message: DecodedZookie_V2Zookie, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.revision !== "") {
      writer.uint32(10).string(message.revision);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedZookie_V2Zookie {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedZookie_V2Zookie();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.revision = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedZookie_V2Zookie {
    return { revision: isSet(object.revision) ? String(object.revision) : "" };
  },

  toJSON(message: DecodedZookie_V2Zookie): unknown {
    const obj: any = {};
    if (message.revision !== "") {
      obj.revision = message.revision;
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedZookie_V2Zookie>): DecodedZookie_V2Zookie {
    return DecodedZookie_V2Zookie.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedZookie_V2Zookie>): DecodedZookie_V2Zookie {
    const message = createBaseDecodedZookie_V2Zookie();
    message.revision = object.revision ?? "";
    return message;
  },
};

function createBaseDecodedZedToken(): DecodedZedToken {
  return { deprecatedV1Zookie: undefined, v1: undefined };
}

export const DecodedZedToken = {
  encode(message: DecodedZedToken, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.deprecatedV1Zookie !== undefined) {
      DecodedZedToken_V1Zookie.encode(message.deprecatedV1Zookie, writer.uint32(18).fork()).ldelim();
    }
    if (message.v1 !== undefined) {
      DecodedZedToken_V1ZedToken.encode(message.v1, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedZedToken {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedZedToken();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          if (tag !== 18) {
            break;
          }

          message.deprecatedV1Zookie = DecodedZedToken_V1Zookie.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.v1 = DecodedZedToken_V1ZedToken.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedZedToken {
    return {
      deprecatedV1Zookie: isSet(object.deprecatedV1Zookie)
        ? DecodedZedToken_V1Zookie.fromJSON(object.deprecatedV1Zookie)
        : undefined,
      v1: isSet(object.v1) ? DecodedZedToken_V1ZedToken.fromJSON(object.v1) : undefined,
    };
  },

  toJSON(message: DecodedZedToken): unknown {
    const obj: any = {};
    if (message.deprecatedV1Zookie !== undefined) {
      obj.deprecatedV1Zookie = DecodedZedToken_V1Zookie.toJSON(message.deprecatedV1Zookie);
    }
    if (message.v1 !== undefined) {
      obj.v1 = DecodedZedToken_V1ZedToken.toJSON(message.v1);
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedZedToken>): DecodedZedToken {
    return DecodedZedToken.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedZedToken>): DecodedZedToken {
    const message = createBaseDecodedZedToken();
    message.deprecatedV1Zookie = (object.deprecatedV1Zookie !== undefined && object.deprecatedV1Zookie !== null)
      ? DecodedZedToken_V1Zookie.fromPartial(object.deprecatedV1Zookie)
      : undefined;
    message.v1 = (object.v1 !== undefined && object.v1 !== null)
      ? DecodedZedToken_V1ZedToken.fromPartial(object.v1)
      : undefined;
    return message;
  },
};

function createBaseDecodedZedToken_V1Zookie(): DecodedZedToken_V1Zookie {
  return { revision: 0 };
}

export const DecodedZedToken_V1Zookie = {
  encode(message: DecodedZedToken_V1Zookie, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.revision !== 0) {
      writer.uint32(8).uint64(message.revision);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedZedToken_V1Zookie {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedZedToken_V1Zookie();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.revision = longToNumber(reader.uint64() as Long);
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedZedToken_V1Zookie {
    return { revision: isSet(object.revision) ? Number(object.revision) : 0 };
  },

  toJSON(message: DecodedZedToken_V1Zookie): unknown {
    const obj: any = {};
    if (message.revision !== 0) {
      obj.revision = Math.round(message.revision);
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedZedToken_V1Zookie>): DecodedZedToken_V1Zookie {
    return DecodedZedToken_V1Zookie.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedZedToken_V1Zookie>): DecodedZedToken_V1Zookie {
    const message = createBaseDecodedZedToken_V1Zookie();
    message.revision = object.revision ?? 0;
    return message;
  },
};

function createBaseDecodedZedToken_V1ZedToken(): DecodedZedToken_V1ZedToken {
  return { revision: "" };
}

export const DecodedZedToken_V1ZedToken = {
  encode(message: DecodedZedToken_V1ZedToken, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.revision !== "") {
      writer.uint32(10).string(message.revision);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedZedToken_V1ZedToken {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedZedToken_V1ZedToken();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.revision = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedZedToken_V1ZedToken {
    return { revision: isSet(object.revision) ? String(object.revision) : "" };
  },

  toJSON(message: DecodedZedToken_V1ZedToken): unknown {
    const obj: any = {};
    if (message.revision !== "") {
      obj.revision = message.revision;
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedZedToken_V1ZedToken>): DecodedZedToken_V1ZedToken {
    return DecodedZedToken_V1ZedToken.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedZedToken_V1ZedToken>): DecodedZedToken_V1ZedToken {
    const message = createBaseDecodedZedToken_V1ZedToken();
    message.revision = object.revision ?? "";
    return message;
  },
};

function createBaseDecodedCursor(): DecodedCursor {
  return { v1: undefined };
}

export const DecodedCursor = {
  encode(message: DecodedCursor, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.v1 !== undefined) {
      V1Cursor.encode(message.v1, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DecodedCursor {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDecodedCursor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.v1 = V1Cursor.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DecodedCursor {
    return { v1: isSet(object.v1) ? V1Cursor.fromJSON(object.v1) : undefined };
  },

  toJSON(message: DecodedCursor): unknown {
    const obj: any = {};
    if (message.v1 !== undefined) {
      obj.v1 = V1Cursor.toJSON(message.v1);
    }
    return obj;
  },

  create(base?: DeepPartial<DecodedCursor>): DecodedCursor {
    return DecodedCursor.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DecodedCursor>): DecodedCursor {
    const message = createBaseDecodedCursor();
    message.v1 = (object.v1 !== undefined && object.v1 !== null) ? V1Cursor.fromPartial(object.v1) : undefined;
    return message;
  },
};

function createBaseV1Cursor(): V1Cursor {
  return { revision: "", sections: [], callAndParametersHash: "" };
}

export const V1Cursor = {
  encode(message: V1Cursor, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.revision !== "") {
      writer.uint32(10).string(message.revision);
    }
    for (const v of message.sections) {
      writer.uint32(18).string(v!);
    }
    if (message.callAndParametersHash !== "") {
      writer.uint32(26).string(message.callAndParametersHash);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): V1Cursor {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseV1Cursor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.revision = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.sections.push(reader.string());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.callAndParametersHash = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): V1Cursor {
    return {
      revision: isSet(object.revision) ? String(object.revision) : "",
      sections: Array.isArray(object?.sections) ? object.sections.map((e: any) => String(e)) : [],
      callAndParametersHash: isSet(object.callAndParametersHash) ? String(object.callAndParametersHash) : "",
    };
  },

  toJSON(message: V1Cursor): unknown {
    const obj: any = {};
    if (message.revision !== "") {
      obj.revision = message.revision;
    }
    if (message.sections?.length) {
      obj.sections = message.sections;
    }
    if (message.callAndParametersHash !== "") {
      obj.callAndParametersHash = message.callAndParametersHash;
    }
    return obj;
  },

  create(base?: DeepPartial<V1Cursor>): V1Cursor {
    return V1Cursor.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<V1Cursor>): V1Cursor {
    const message = createBaseV1Cursor();
    message.revision = object.revision ?? "";
    message.sections = object.sections?.map((e) => e) || [];
    message.callAndParametersHash = object.callAndParametersHash ?? "";
    return message;
  },
};

function createBaseDocComment(): DocComment {
  return { comment: "" };
}

export const DocComment = {
  encode(message: DocComment, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.comment !== "") {
      writer.uint32(10).string(message.comment);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DocComment {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDocComment();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.comment = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): DocComment {
    return { comment: isSet(object.comment) ? String(object.comment) : "" };
  },

  toJSON(message: DocComment): unknown {
    const obj: any = {};
    if (message.comment !== "") {
      obj.comment = message.comment;
    }
    return obj;
  },

  create(base?: DeepPartial<DocComment>): DocComment {
    return DocComment.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<DocComment>): DocComment {
    const message = createBaseDocComment();
    message.comment = object.comment ?? "";
    return message;
  },
};

function createBaseRelationMetadata(): RelationMetadata {
  return { kind: RelationMetadata_RelationKind.UNKNOWN_KIND };
}

export const RelationMetadata = {
  encode(message: RelationMetadata, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.kind !== RelationMetadata_RelationKind.UNKNOWN_KIND) {
      writer.uint32(8).int32(relationMetadata_RelationKindToNumber(message.kind));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RelationMetadata {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRelationMetadata();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.kind = relationMetadata_RelationKindFromJSON(reader.int32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): RelationMetadata {
    return {
      kind: isSet(object.kind)
        ? relationMetadata_RelationKindFromJSON(object.kind)
        : RelationMetadata_RelationKind.UNKNOWN_KIND,
    };
  },

  toJSON(message: RelationMetadata): unknown {
    const obj: any = {};
    if (message.kind !== RelationMetadata_RelationKind.UNKNOWN_KIND) {
      obj.kind = relationMetadata_RelationKindToJSON(message.kind);
    }
    return obj;
  },

  create(base?: DeepPartial<RelationMetadata>): RelationMetadata {
    return RelationMetadata.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<RelationMetadata>): RelationMetadata {
    const message = createBaseRelationMetadata();
    message.kind = object.kind ?? RelationMetadata_RelationKind.UNKNOWN_KIND;
    return message;
  },
};

function createBaseNamespaceAndRevision(): NamespaceAndRevision {
  return { namespaceName: "", revision: "" };
}

export const NamespaceAndRevision = {
  encode(message: NamespaceAndRevision, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.namespaceName !== "") {
      writer.uint32(10).string(message.namespaceName);
    }
    if (message.revision !== "") {
      writer.uint32(18).string(message.revision);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NamespaceAndRevision {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNamespaceAndRevision();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.namespaceName = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.revision = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): NamespaceAndRevision {
    return {
      namespaceName: isSet(object.namespaceName) ? String(object.namespaceName) : "",
      revision: isSet(object.revision) ? String(object.revision) : "",
    };
  },

  toJSON(message: NamespaceAndRevision): unknown {
    const obj: any = {};
    if (message.namespaceName !== "") {
      obj.namespaceName = message.namespaceName;
    }
    if (message.revision !== "") {
      obj.revision = message.revision;
    }
    return obj;
  },

  create(base?: DeepPartial<NamespaceAndRevision>): NamespaceAndRevision {
    return NamespaceAndRevision.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<NamespaceAndRevision>): NamespaceAndRevision {
    const message = createBaseNamespaceAndRevision();
    message.namespaceName = object.namespaceName ?? "";
    message.revision = object.revision ?? "";
    return message;
  },
};

function createBaseV1Alpha1Revision(): V1Alpha1Revision {
  return { nsRevisions: [] };
}

export const V1Alpha1Revision = {
  encode(message: V1Alpha1Revision, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.nsRevisions) {
      NamespaceAndRevision.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): V1Alpha1Revision {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseV1Alpha1Revision();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.nsRevisions.push(NamespaceAndRevision.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): V1Alpha1Revision {
    return {
      nsRevisions: Array.isArray(object?.nsRevisions)
        ? object.nsRevisions.map((e: any) => NamespaceAndRevision.fromJSON(e))
        : [],
    };
  },

  toJSON(message: V1Alpha1Revision): unknown {
    const obj: any = {};
    if (message.nsRevisions?.length) {
      obj.nsRevisions = message.nsRevisions.map((e) => NamespaceAndRevision.toJSON(e));
    }
    return obj;
  },

  create(base?: DeepPartial<V1Alpha1Revision>): V1Alpha1Revision {
    return V1Alpha1Revision.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<V1Alpha1Revision>): V1Alpha1Revision {
    const message = createBaseV1Alpha1Revision();
    message.nsRevisions = object.nsRevisions?.map((e) => NamespaceAndRevision.fromPartial(e)) || [];
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

declare const self: any | undefined;
declare const window: any | undefined;
declare const global: any | undefined;
const tsProtoGlobalThis: any = (() => {
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
    throw new tsProtoGlobalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  return long.toNumber();
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
