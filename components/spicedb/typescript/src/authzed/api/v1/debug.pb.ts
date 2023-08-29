/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as _m0 from "protobufjs/minimal";
import { Duration } from "../../../google/protobuf/duration.pb";
import { Struct } from "../../../google/protobuf/struct.pb";
import { ObjectReference, PartialCaveatInfo, SubjectReference } from "./core.pb";

export const protobufPackage = "authzed.api.v1";

/**
 * DebugInformation defines debug information returned by an API call in a footer when
 * requested with a specific debugging header.
 *
 * The specific debug information returned will depend on the type of the API call made.
 *
 * See the github.com/authzed/authzed-go project for the specific header and footer names.
 */
export interface DebugInformation {
  /** check holds debug information about a check request. */
  check:
    | CheckDebugTrace
    | undefined;
  /** schema_used holds the schema used for the request. */
  schemaUsed: string;
}

/**
 * CheckDebugTrace is a recursive trace of the requests made for resolving a CheckPermission
 * API call.
 */
export interface CheckDebugTrace {
  /** resource holds the resource on which the Check was performed. */
  resource:
    | ObjectReference
    | undefined;
  /** permission holds the name of the permission or relation on which the Check was performed. */
  permission: string;
  /** permission_type holds information indicating whether it was a permission or relation. */
  permissionType: CheckDebugTrace_PermissionType;
  /**
   * subject holds the subject on which the Check was performed. This will be static across all calls within
   * the same Check tree.
   */
  subject:
    | SubjectReference
    | undefined;
  /** result holds the result of the Check call. */
  result: CheckDebugTrace_Permissionship;
  /** caveat_evaluation_info holds information about the caveat evaluated for this step of the trace. */
  caveatEvaluationInfo:
    | CaveatEvalInfo
    | undefined;
  /** duration holds the time spent executing this Check operation. */
  duration:
    | Duration
    | undefined;
  /** was_cached_result, if true, indicates that the result was found in the cache and returned directly. */
  wasCachedResult:
    | boolean
    | undefined;
  /**
   * sub_problems holds the sub problems that were executed to resolve the answer to this Check. An empty list
   * and a permissionship of PERMISSIONSHIP_HAS_PERMISSION indicates the subject was found within this relation.
   */
  subProblems: CheckDebugTrace_SubProblems | undefined;
}

export enum CheckDebugTrace_PermissionType {
  PERMISSION_TYPE_UNSPECIFIED = "PERMISSION_TYPE_UNSPECIFIED",
  PERMISSION_TYPE_RELATION = "PERMISSION_TYPE_RELATION",
  PERMISSION_TYPE_PERMISSION = "PERMISSION_TYPE_PERMISSION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function checkDebugTrace_PermissionTypeFromJSON(object: any): CheckDebugTrace_PermissionType {
  switch (object) {
    case 0:
    case "PERMISSION_TYPE_UNSPECIFIED":
      return CheckDebugTrace_PermissionType.PERMISSION_TYPE_UNSPECIFIED;
    case 1:
    case "PERMISSION_TYPE_RELATION":
      return CheckDebugTrace_PermissionType.PERMISSION_TYPE_RELATION;
    case 2:
    case "PERMISSION_TYPE_PERMISSION":
      return CheckDebugTrace_PermissionType.PERMISSION_TYPE_PERMISSION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return CheckDebugTrace_PermissionType.UNRECOGNIZED;
  }
}

export function checkDebugTrace_PermissionTypeToJSON(object: CheckDebugTrace_PermissionType): string {
  switch (object) {
    case CheckDebugTrace_PermissionType.PERMISSION_TYPE_UNSPECIFIED:
      return "PERMISSION_TYPE_UNSPECIFIED";
    case CheckDebugTrace_PermissionType.PERMISSION_TYPE_RELATION:
      return "PERMISSION_TYPE_RELATION";
    case CheckDebugTrace_PermissionType.PERMISSION_TYPE_PERMISSION:
      return "PERMISSION_TYPE_PERMISSION";
    case CheckDebugTrace_PermissionType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function checkDebugTrace_PermissionTypeToNumber(object: CheckDebugTrace_PermissionType): number {
  switch (object) {
    case CheckDebugTrace_PermissionType.PERMISSION_TYPE_UNSPECIFIED:
      return 0;
    case CheckDebugTrace_PermissionType.PERMISSION_TYPE_RELATION:
      return 1;
    case CheckDebugTrace_PermissionType.PERMISSION_TYPE_PERMISSION:
      return 2;
    case CheckDebugTrace_PermissionType.UNRECOGNIZED:
    default:
      return -1;
  }
}

export enum CheckDebugTrace_Permissionship {
  PERMISSIONSHIP_UNSPECIFIED = "PERMISSIONSHIP_UNSPECIFIED",
  PERMISSIONSHIP_NO_PERMISSION = "PERMISSIONSHIP_NO_PERMISSION",
  PERMISSIONSHIP_HAS_PERMISSION = "PERMISSIONSHIP_HAS_PERMISSION",
  PERMISSIONSHIP_CONDITIONAL_PERMISSION = "PERMISSIONSHIP_CONDITIONAL_PERMISSION",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function checkDebugTrace_PermissionshipFromJSON(object: any): CheckDebugTrace_Permissionship {
  switch (object) {
    case 0:
    case "PERMISSIONSHIP_UNSPECIFIED":
      return CheckDebugTrace_Permissionship.PERMISSIONSHIP_UNSPECIFIED;
    case 1:
    case "PERMISSIONSHIP_NO_PERMISSION":
      return CheckDebugTrace_Permissionship.PERMISSIONSHIP_NO_PERMISSION;
    case 2:
    case "PERMISSIONSHIP_HAS_PERMISSION":
      return CheckDebugTrace_Permissionship.PERMISSIONSHIP_HAS_PERMISSION;
    case 3:
    case "PERMISSIONSHIP_CONDITIONAL_PERMISSION":
      return CheckDebugTrace_Permissionship.PERMISSIONSHIP_CONDITIONAL_PERMISSION;
    case -1:
    case "UNRECOGNIZED":
    default:
      return CheckDebugTrace_Permissionship.UNRECOGNIZED;
  }
}

export function checkDebugTrace_PermissionshipToJSON(object: CheckDebugTrace_Permissionship): string {
  switch (object) {
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_UNSPECIFIED:
      return "PERMISSIONSHIP_UNSPECIFIED";
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_NO_PERMISSION:
      return "PERMISSIONSHIP_NO_PERMISSION";
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_HAS_PERMISSION:
      return "PERMISSIONSHIP_HAS_PERMISSION";
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_CONDITIONAL_PERMISSION:
      return "PERMISSIONSHIP_CONDITIONAL_PERMISSION";
    case CheckDebugTrace_Permissionship.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function checkDebugTrace_PermissionshipToNumber(object: CheckDebugTrace_Permissionship): number {
  switch (object) {
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_UNSPECIFIED:
      return 0;
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_NO_PERMISSION:
      return 1;
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_HAS_PERMISSION:
      return 2;
    case CheckDebugTrace_Permissionship.PERMISSIONSHIP_CONDITIONAL_PERMISSION:
      return 3;
    case CheckDebugTrace_Permissionship.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface CheckDebugTrace_SubProblems {
  traces: CheckDebugTrace[];
}

/** CaveatEvalInfo holds information about a caveat expression that was evaluated. */
export interface CaveatEvalInfo {
  /** expression is the expression that was evaluated. */
  expression: string;
  /** result is the result of the evaluation. */
  result: CaveatEvalInfo_Result;
  /** context consists of any named values that were used for evaluating the caveat expression. */
  context:
    | { [key: string]: any }
    | undefined;
  /** partial_caveat_info holds information of a partially-evaluated caveated response, if applicable. */
  partialCaveatInfo:
    | PartialCaveatInfo
    | undefined;
  /** caveat_name is the name of the caveat that was executed, if applicable. */
  caveatName: string;
}

export enum CaveatEvalInfo_Result {
  RESULT_UNSPECIFIED = "RESULT_UNSPECIFIED",
  RESULT_UNEVALUATED = "RESULT_UNEVALUATED",
  RESULT_FALSE = "RESULT_FALSE",
  RESULT_TRUE = "RESULT_TRUE",
  RESULT_MISSING_SOME_CONTEXT = "RESULT_MISSING_SOME_CONTEXT",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function caveatEvalInfo_ResultFromJSON(object: any): CaveatEvalInfo_Result {
  switch (object) {
    case 0:
    case "RESULT_UNSPECIFIED":
      return CaveatEvalInfo_Result.RESULT_UNSPECIFIED;
    case 1:
    case "RESULT_UNEVALUATED":
      return CaveatEvalInfo_Result.RESULT_UNEVALUATED;
    case 2:
    case "RESULT_FALSE":
      return CaveatEvalInfo_Result.RESULT_FALSE;
    case 3:
    case "RESULT_TRUE":
      return CaveatEvalInfo_Result.RESULT_TRUE;
    case 4:
    case "RESULT_MISSING_SOME_CONTEXT":
      return CaveatEvalInfo_Result.RESULT_MISSING_SOME_CONTEXT;
    case -1:
    case "UNRECOGNIZED":
    default:
      return CaveatEvalInfo_Result.UNRECOGNIZED;
  }
}

export function caveatEvalInfo_ResultToJSON(object: CaveatEvalInfo_Result): string {
  switch (object) {
    case CaveatEvalInfo_Result.RESULT_UNSPECIFIED:
      return "RESULT_UNSPECIFIED";
    case CaveatEvalInfo_Result.RESULT_UNEVALUATED:
      return "RESULT_UNEVALUATED";
    case CaveatEvalInfo_Result.RESULT_FALSE:
      return "RESULT_FALSE";
    case CaveatEvalInfo_Result.RESULT_TRUE:
      return "RESULT_TRUE";
    case CaveatEvalInfo_Result.RESULT_MISSING_SOME_CONTEXT:
      return "RESULT_MISSING_SOME_CONTEXT";
    case CaveatEvalInfo_Result.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function caveatEvalInfo_ResultToNumber(object: CaveatEvalInfo_Result): number {
  switch (object) {
    case CaveatEvalInfo_Result.RESULT_UNSPECIFIED:
      return 0;
    case CaveatEvalInfo_Result.RESULT_UNEVALUATED:
      return 1;
    case CaveatEvalInfo_Result.RESULT_FALSE:
      return 2;
    case CaveatEvalInfo_Result.RESULT_TRUE:
      return 3;
    case CaveatEvalInfo_Result.RESULT_MISSING_SOME_CONTEXT:
      return 4;
    case CaveatEvalInfo_Result.UNRECOGNIZED:
    default:
      return -1;
  }
}

function createBaseDebugInformation(): DebugInformation {
  return { check: undefined, schemaUsed: "" };
}

export const DebugInformation = {
  encode(message: DebugInformation, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.check !== undefined) {
      CheckDebugTrace.encode(message.check, writer.uint32(10).fork()).ldelim();
    }
    if (message.schemaUsed !== "") {
      writer.uint32(18).string(message.schemaUsed);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DebugInformation {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDebugInformation();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.check = CheckDebugTrace.decode(reader, reader.uint32());
          break;
        case 2:
          message.schemaUsed = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DebugInformation {
    return {
      check: isSet(object.check) ? CheckDebugTrace.fromJSON(object.check) : undefined,
      schemaUsed: isSet(object.schemaUsed) ? String(object.schemaUsed) : "",
    };
  },

  toJSON(message: DebugInformation): unknown {
    const obj: any = {};
    message.check !== undefined && (obj.check = message.check ? CheckDebugTrace.toJSON(message.check) : undefined);
    message.schemaUsed !== undefined && (obj.schemaUsed = message.schemaUsed);
    return obj;
  },

  fromPartial(object: DeepPartial<DebugInformation>): DebugInformation {
    const message = createBaseDebugInformation();
    message.check = (object.check !== undefined && object.check !== null)
      ? CheckDebugTrace.fromPartial(object.check)
      : undefined;
    message.schemaUsed = object.schemaUsed ?? "";
    return message;
  },
};

function createBaseCheckDebugTrace(): CheckDebugTrace {
  return {
    resource: undefined,
    permission: "",
    permissionType: CheckDebugTrace_PermissionType.PERMISSION_TYPE_UNSPECIFIED,
    subject: undefined,
    result: CheckDebugTrace_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
    caveatEvaluationInfo: undefined,
    duration: undefined,
    wasCachedResult: undefined,
    subProblems: undefined,
  };
}

export const CheckDebugTrace = {
  encode(message: CheckDebugTrace, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.resource !== undefined) {
      ObjectReference.encode(message.resource, writer.uint32(10).fork()).ldelim();
    }
    if (message.permission !== "") {
      writer.uint32(18).string(message.permission);
    }
    if (message.permissionType !== CheckDebugTrace_PermissionType.PERMISSION_TYPE_UNSPECIFIED) {
      writer.uint32(24).int32(checkDebugTrace_PermissionTypeToNumber(message.permissionType));
    }
    if (message.subject !== undefined) {
      SubjectReference.encode(message.subject, writer.uint32(34).fork()).ldelim();
    }
    if (message.result !== CheckDebugTrace_Permissionship.PERMISSIONSHIP_UNSPECIFIED) {
      writer.uint32(40).int32(checkDebugTrace_PermissionshipToNumber(message.result));
    }
    if (message.caveatEvaluationInfo !== undefined) {
      CaveatEvalInfo.encode(message.caveatEvaluationInfo, writer.uint32(66).fork()).ldelim();
    }
    if (message.duration !== undefined) {
      Duration.encode(message.duration, writer.uint32(74).fork()).ldelim();
    }
    if (message.wasCachedResult !== undefined) {
      writer.uint32(48).bool(message.wasCachedResult);
    }
    if (message.subProblems !== undefined) {
      CheckDebugTrace_SubProblems.encode(message.subProblems, writer.uint32(58).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CheckDebugTrace {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCheckDebugTrace();
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
          message.permissionType = checkDebugTrace_PermissionTypeFromJSON(reader.int32());
          break;
        case 4:
          message.subject = SubjectReference.decode(reader, reader.uint32());
          break;
        case 5:
          message.result = checkDebugTrace_PermissionshipFromJSON(reader.int32());
          break;
        case 8:
          message.caveatEvaluationInfo = CaveatEvalInfo.decode(reader, reader.uint32());
          break;
        case 9:
          message.duration = Duration.decode(reader, reader.uint32());
          break;
        case 6:
          message.wasCachedResult = reader.bool();
          break;
        case 7:
          message.subProblems = CheckDebugTrace_SubProblems.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CheckDebugTrace {
    return {
      resource: isSet(object.resource) ? ObjectReference.fromJSON(object.resource) : undefined,
      permission: isSet(object.permission) ? String(object.permission) : "",
      permissionType: isSet(object.permissionType)
        ? checkDebugTrace_PermissionTypeFromJSON(object.permissionType)
        : CheckDebugTrace_PermissionType.PERMISSION_TYPE_UNSPECIFIED,
      subject: isSet(object.subject) ? SubjectReference.fromJSON(object.subject) : undefined,
      result: isSet(object.result)
        ? checkDebugTrace_PermissionshipFromJSON(object.result)
        : CheckDebugTrace_Permissionship.PERMISSIONSHIP_UNSPECIFIED,
      caveatEvaluationInfo: isSet(object.caveatEvaluationInfo)
        ? CaveatEvalInfo.fromJSON(object.caveatEvaluationInfo)
        : undefined,
      duration: isSet(object.duration) ? Duration.fromJSON(object.duration) : undefined,
      wasCachedResult: isSet(object.wasCachedResult) ? Boolean(object.wasCachedResult) : undefined,
      subProblems: isSet(object.subProblems) ? CheckDebugTrace_SubProblems.fromJSON(object.subProblems) : undefined,
    };
  },

  toJSON(message: CheckDebugTrace): unknown {
    const obj: any = {};
    message.resource !== undefined &&
      (obj.resource = message.resource ? ObjectReference.toJSON(message.resource) : undefined);
    message.permission !== undefined && (obj.permission = message.permission);
    message.permissionType !== undefined &&
      (obj.permissionType = checkDebugTrace_PermissionTypeToJSON(message.permissionType));
    message.subject !== undefined &&
      (obj.subject = message.subject ? SubjectReference.toJSON(message.subject) : undefined);
    message.result !== undefined && (obj.result = checkDebugTrace_PermissionshipToJSON(message.result));
    message.caveatEvaluationInfo !== undefined && (obj.caveatEvaluationInfo = message.caveatEvaluationInfo
      ? CaveatEvalInfo.toJSON(message.caveatEvaluationInfo)
      : undefined);
    message.duration !== undefined && (obj.duration = message.duration ? Duration.toJSON(message.duration) : undefined);
    message.wasCachedResult !== undefined && (obj.wasCachedResult = message.wasCachedResult);
    message.subProblems !== undefined &&
      (obj.subProblems = message.subProblems ? CheckDebugTrace_SubProblems.toJSON(message.subProblems) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<CheckDebugTrace>): CheckDebugTrace {
    const message = createBaseCheckDebugTrace();
    message.resource = (object.resource !== undefined && object.resource !== null)
      ? ObjectReference.fromPartial(object.resource)
      : undefined;
    message.permission = object.permission ?? "";
    message.permissionType = object.permissionType ?? CheckDebugTrace_PermissionType.PERMISSION_TYPE_UNSPECIFIED;
    message.subject = (object.subject !== undefined && object.subject !== null)
      ? SubjectReference.fromPartial(object.subject)
      : undefined;
    message.result = object.result ?? CheckDebugTrace_Permissionship.PERMISSIONSHIP_UNSPECIFIED;
    message.caveatEvaluationInfo = (object.caveatEvaluationInfo !== undefined && object.caveatEvaluationInfo !== null)
      ? CaveatEvalInfo.fromPartial(object.caveatEvaluationInfo)
      : undefined;
    message.duration = (object.duration !== undefined && object.duration !== null)
      ? Duration.fromPartial(object.duration)
      : undefined;
    message.wasCachedResult = object.wasCachedResult ?? undefined;
    message.subProblems = (object.subProblems !== undefined && object.subProblems !== null)
      ? CheckDebugTrace_SubProblems.fromPartial(object.subProblems)
      : undefined;
    return message;
  },
};

function createBaseCheckDebugTrace_SubProblems(): CheckDebugTrace_SubProblems {
  return { traces: [] };
}

export const CheckDebugTrace_SubProblems = {
  encode(message: CheckDebugTrace_SubProblems, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.traces) {
      CheckDebugTrace.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CheckDebugTrace_SubProblems {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCheckDebugTrace_SubProblems();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.traces.push(CheckDebugTrace.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CheckDebugTrace_SubProblems {
    return { traces: Array.isArray(object?.traces) ? object.traces.map((e: any) => CheckDebugTrace.fromJSON(e)) : [] };
  },

  toJSON(message: CheckDebugTrace_SubProblems): unknown {
    const obj: any = {};
    if (message.traces) {
      obj.traces = message.traces.map((e) => e ? CheckDebugTrace.toJSON(e) : undefined);
    } else {
      obj.traces = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<CheckDebugTrace_SubProblems>): CheckDebugTrace_SubProblems {
    const message = createBaseCheckDebugTrace_SubProblems();
    message.traces = object.traces?.map((e) => CheckDebugTrace.fromPartial(e)) || [];
    return message;
  },
};

function createBaseCaveatEvalInfo(): CaveatEvalInfo {
  return {
    expression: "",
    result: CaveatEvalInfo_Result.RESULT_UNSPECIFIED,
    context: undefined,
    partialCaveatInfo: undefined,
    caveatName: "",
  };
}

export const CaveatEvalInfo = {
  encode(message: CaveatEvalInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.expression !== "") {
      writer.uint32(10).string(message.expression);
    }
    if (message.result !== CaveatEvalInfo_Result.RESULT_UNSPECIFIED) {
      writer.uint32(16).int32(caveatEvalInfo_ResultToNumber(message.result));
    }
    if (message.context !== undefined) {
      Struct.encode(Struct.wrap(message.context), writer.uint32(26).fork()).ldelim();
    }
    if (message.partialCaveatInfo !== undefined) {
      PartialCaveatInfo.encode(message.partialCaveatInfo, writer.uint32(34).fork()).ldelim();
    }
    if (message.caveatName !== "") {
      writer.uint32(42).string(message.caveatName);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CaveatEvalInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCaveatEvalInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.expression = reader.string();
          break;
        case 2:
          message.result = caveatEvalInfo_ResultFromJSON(reader.int32());
          break;
        case 3:
          message.context = Struct.unwrap(Struct.decode(reader, reader.uint32()));
          break;
        case 4:
          message.partialCaveatInfo = PartialCaveatInfo.decode(reader, reader.uint32());
          break;
        case 5:
          message.caveatName = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CaveatEvalInfo {
    return {
      expression: isSet(object.expression) ? String(object.expression) : "",
      result: isSet(object.result)
        ? caveatEvalInfo_ResultFromJSON(object.result)
        : CaveatEvalInfo_Result.RESULT_UNSPECIFIED,
      context: isObject(object.context) ? object.context : undefined,
      partialCaveatInfo: isSet(object.partialCaveatInfo)
        ? PartialCaveatInfo.fromJSON(object.partialCaveatInfo)
        : undefined,
      caveatName: isSet(object.caveatName) ? String(object.caveatName) : "",
    };
  },

  toJSON(message: CaveatEvalInfo): unknown {
    const obj: any = {};
    message.expression !== undefined && (obj.expression = message.expression);
    message.result !== undefined && (obj.result = caveatEvalInfo_ResultToJSON(message.result));
    message.context !== undefined && (obj.context = message.context);
    message.partialCaveatInfo !== undefined && (obj.partialCaveatInfo = message.partialCaveatInfo
      ? PartialCaveatInfo.toJSON(message.partialCaveatInfo)
      : undefined);
    message.caveatName !== undefined && (obj.caveatName = message.caveatName);
    return obj;
  },

  fromPartial(object: DeepPartial<CaveatEvalInfo>): CaveatEvalInfo {
    const message = createBaseCaveatEvalInfo();
    message.expression = object.expression ?? "";
    message.result = object.result ?? CaveatEvalInfo_Result.RESULT_UNSPECIFIED;
    message.context = object.context ?? undefined;
    message.partialCaveatInfo = (object.partialCaveatInfo !== undefined && object.partialCaveatInfo !== null)
      ? PartialCaveatInfo.fromPartial(object.partialCaveatInfo)
      : undefined;
    message.caveatName = object.caveatName ?? "";
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
