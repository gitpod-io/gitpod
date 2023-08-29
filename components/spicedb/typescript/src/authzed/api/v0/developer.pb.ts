/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { RelationTuple } from "./core.pb";

export const protobufPackage = "authzed.api.v0";

export interface FormatSchemaRequest {
  schema: string;
}

export interface FormatSchemaResponse {
  error: DeveloperError | undefined;
  formattedSchema: string;
}

export interface UpgradeSchemaRequest {
  namespaceConfigs: string[];
}

export interface UpgradeSchemaResponse {
  error: DeveloperError | undefined;
  upgradedSchema: string;
}

export interface ShareRequest {
  schema: string;
  relationshipsYaml: string;
  validationYaml: string;
  assertionsYaml: string;
}

export interface ShareResponse {
  shareReference: string;
}

export interface LookupShareRequest {
  shareReference: string;
}

export interface LookupShareResponse {
  status: LookupShareResponse_LookupStatus;
  schema: string;
  relationshipsYaml: string;
  validationYaml: string;
  assertionsYaml: string;
}

export enum LookupShareResponse_LookupStatus {
  UNKNOWN_REFERENCE = "UNKNOWN_REFERENCE",
  FAILED_TO_LOOKUP = "FAILED_TO_LOOKUP",
  VALID_REFERENCE = "VALID_REFERENCE",
  UPGRADED_REFERENCE = "UPGRADED_REFERENCE",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function lookupShareResponse_LookupStatusFromJSON(object: any): LookupShareResponse_LookupStatus {
  switch (object) {
    case 0:
    case "UNKNOWN_REFERENCE":
      return LookupShareResponse_LookupStatus.UNKNOWN_REFERENCE;
    case 1:
    case "FAILED_TO_LOOKUP":
      return LookupShareResponse_LookupStatus.FAILED_TO_LOOKUP;
    case 2:
    case "VALID_REFERENCE":
      return LookupShareResponse_LookupStatus.VALID_REFERENCE;
    case 3:
    case "UPGRADED_REFERENCE":
      return LookupShareResponse_LookupStatus.UPGRADED_REFERENCE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return LookupShareResponse_LookupStatus.UNRECOGNIZED;
  }
}

export function lookupShareResponse_LookupStatusToJSON(object: LookupShareResponse_LookupStatus): string {
  switch (object) {
    case LookupShareResponse_LookupStatus.UNKNOWN_REFERENCE:
      return "UNKNOWN_REFERENCE";
    case LookupShareResponse_LookupStatus.FAILED_TO_LOOKUP:
      return "FAILED_TO_LOOKUP";
    case LookupShareResponse_LookupStatus.VALID_REFERENCE:
      return "VALID_REFERENCE";
    case LookupShareResponse_LookupStatus.UPGRADED_REFERENCE:
      return "UPGRADED_REFERENCE";
    case LookupShareResponse_LookupStatus.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function lookupShareResponse_LookupStatusToNumber(object: LookupShareResponse_LookupStatus): number {
  switch (object) {
    case LookupShareResponse_LookupStatus.UNKNOWN_REFERENCE:
      return 0;
    case LookupShareResponse_LookupStatus.FAILED_TO_LOOKUP:
      return 1;
    case LookupShareResponse_LookupStatus.VALID_REFERENCE:
      return 2;
    case LookupShareResponse_LookupStatus.UPGRADED_REFERENCE:
      return 3;
    case LookupShareResponse_LookupStatus.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface RequestContext {
  schema: string;
  relationships: RelationTuple[];
}

export interface EditCheckRequest {
  context: RequestContext | undefined;
  checkRelationships: RelationTuple[];
}

export interface EditCheckResult {
  relationship: RelationTuple | undefined;
  isMember: boolean;
  error: DeveloperError | undefined;
}

export interface EditCheckResponse {
  requestErrors: DeveloperError[];
  checkResults: EditCheckResult[];
}

export interface ValidateRequest {
  context: RequestContext | undefined;
  validationYaml: string;
  updateValidationYaml: boolean;
  assertionsYaml: string;
}

export interface ValidateResponse {
  requestErrors: DeveloperError[];
  validationErrors: DeveloperError[];
  updatedValidationYaml: string;
}

export interface DeveloperError {
  message: string;
  line: number;
  column: number;
  source: DeveloperError_Source;
  kind: DeveloperError_ErrorKind;
  path: string[];
  /**
   * context holds the context for the error. For schema issues, this will be the
   * name of the object type. For relationship issues, the full relationship string.
   */
  context: string;
}

export enum DeveloperError_Source {
  UNKNOWN_SOURCE = "UNKNOWN_SOURCE",
  SCHEMA = "SCHEMA",
  RELATIONSHIP = "RELATIONSHIP",
  VALIDATION_YAML = "VALIDATION_YAML",
  CHECK_WATCH = "CHECK_WATCH",
  ASSERTION = "ASSERTION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function developerError_SourceFromJSON(object: any): DeveloperError_Source {
  switch (object) {
    case 0:
    case "UNKNOWN_SOURCE":
      return DeveloperError_Source.UNKNOWN_SOURCE;
    case 1:
    case "SCHEMA":
      return DeveloperError_Source.SCHEMA;
    case 2:
    case "RELATIONSHIP":
      return DeveloperError_Source.RELATIONSHIP;
    case 3:
    case "VALIDATION_YAML":
      return DeveloperError_Source.VALIDATION_YAML;
    case 4:
    case "CHECK_WATCH":
      return DeveloperError_Source.CHECK_WATCH;
    case 5:
    case "ASSERTION":
      return DeveloperError_Source.ASSERTION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return DeveloperError_Source.UNRECOGNIZED;
  }
}

export function developerError_SourceToJSON(object: DeveloperError_Source): string {
  switch (object) {
    case DeveloperError_Source.UNKNOWN_SOURCE:
      return "UNKNOWN_SOURCE";
    case DeveloperError_Source.SCHEMA:
      return "SCHEMA";
    case DeveloperError_Source.RELATIONSHIP:
      return "RELATIONSHIP";
    case DeveloperError_Source.VALIDATION_YAML:
      return "VALIDATION_YAML";
    case DeveloperError_Source.CHECK_WATCH:
      return "CHECK_WATCH";
    case DeveloperError_Source.ASSERTION:
      return "ASSERTION";
    case DeveloperError_Source.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function developerError_SourceToNumber(object: DeveloperError_Source): number {
  switch (object) {
    case DeveloperError_Source.UNKNOWN_SOURCE:
      return 0;
    case DeveloperError_Source.SCHEMA:
      return 1;
    case DeveloperError_Source.RELATIONSHIP:
      return 2;
    case DeveloperError_Source.VALIDATION_YAML:
      return 3;
    case DeveloperError_Source.CHECK_WATCH:
      return 4;
    case DeveloperError_Source.ASSERTION:
      return 5;
    case DeveloperError_Source.UNRECOGNIZED:
    default:
      return -1;
  }
}

export enum DeveloperError_ErrorKind {
  UNKNOWN_KIND = "UNKNOWN_KIND",
  PARSE_ERROR = "PARSE_ERROR",
  SCHEMA_ISSUE = "SCHEMA_ISSUE",
  DUPLICATE_RELATIONSHIP = "DUPLICATE_RELATIONSHIP",
  MISSING_EXPECTED_RELATIONSHIP = "MISSING_EXPECTED_RELATIONSHIP",
  EXTRA_RELATIONSHIP_FOUND = "EXTRA_RELATIONSHIP_FOUND",
  UNKNOWN_OBJECT_TYPE = "UNKNOWN_OBJECT_TYPE",
  UNKNOWN_RELATION = "UNKNOWN_RELATION",
  MAXIMUM_RECURSION = "MAXIMUM_RECURSION",
  ASSERTION_FAILED = "ASSERTION_FAILED",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function developerError_ErrorKindFromJSON(object: any): DeveloperError_ErrorKind {
  switch (object) {
    case 0:
    case "UNKNOWN_KIND":
      return DeveloperError_ErrorKind.UNKNOWN_KIND;
    case 1:
    case "PARSE_ERROR":
      return DeveloperError_ErrorKind.PARSE_ERROR;
    case 2:
    case "SCHEMA_ISSUE":
      return DeveloperError_ErrorKind.SCHEMA_ISSUE;
    case 3:
    case "DUPLICATE_RELATIONSHIP":
      return DeveloperError_ErrorKind.DUPLICATE_RELATIONSHIP;
    case 4:
    case "MISSING_EXPECTED_RELATIONSHIP":
      return DeveloperError_ErrorKind.MISSING_EXPECTED_RELATIONSHIP;
    case 5:
    case "EXTRA_RELATIONSHIP_FOUND":
      return DeveloperError_ErrorKind.EXTRA_RELATIONSHIP_FOUND;
    case 6:
    case "UNKNOWN_OBJECT_TYPE":
      return DeveloperError_ErrorKind.UNKNOWN_OBJECT_TYPE;
    case 7:
    case "UNKNOWN_RELATION":
      return DeveloperError_ErrorKind.UNKNOWN_RELATION;
    case 8:
    case "MAXIMUM_RECURSION":
      return DeveloperError_ErrorKind.MAXIMUM_RECURSION;
    case 9:
    case "ASSERTION_FAILED":
      return DeveloperError_ErrorKind.ASSERTION_FAILED;
    case -1:
    case "UNRECOGNIZED":
    default:
      return DeveloperError_ErrorKind.UNRECOGNIZED;
  }
}

export function developerError_ErrorKindToJSON(object: DeveloperError_ErrorKind): string {
  switch (object) {
    case DeveloperError_ErrorKind.UNKNOWN_KIND:
      return "UNKNOWN_KIND";
    case DeveloperError_ErrorKind.PARSE_ERROR:
      return "PARSE_ERROR";
    case DeveloperError_ErrorKind.SCHEMA_ISSUE:
      return "SCHEMA_ISSUE";
    case DeveloperError_ErrorKind.DUPLICATE_RELATIONSHIP:
      return "DUPLICATE_RELATIONSHIP";
    case DeveloperError_ErrorKind.MISSING_EXPECTED_RELATIONSHIP:
      return "MISSING_EXPECTED_RELATIONSHIP";
    case DeveloperError_ErrorKind.EXTRA_RELATIONSHIP_FOUND:
      return "EXTRA_RELATIONSHIP_FOUND";
    case DeveloperError_ErrorKind.UNKNOWN_OBJECT_TYPE:
      return "UNKNOWN_OBJECT_TYPE";
    case DeveloperError_ErrorKind.UNKNOWN_RELATION:
      return "UNKNOWN_RELATION";
    case DeveloperError_ErrorKind.MAXIMUM_RECURSION:
      return "MAXIMUM_RECURSION";
    case DeveloperError_ErrorKind.ASSERTION_FAILED:
      return "ASSERTION_FAILED";
    case DeveloperError_ErrorKind.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function developerError_ErrorKindToNumber(object: DeveloperError_ErrorKind): number {
  switch (object) {
    case DeveloperError_ErrorKind.UNKNOWN_KIND:
      return 0;
    case DeveloperError_ErrorKind.PARSE_ERROR:
      return 1;
    case DeveloperError_ErrorKind.SCHEMA_ISSUE:
      return 2;
    case DeveloperError_ErrorKind.DUPLICATE_RELATIONSHIP:
      return 3;
    case DeveloperError_ErrorKind.MISSING_EXPECTED_RELATIONSHIP:
      return 4;
    case DeveloperError_ErrorKind.EXTRA_RELATIONSHIP_FOUND:
      return 5;
    case DeveloperError_ErrorKind.UNKNOWN_OBJECT_TYPE:
      return 6;
    case DeveloperError_ErrorKind.UNKNOWN_RELATION:
      return 7;
    case DeveloperError_ErrorKind.MAXIMUM_RECURSION:
      return 8;
    case DeveloperError_ErrorKind.ASSERTION_FAILED:
      return 9;
    case DeveloperError_ErrorKind.UNRECOGNIZED:
    default:
      return -1;
  }
}

function createBaseFormatSchemaRequest(): FormatSchemaRequest {
  return { schema: "" };
}

export const FormatSchemaRequest = {
  encode(message: FormatSchemaRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schema !== "") {
      writer.uint32(10).string(message.schema);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): FormatSchemaRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFormatSchemaRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schema = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): FormatSchemaRequest {
    return { schema: isSet(object.schema) ? String(object.schema) : "" };
  },

  toJSON(message: FormatSchemaRequest): unknown {
    const obj: any = {};
    message.schema !== undefined && (obj.schema = message.schema);
    return obj;
  },

  fromPartial(object: DeepPartial<FormatSchemaRequest>): FormatSchemaRequest {
    const message = createBaseFormatSchemaRequest();
    message.schema = object.schema ?? "";
    return message;
  },
};

function createBaseFormatSchemaResponse(): FormatSchemaResponse {
  return { error: undefined, formattedSchema: "" };
}

export const FormatSchemaResponse = {
  encode(message: FormatSchemaResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.error !== undefined) {
      DeveloperError.encode(message.error, writer.uint32(10).fork()).ldelim();
    }
    if (message.formattedSchema !== "") {
      writer.uint32(18).string(message.formattedSchema);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): FormatSchemaResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFormatSchemaResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.error = DeveloperError.decode(reader, reader.uint32());
          break;
        case 2:
          message.formattedSchema = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): FormatSchemaResponse {
    return {
      error: isSet(object.error) ? DeveloperError.fromJSON(object.error) : undefined,
      formattedSchema: isSet(object.formattedSchema) ? String(object.formattedSchema) : "",
    };
  },

  toJSON(message: FormatSchemaResponse): unknown {
    const obj: any = {};
    message.error !== undefined && (obj.error = message.error ? DeveloperError.toJSON(message.error) : undefined);
    message.formattedSchema !== undefined && (obj.formattedSchema = message.formattedSchema);
    return obj;
  },

  fromPartial(object: DeepPartial<FormatSchemaResponse>): FormatSchemaResponse {
    const message = createBaseFormatSchemaResponse();
    message.error = (object.error !== undefined && object.error !== null)
      ? DeveloperError.fromPartial(object.error)
      : undefined;
    message.formattedSchema = object.formattedSchema ?? "";
    return message;
  },
};

function createBaseUpgradeSchemaRequest(): UpgradeSchemaRequest {
  return { namespaceConfigs: [] };
}

export const UpgradeSchemaRequest = {
  encode(message: UpgradeSchemaRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.namespaceConfigs) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpgradeSchemaRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpgradeSchemaRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.namespaceConfigs.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpgradeSchemaRequest {
    return {
      namespaceConfigs: Array.isArray(object?.namespaceConfigs)
        ? object.namespaceConfigs.map((e: any) => String(e))
        : [],
    };
  },

  toJSON(message: UpgradeSchemaRequest): unknown {
    const obj: any = {};
    if (message.namespaceConfigs) {
      obj.namespaceConfigs = message.namespaceConfigs.map((e) => e);
    } else {
      obj.namespaceConfigs = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<UpgradeSchemaRequest>): UpgradeSchemaRequest {
    const message = createBaseUpgradeSchemaRequest();
    message.namespaceConfigs = object.namespaceConfigs?.map((e) => e) || [];
    return message;
  },
};

function createBaseUpgradeSchemaResponse(): UpgradeSchemaResponse {
  return { error: undefined, upgradedSchema: "" };
}

export const UpgradeSchemaResponse = {
  encode(message: UpgradeSchemaResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.error !== undefined) {
      DeveloperError.encode(message.error, writer.uint32(10).fork()).ldelim();
    }
    if (message.upgradedSchema !== "") {
      writer.uint32(18).string(message.upgradedSchema);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpgradeSchemaResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpgradeSchemaResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.error = DeveloperError.decode(reader, reader.uint32());
          break;
        case 2:
          message.upgradedSchema = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpgradeSchemaResponse {
    return {
      error: isSet(object.error) ? DeveloperError.fromJSON(object.error) : undefined,
      upgradedSchema: isSet(object.upgradedSchema) ? String(object.upgradedSchema) : "",
    };
  },

  toJSON(message: UpgradeSchemaResponse): unknown {
    const obj: any = {};
    message.error !== undefined && (obj.error = message.error ? DeveloperError.toJSON(message.error) : undefined);
    message.upgradedSchema !== undefined && (obj.upgradedSchema = message.upgradedSchema);
    return obj;
  },

  fromPartial(object: DeepPartial<UpgradeSchemaResponse>): UpgradeSchemaResponse {
    const message = createBaseUpgradeSchemaResponse();
    message.error = (object.error !== undefined && object.error !== null)
      ? DeveloperError.fromPartial(object.error)
      : undefined;
    message.upgradedSchema = object.upgradedSchema ?? "";
    return message;
  },
};

function createBaseShareRequest(): ShareRequest {
  return { schema: "", relationshipsYaml: "", validationYaml: "", assertionsYaml: "" };
}

export const ShareRequest = {
  encode(message: ShareRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schema !== "") {
      writer.uint32(10).string(message.schema);
    }
    if (message.relationshipsYaml !== "") {
      writer.uint32(18).string(message.relationshipsYaml);
    }
    if (message.validationYaml !== "") {
      writer.uint32(26).string(message.validationYaml);
    }
    if (message.assertionsYaml !== "") {
      writer.uint32(34).string(message.assertionsYaml);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ShareRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseShareRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schema = reader.string();
          break;
        case 2:
          message.relationshipsYaml = reader.string();
          break;
        case 3:
          message.validationYaml = reader.string();
          break;
        case 4:
          message.assertionsYaml = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ShareRequest {
    return {
      schema: isSet(object.schema) ? String(object.schema) : "",
      relationshipsYaml: isSet(object.relationshipsYaml) ? String(object.relationshipsYaml) : "",
      validationYaml: isSet(object.validationYaml) ? String(object.validationYaml) : "",
      assertionsYaml: isSet(object.assertionsYaml) ? String(object.assertionsYaml) : "",
    };
  },

  toJSON(message: ShareRequest): unknown {
    const obj: any = {};
    message.schema !== undefined && (obj.schema = message.schema);
    message.relationshipsYaml !== undefined && (obj.relationshipsYaml = message.relationshipsYaml);
    message.validationYaml !== undefined && (obj.validationYaml = message.validationYaml);
    message.assertionsYaml !== undefined && (obj.assertionsYaml = message.assertionsYaml);
    return obj;
  },

  fromPartial(object: DeepPartial<ShareRequest>): ShareRequest {
    const message = createBaseShareRequest();
    message.schema = object.schema ?? "";
    message.relationshipsYaml = object.relationshipsYaml ?? "";
    message.validationYaml = object.validationYaml ?? "";
    message.assertionsYaml = object.assertionsYaml ?? "";
    return message;
  },
};

function createBaseShareResponse(): ShareResponse {
  return { shareReference: "" };
}

export const ShareResponse = {
  encode(message: ShareResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.shareReference !== "") {
      writer.uint32(10).string(message.shareReference);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ShareResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseShareResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.shareReference = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ShareResponse {
    return { shareReference: isSet(object.shareReference) ? String(object.shareReference) : "" };
  },

  toJSON(message: ShareResponse): unknown {
    const obj: any = {};
    message.shareReference !== undefined && (obj.shareReference = message.shareReference);
    return obj;
  },

  fromPartial(object: DeepPartial<ShareResponse>): ShareResponse {
    const message = createBaseShareResponse();
    message.shareReference = object.shareReference ?? "";
    return message;
  },
};

function createBaseLookupShareRequest(): LookupShareRequest {
  return { shareReference: "" };
}

export const LookupShareRequest = {
  encode(message: LookupShareRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.shareReference !== "") {
      writer.uint32(10).string(message.shareReference);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LookupShareRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLookupShareRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.shareReference = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LookupShareRequest {
    return { shareReference: isSet(object.shareReference) ? String(object.shareReference) : "" };
  },

  toJSON(message: LookupShareRequest): unknown {
    const obj: any = {};
    message.shareReference !== undefined && (obj.shareReference = message.shareReference);
    return obj;
  },

  fromPartial(object: DeepPartial<LookupShareRequest>): LookupShareRequest {
    const message = createBaseLookupShareRequest();
    message.shareReference = object.shareReference ?? "";
    return message;
  },
};

function createBaseLookupShareResponse(): LookupShareResponse {
  return {
    status: LookupShareResponse_LookupStatus.UNKNOWN_REFERENCE,
    schema: "",
    relationshipsYaml: "",
    validationYaml: "",
    assertionsYaml: "",
  };
}

export const LookupShareResponse = {
  encode(message: LookupShareResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.status !== LookupShareResponse_LookupStatus.UNKNOWN_REFERENCE) {
      writer.uint32(8).int32(lookupShareResponse_LookupStatusToNumber(message.status));
    }
    if (message.schema !== "") {
      writer.uint32(18).string(message.schema);
    }
    if (message.relationshipsYaml !== "") {
      writer.uint32(26).string(message.relationshipsYaml);
    }
    if (message.validationYaml !== "") {
      writer.uint32(34).string(message.validationYaml);
    }
    if (message.assertionsYaml !== "") {
      writer.uint32(42).string(message.assertionsYaml);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LookupShareResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLookupShareResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.status = lookupShareResponse_LookupStatusFromJSON(reader.int32());
          break;
        case 2:
          message.schema = reader.string();
          break;
        case 3:
          message.relationshipsYaml = reader.string();
          break;
        case 4:
          message.validationYaml = reader.string();
          break;
        case 5:
          message.assertionsYaml = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LookupShareResponse {
    return {
      status: isSet(object.status)
        ? lookupShareResponse_LookupStatusFromJSON(object.status)
        : LookupShareResponse_LookupStatus.UNKNOWN_REFERENCE,
      schema: isSet(object.schema) ? String(object.schema) : "",
      relationshipsYaml: isSet(object.relationshipsYaml) ? String(object.relationshipsYaml) : "",
      validationYaml: isSet(object.validationYaml) ? String(object.validationYaml) : "",
      assertionsYaml: isSet(object.assertionsYaml) ? String(object.assertionsYaml) : "",
    };
  },

  toJSON(message: LookupShareResponse): unknown {
    const obj: any = {};
    message.status !== undefined && (obj.status = lookupShareResponse_LookupStatusToJSON(message.status));
    message.schema !== undefined && (obj.schema = message.schema);
    message.relationshipsYaml !== undefined && (obj.relationshipsYaml = message.relationshipsYaml);
    message.validationYaml !== undefined && (obj.validationYaml = message.validationYaml);
    message.assertionsYaml !== undefined && (obj.assertionsYaml = message.assertionsYaml);
    return obj;
  },

  fromPartial(object: DeepPartial<LookupShareResponse>): LookupShareResponse {
    const message = createBaseLookupShareResponse();
    message.status = object.status ?? LookupShareResponse_LookupStatus.UNKNOWN_REFERENCE;
    message.schema = object.schema ?? "";
    message.relationshipsYaml = object.relationshipsYaml ?? "";
    message.validationYaml = object.validationYaml ?? "";
    message.assertionsYaml = object.assertionsYaml ?? "";
    return message;
  },
};

function createBaseRequestContext(): RequestContext {
  return { schema: "", relationships: [] };
}

export const RequestContext = {
  encode(message: RequestContext, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schema !== "") {
      writer.uint32(10).string(message.schema);
    }
    for (const v of message.relationships) {
      RelationTuple.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RequestContext {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRequestContext();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schema = reader.string();
          break;
        case 2:
          message.relationships.push(RelationTuple.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RequestContext {
    return {
      schema: isSet(object.schema) ? String(object.schema) : "",
      relationships: Array.isArray(object?.relationships)
        ? object.relationships.map((e: any) => RelationTuple.fromJSON(e))
        : [],
    };
  },

  toJSON(message: RequestContext): unknown {
    const obj: any = {};
    message.schema !== undefined && (obj.schema = message.schema);
    if (message.relationships) {
      obj.relationships = message.relationships.map((e) => e ? RelationTuple.toJSON(e) : undefined);
    } else {
      obj.relationships = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<RequestContext>): RequestContext {
    const message = createBaseRequestContext();
    message.schema = object.schema ?? "";
    message.relationships = object.relationships?.map((e) => RelationTuple.fromPartial(e)) || [];
    return message;
  },
};

function createBaseEditCheckRequest(): EditCheckRequest {
  return { context: undefined, checkRelationships: [] };
}

export const EditCheckRequest = {
  encode(message: EditCheckRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.context !== undefined) {
      RequestContext.encode(message.context, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.checkRelationships) {
      RelationTuple.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EditCheckRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEditCheckRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.context = RequestContext.decode(reader, reader.uint32());
          break;
        case 2:
          message.checkRelationships.push(RelationTuple.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): EditCheckRequest {
    return {
      context: isSet(object.context) ? RequestContext.fromJSON(object.context) : undefined,
      checkRelationships: Array.isArray(object?.checkRelationships)
        ? object.checkRelationships.map((e: any) => RelationTuple.fromJSON(e))
        : [],
    };
  },

  toJSON(message: EditCheckRequest): unknown {
    const obj: any = {};
    message.context !== undefined &&
      (obj.context = message.context ? RequestContext.toJSON(message.context) : undefined);
    if (message.checkRelationships) {
      obj.checkRelationships = message.checkRelationships.map((e) => e ? RelationTuple.toJSON(e) : undefined);
    } else {
      obj.checkRelationships = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<EditCheckRequest>): EditCheckRequest {
    const message = createBaseEditCheckRequest();
    message.context = (object.context !== undefined && object.context !== null)
      ? RequestContext.fromPartial(object.context)
      : undefined;
    message.checkRelationships = object.checkRelationships?.map((e) => RelationTuple.fromPartial(e)) || [];
    return message;
  },
};

function createBaseEditCheckResult(): EditCheckResult {
  return { relationship: undefined, isMember: false, error: undefined };
}

export const EditCheckResult = {
  encode(message: EditCheckResult, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.relationship !== undefined) {
      RelationTuple.encode(message.relationship, writer.uint32(10).fork()).ldelim();
    }
    if (message.isMember === true) {
      writer.uint32(16).bool(message.isMember);
    }
    if (message.error !== undefined) {
      DeveloperError.encode(message.error, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EditCheckResult {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEditCheckResult();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.relationship = RelationTuple.decode(reader, reader.uint32());
          break;
        case 2:
          message.isMember = reader.bool();
          break;
        case 3:
          message.error = DeveloperError.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): EditCheckResult {
    return {
      relationship: isSet(object.relationship) ? RelationTuple.fromJSON(object.relationship) : undefined,
      isMember: isSet(object.isMember) ? Boolean(object.isMember) : false,
      error: isSet(object.error) ? DeveloperError.fromJSON(object.error) : undefined,
    };
  },

  toJSON(message: EditCheckResult): unknown {
    const obj: any = {};
    message.relationship !== undefined &&
      (obj.relationship = message.relationship ? RelationTuple.toJSON(message.relationship) : undefined);
    message.isMember !== undefined && (obj.isMember = message.isMember);
    message.error !== undefined && (obj.error = message.error ? DeveloperError.toJSON(message.error) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<EditCheckResult>): EditCheckResult {
    const message = createBaseEditCheckResult();
    message.relationship = (object.relationship !== undefined && object.relationship !== null)
      ? RelationTuple.fromPartial(object.relationship)
      : undefined;
    message.isMember = object.isMember ?? false;
    message.error = (object.error !== undefined && object.error !== null)
      ? DeveloperError.fromPartial(object.error)
      : undefined;
    return message;
  },
};

function createBaseEditCheckResponse(): EditCheckResponse {
  return { requestErrors: [], checkResults: [] };
}

export const EditCheckResponse = {
  encode(message: EditCheckResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.requestErrors) {
      DeveloperError.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.checkResults) {
      EditCheckResult.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EditCheckResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEditCheckResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestErrors.push(DeveloperError.decode(reader, reader.uint32()));
          break;
        case 2:
          message.checkResults.push(EditCheckResult.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): EditCheckResponse {
    return {
      requestErrors: Array.isArray(object?.requestErrors)
        ? object.requestErrors.map((e: any) => DeveloperError.fromJSON(e))
        : [],
      checkResults: Array.isArray(object?.checkResults)
        ? object.checkResults.map((e: any) => EditCheckResult.fromJSON(e))
        : [],
    };
  },

  toJSON(message: EditCheckResponse): unknown {
    const obj: any = {};
    if (message.requestErrors) {
      obj.requestErrors = message.requestErrors.map((e) => e ? DeveloperError.toJSON(e) : undefined);
    } else {
      obj.requestErrors = [];
    }
    if (message.checkResults) {
      obj.checkResults = message.checkResults.map((e) => e ? EditCheckResult.toJSON(e) : undefined);
    } else {
      obj.checkResults = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<EditCheckResponse>): EditCheckResponse {
    const message = createBaseEditCheckResponse();
    message.requestErrors = object.requestErrors?.map((e) => DeveloperError.fromPartial(e)) || [];
    message.checkResults = object.checkResults?.map((e) => EditCheckResult.fromPartial(e)) || [];
    return message;
  },
};

function createBaseValidateRequest(): ValidateRequest {
  return { context: undefined, validationYaml: "", updateValidationYaml: false, assertionsYaml: "" };
}

export const ValidateRequest = {
  encode(message: ValidateRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.context !== undefined) {
      RequestContext.encode(message.context, writer.uint32(10).fork()).ldelim();
    }
    if (message.validationYaml !== "") {
      writer.uint32(26).string(message.validationYaml);
    }
    if (message.updateValidationYaml === true) {
      writer.uint32(32).bool(message.updateValidationYaml);
    }
    if (message.assertionsYaml !== "") {
      writer.uint32(42).string(message.assertionsYaml);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ValidateRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseValidateRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.context = RequestContext.decode(reader, reader.uint32());
          break;
        case 3:
          message.validationYaml = reader.string();
          break;
        case 4:
          message.updateValidationYaml = reader.bool();
          break;
        case 5:
          message.assertionsYaml = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ValidateRequest {
    return {
      context: isSet(object.context) ? RequestContext.fromJSON(object.context) : undefined,
      validationYaml: isSet(object.validationYaml) ? String(object.validationYaml) : "",
      updateValidationYaml: isSet(object.updateValidationYaml) ? Boolean(object.updateValidationYaml) : false,
      assertionsYaml: isSet(object.assertionsYaml) ? String(object.assertionsYaml) : "",
    };
  },

  toJSON(message: ValidateRequest): unknown {
    const obj: any = {};
    message.context !== undefined &&
      (obj.context = message.context ? RequestContext.toJSON(message.context) : undefined);
    message.validationYaml !== undefined && (obj.validationYaml = message.validationYaml);
    message.updateValidationYaml !== undefined && (obj.updateValidationYaml = message.updateValidationYaml);
    message.assertionsYaml !== undefined && (obj.assertionsYaml = message.assertionsYaml);
    return obj;
  },

  fromPartial(object: DeepPartial<ValidateRequest>): ValidateRequest {
    const message = createBaseValidateRequest();
    message.context = (object.context !== undefined && object.context !== null)
      ? RequestContext.fromPartial(object.context)
      : undefined;
    message.validationYaml = object.validationYaml ?? "";
    message.updateValidationYaml = object.updateValidationYaml ?? false;
    message.assertionsYaml = object.assertionsYaml ?? "";
    return message;
  },
};

function createBaseValidateResponse(): ValidateResponse {
  return { requestErrors: [], validationErrors: [], updatedValidationYaml: "" };
}

export const ValidateResponse = {
  encode(message: ValidateResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.requestErrors) {
      DeveloperError.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.validationErrors) {
      DeveloperError.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.updatedValidationYaml !== "") {
      writer.uint32(26).string(message.updatedValidationYaml);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ValidateResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseValidateResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestErrors.push(DeveloperError.decode(reader, reader.uint32()));
          break;
        case 2:
          message.validationErrors.push(DeveloperError.decode(reader, reader.uint32()));
          break;
        case 3:
          message.updatedValidationYaml = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ValidateResponse {
    return {
      requestErrors: Array.isArray(object?.requestErrors)
        ? object.requestErrors.map((e: any) => DeveloperError.fromJSON(e))
        : [],
      validationErrors: Array.isArray(object?.validationErrors)
        ? object.validationErrors.map((e: any) => DeveloperError.fromJSON(e))
        : [],
      updatedValidationYaml: isSet(object.updatedValidationYaml) ? String(object.updatedValidationYaml) : "",
    };
  },

  toJSON(message: ValidateResponse): unknown {
    const obj: any = {};
    if (message.requestErrors) {
      obj.requestErrors = message.requestErrors.map((e) => e ? DeveloperError.toJSON(e) : undefined);
    } else {
      obj.requestErrors = [];
    }
    if (message.validationErrors) {
      obj.validationErrors = message.validationErrors.map((e) => e ? DeveloperError.toJSON(e) : undefined);
    } else {
      obj.validationErrors = [];
    }
    message.updatedValidationYaml !== undefined && (obj.updatedValidationYaml = message.updatedValidationYaml);
    return obj;
  },

  fromPartial(object: DeepPartial<ValidateResponse>): ValidateResponse {
    const message = createBaseValidateResponse();
    message.requestErrors = object.requestErrors?.map((e) => DeveloperError.fromPartial(e)) || [];
    message.validationErrors = object.validationErrors?.map((e) => DeveloperError.fromPartial(e)) || [];
    message.updatedValidationYaml = object.updatedValidationYaml ?? "";
    return message;
  },
};

function createBaseDeveloperError(): DeveloperError {
  return {
    message: "",
    line: 0,
    column: 0,
    source: DeveloperError_Source.UNKNOWN_SOURCE,
    kind: DeveloperError_ErrorKind.UNKNOWN_KIND,
    path: [],
    context: "",
  };
}

export const DeveloperError = {
  encode(message: DeveloperError, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.message !== "") {
      writer.uint32(10).string(message.message);
    }
    if (message.line !== 0) {
      writer.uint32(16).uint32(message.line);
    }
    if (message.column !== 0) {
      writer.uint32(24).uint32(message.column);
    }
    if (message.source !== DeveloperError_Source.UNKNOWN_SOURCE) {
      writer.uint32(32).int32(developerError_SourceToNumber(message.source));
    }
    if (message.kind !== DeveloperError_ErrorKind.UNKNOWN_KIND) {
      writer.uint32(40).int32(developerError_ErrorKindToNumber(message.kind));
    }
    for (const v of message.path) {
      writer.uint32(50).string(v!);
    }
    if (message.context !== "") {
      writer.uint32(58).string(message.context);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeveloperError {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeveloperError();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.message = reader.string();
          break;
        case 2:
          message.line = reader.uint32();
          break;
        case 3:
          message.column = reader.uint32();
          break;
        case 4:
          message.source = developerError_SourceFromJSON(reader.int32());
          break;
        case 5:
          message.kind = developerError_ErrorKindFromJSON(reader.int32());
          break;
        case 6:
          message.path.push(reader.string());
          break;
        case 7:
          message.context = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeveloperError {
    return {
      message: isSet(object.message) ? String(object.message) : "",
      line: isSet(object.line) ? Number(object.line) : 0,
      column: isSet(object.column) ? Number(object.column) : 0,
      source: isSet(object.source)
        ? developerError_SourceFromJSON(object.source)
        : DeveloperError_Source.UNKNOWN_SOURCE,
      kind: isSet(object.kind) ? developerError_ErrorKindFromJSON(object.kind) : DeveloperError_ErrorKind.UNKNOWN_KIND,
      path: Array.isArray(object?.path) ? object.path.map((e: any) => String(e)) : [],
      context: isSet(object.context) ? String(object.context) : "",
    };
  },

  toJSON(message: DeveloperError): unknown {
    const obj: any = {};
    message.message !== undefined && (obj.message = message.message);
    message.line !== undefined && (obj.line = Math.round(message.line));
    message.column !== undefined && (obj.column = Math.round(message.column));
    message.source !== undefined && (obj.source = developerError_SourceToJSON(message.source));
    message.kind !== undefined && (obj.kind = developerError_ErrorKindToJSON(message.kind));
    if (message.path) {
      obj.path = message.path.map((e) => e);
    } else {
      obj.path = [];
    }
    message.context !== undefined && (obj.context = message.context);
    return obj;
  },

  fromPartial(object: DeepPartial<DeveloperError>): DeveloperError {
    const message = createBaseDeveloperError();
    message.message = object.message ?? "";
    message.line = object.line ?? 0;
    message.column = object.column ?? 0;
    message.source = object.source ?? DeveloperError_Source.UNKNOWN_SOURCE;
    message.kind = object.kind ?? DeveloperError_ErrorKind.UNKNOWN_KIND;
    message.path = object.path?.map((e) => e) || [];
    message.context = object.context ?? "";
    return message;
  },
};

export type DeveloperServiceDefinition = typeof DeveloperServiceDefinition;
export const DeveloperServiceDefinition = {
  name: "DeveloperService",
  fullName: "authzed.api.v0.DeveloperService",
  methods: {
    editCheck: {
      name: "EditCheck",
      requestType: EditCheckRequest,
      requestStream: false,
      responseType: EditCheckResponse,
      responseStream: false,
      options: {},
    },
    validate: {
      name: "Validate",
      requestType: ValidateRequest,
      requestStream: false,
      responseType: ValidateResponse,
      responseStream: false,
      options: {},
    },
    share: {
      name: "Share",
      requestType: ShareRequest,
      requestStream: false,
      responseType: ShareResponse,
      responseStream: false,
      options: {},
    },
    lookupShared: {
      name: "LookupShared",
      requestType: LookupShareRequest,
      requestStream: false,
      responseType: LookupShareResponse,
      responseStream: false,
      options: {},
    },
    upgradeSchema: {
      name: "UpgradeSchema",
      requestType: UpgradeSchemaRequest,
      requestStream: false,
      responseType: UpgradeSchemaResponse,
      responseStream: false,
      options: {},
    },
    formatSchema: {
      name: "FormatSchema",
      requestType: FormatSchemaRequest,
      requestStream: false,
      responseType: FormatSchemaResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface DeveloperServiceServiceImplementation<CallContextExt = {}> {
  editCheck(request: EditCheckRequest, context: CallContext & CallContextExt): Promise<DeepPartial<EditCheckResponse>>;
  validate(request: ValidateRequest, context: CallContext & CallContextExt): Promise<DeepPartial<ValidateResponse>>;
  share(request: ShareRequest, context: CallContext & CallContextExt): Promise<DeepPartial<ShareResponse>>;
  lookupShared(
    request: LookupShareRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<LookupShareResponse>>;
  upgradeSchema(
    request: UpgradeSchemaRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<UpgradeSchemaResponse>>;
  formatSchema(
    request: FormatSchemaRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<FormatSchemaResponse>>;
}

export interface DeveloperServiceClient<CallOptionsExt = {}> {
  editCheck(request: DeepPartial<EditCheckRequest>, options?: CallOptions & CallOptionsExt): Promise<EditCheckResponse>;
  validate(request: DeepPartial<ValidateRequest>, options?: CallOptions & CallOptionsExt): Promise<ValidateResponse>;
  share(request: DeepPartial<ShareRequest>, options?: CallOptions & CallOptionsExt): Promise<ShareResponse>;
  lookupShared(
    request: DeepPartial<LookupShareRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<LookupShareResponse>;
  upgradeSchema(
    request: DeepPartial<UpgradeSchemaRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<UpgradeSchemaResponse>;
  formatSchema(
    request: DeepPartial<FormatSchemaRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<FormatSchemaResponse>;
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
