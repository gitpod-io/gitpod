/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { grpc } from "@improbable-eng/grpc-web";
import { BrowserHeaders } from "browser-headers";
import * as Long from "long";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "../../google/protobuf/timestamp";

export const protobufPackage = "usage.v1";

export enum BillingStrategy {
  BILLING_STRATEGY_STRIPE = 0,
  BILLING_STRATEGY_OTHER = 1,
  UNRECOGNIZED = -1,
}

export function billingStrategyFromJSON(object: any): BillingStrategy {
  switch (object) {
    case 0:
    case "BILLING_STRATEGY_STRIPE":
      return BillingStrategy.BILLING_STRATEGY_STRIPE;
    case 1:
    case "BILLING_STRATEGY_OTHER":
      return BillingStrategy.BILLING_STRATEGY_OTHER;
    case -1:
    case "UNRECOGNIZED":
    default:
      return BillingStrategy.UNRECOGNIZED;
  }
}

export function billingStrategyToJSON(object: BillingStrategy): string {
  switch (object) {
    case BillingStrategy.BILLING_STRATEGY_STRIPE:
      return "BILLING_STRATEGY_STRIPE";
    case BillingStrategy.BILLING_STRATEGY_OTHER:
      return "BILLING_STRATEGY_OTHER";
    case BillingStrategy.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface UpdateBillingStrategyRequest {
  attributionId: string;
  spendingLimit: number;
  billingStrategy: BillingStrategy;
}

export interface UpdateBillingStrategyResponse {
}

export interface ReconcileUsageWithLedgerRequest {
  /** from specifies the starting time range for this request. */
  from:
    | Date
    | undefined;
  /** to specifies the end time range for this request. */
  to: Date | undefined;
}

export interface ReconcileUsageWithLedgerResponse {
}

export interface PaginatedRequest {
  perPage: number;
  page: number;
}

export interface PaginatedResponse {
  perPage: number;
  totalPages: number;
  total: number;
  page: number;
}

export interface ListUsageRequest {
  attributionId: string;
  /**
   * from specifies the starting time range for this request.
   * All instances which existed starting at from will be returned.
   */
  from:
    | Date
    | undefined;
  /**
   * to specifies the end time range for this request.
   * All instances which existed ending at to will be returned.
   */
  to: Date | undefined;
  order: ListUsageRequest_Ordering;
  pagination: PaginatedRequest | undefined;
}

export enum ListUsageRequest_Ordering {
  ORDERING_DESCENDING = 0,
  ORDERING_ASCENDING = 1,
  UNRECOGNIZED = -1,
}

export function listUsageRequest_OrderingFromJSON(object: any): ListUsageRequest_Ordering {
  switch (object) {
    case 0:
    case "ORDERING_DESCENDING":
      return ListUsageRequest_Ordering.ORDERING_DESCENDING;
    case 1:
    case "ORDERING_ASCENDING":
      return ListUsageRequest_Ordering.ORDERING_ASCENDING;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ListUsageRequest_Ordering.UNRECOGNIZED;
  }
}

export function listUsageRequest_OrderingToJSON(object: ListUsageRequest_Ordering): string {
  switch (object) {
    case ListUsageRequest_Ordering.ORDERING_DESCENDING:
      return "ORDERING_DESCENDING";
    case ListUsageRequest_Ordering.ORDERING_ASCENDING:
      return "ORDERING_ASCENDING";
    case ListUsageRequest_Ordering.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface ListUsageResponse {
  usageEntries: Usage[];
  pagination:
    | PaginatedResponse
    | undefined;
  /** the amount of credits the given account (attributionId) had at the beginning of the requested period */
  creditBalanceAtStart: number;
  /** the amount of credits the given account (attributionId) had at the end of the requested period */
  creditBalanceAtEnd: number;
}

export interface Usage {
  id: string;
  attributionId: string;
  description: string;
  credits: number;
  effectiveTime: Date | undefined;
  kind: Usage_Kind;
  workspaceInstanceId: string;
  draft: boolean;
  metadata: string;
}

export enum Usage_Kind {
  KIND_WORKSPACE_INSTANCE = 0,
  KIND_INVOICE = 1,
  UNRECOGNIZED = -1,
}

export function usage_KindFromJSON(object: any): Usage_Kind {
  switch (object) {
    case 0:
    case "KIND_WORKSPACE_INSTANCE":
      return Usage_Kind.KIND_WORKSPACE_INSTANCE;
    case 1:
    case "KIND_INVOICE":
      return Usage_Kind.KIND_INVOICE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return Usage_Kind.UNRECOGNIZED;
  }
}

export function usage_KindToJSON(object: Usage_Kind): string {
  switch (object) {
    case Usage_Kind.KIND_WORKSPACE_INSTANCE:
      return "KIND_WORKSPACE_INSTANCE";
    case Usage_Kind.KIND_INVOICE:
      return "KIND_INVOICE";
    case Usage_Kind.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface SetCostCenterRequest {
  costCenter: CostCenter | undefined;
}

export interface SetCostCenterResponse {
}

export interface GetCostCenterRequest {
  attributionId: string;
}

export interface GetCostCenterResponse {
  costCenter: CostCenter | undefined;
}

export interface CostCenter {
  attributionId: string;
  spendingLimit: number;
  billingStrategy: BillingStrategy;
}

function createBaseUpdateBillingStrategyRequest(): UpdateBillingStrategyRequest {
  return { attributionId: "", spendingLimit: 0, billingStrategy: 0 };
}

export const UpdateBillingStrategyRequest = {
  encode(message: UpdateBillingStrategyRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.spendingLimit !== 0) {
      writer.uint32(16).int32(message.spendingLimit);
    }
    if (message.billingStrategy !== 0) {
      writer.uint32(24).int32(message.billingStrategy);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateBillingStrategyRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateBillingStrategyRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        case 2:
          message.spendingLimit = reader.int32();
          break;
        case 3:
          message.billingStrategy = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateBillingStrategyRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      spendingLimit: isSet(object.spendingLimit) ? Number(object.spendingLimit) : 0,
      billingStrategy: isSet(object.billingStrategy) ? billingStrategyFromJSON(object.billingStrategy) : 0,
    };
  },

  toJSON(message: UpdateBillingStrategyRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.spendingLimit !== undefined && (obj.spendingLimit = Math.round(message.spendingLimit));
    message.billingStrategy !== undefined && (obj.billingStrategy = billingStrategyToJSON(message.billingStrategy));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<UpdateBillingStrategyRequest>, I>>(object: I): UpdateBillingStrategyRequest {
    const message = createBaseUpdateBillingStrategyRequest();
    message.attributionId = object.attributionId ?? "";
    message.spendingLimit = object.spendingLimit ?? 0;
    message.billingStrategy = object.billingStrategy ?? 0;
    return message;
  },
};

function createBaseUpdateBillingStrategyResponse(): UpdateBillingStrategyResponse {
  return {};
}

export const UpdateBillingStrategyResponse = {
  encode(_: UpdateBillingStrategyResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateBillingStrategyResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateBillingStrategyResponse();
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

  fromJSON(_: any): UpdateBillingStrategyResponse {
    return {};
  },

  toJSON(_: UpdateBillingStrategyResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<UpdateBillingStrategyResponse>, I>>(_: I): UpdateBillingStrategyResponse {
    const message = createBaseUpdateBillingStrategyResponse();
    return message;
  },
};

function createBaseReconcileUsageWithLedgerRequest(): ReconcileUsageWithLedgerRequest {
  return { from: undefined, to: undefined };
}

export const ReconcileUsageWithLedgerRequest = {
  encode(message: ReconcileUsageWithLedgerRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.from !== undefined) {
      Timestamp.encode(toTimestamp(message.from), writer.uint32(10).fork()).ldelim();
    }
    if (message.to !== undefined) {
      Timestamp.encode(toTimestamp(message.to), writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReconcileUsageWithLedgerRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileUsageWithLedgerRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.from = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 2:
          message.to = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ReconcileUsageWithLedgerRequest {
    return {
      from: isSet(object.from) ? fromJsonTimestamp(object.from) : undefined,
      to: isSet(object.to) ? fromJsonTimestamp(object.to) : undefined,
    };
  },

  toJSON(message: ReconcileUsageWithLedgerRequest): unknown {
    const obj: any = {};
    message.from !== undefined && (obj.from = message.from.toISOString());
    message.to !== undefined && (obj.to = message.to.toISOString());
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ReconcileUsageWithLedgerRequest>, I>>(
    object: I,
  ): ReconcileUsageWithLedgerRequest {
    const message = createBaseReconcileUsageWithLedgerRequest();
    message.from = object.from ?? undefined;
    message.to = object.to ?? undefined;
    return message;
  },
};

function createBaseReconcileUsageWithLedgerResponse(): ReconcileUsageWithLedgerResponse {
  return {};
}

export const ReconcileUsageWithLedgerResponse = {
  encode(_: ReconcileUsageWithLedgerResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReconcileUsageWithLedgerResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileUsageWithLedgerResponse();
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

  fromJSON(_: any): ReconcileUsageWithLedgerResponse {
    return {};
  },

  toJSON(_: ReconcileUsageWithLedgerResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ReconcileUsageWithLedgerResponse>, I>>(
    _: I,
  ): ReconcileUsageWithLedgerResponse {
    const message = createBaseReconcileUsageWithLedgerResponse();
    return message;
  },
};

function createBasePaginatedRequest(): PaginatedRequest {
  return { perPage: 0, page: 0 };
}

export const PaginatedRequest = {
  encode(message: PaginatedRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.perPage !== 0) {
      writer.uint32(8).int64(message.perPage);
    }
    if (message.page !== 0) {
      writer.uint32(16).int64(message.page);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PaginatedRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePaginatedRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.perPage = longToNumber(reader.int64() as Long);
          break;
        case 2:
          message.page = longToNumber(reader.int64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PaginatedRequest {
    return {
      perPage: isSet(object.perPage) ? Number(object.perPage) : 0,
      page: isSet(object.page) ? Number(object.page) : 0,
    };
  },

  toJSON(message: PaginatedRequest): unknown {
    const obj: any = {};
    message.perPage !== undefined && (obj.perPage = Math.round(message.perPage));
    message.page !== undefined && (obj.page = Math.round(message.page));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PaginatedRequest>, I>>(object: I): PaginatedRequest {
    const message = createBasePaginatedRequest();
    message.perPage = object.perPage ?? 0;
    message.page = object.page ?? 0;
    return message;
  },
};

function createBasePaginatedResponse(): PaginatedResponse {
  return { perPage: 0, totalPages: 0, total: 0, page: 0 };
}

export const PaginatedResponse = {
  encode(message: PaginatedResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.perPage !== 0) {
      writer.uint32(16).int64(message.perPage);
    }
    if (message.totalPages !== 0) {
      writer.uint32(24).int64(message.totalPages);
    }
    if (message.total !== 0) {
      writer.uint32(32).int64(message.total);
    }
    if (message.page !== 0) {
      writer.uint32(40).int64(message.page);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PaginatedResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePaginatedResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          message.perPage = longToNumber(reader.int64() as Long);
          break;
        case 3:
          message.totalPages = longToNumber(reader.int64() as Long);
          break;
        case 4:
          message.total = longToNumber(reader.int64() as Long);
          break;
        case 5:
          message.page = longToNumber(reader.int64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PaginatedResponse {
    return {
      perPage: isSet(object.perPage) ? Number(object.perPage) : 0,
      totalPages: isSet(object.totalPages) ? Number(object.totalPages) : 0,
      total: isSet(object.total) ? Number(object.total) : 0,
      page: isSet(object.page) ? Number(object.page) : 0,
    };
  },

  toJSON(message: PaginatedResponse): unknown {
    const obj: any = {};
    message.perPage !== undefined && (obj.perPage = Math.round(message.perPage));
    message.totalPages !== undefined && (obj.totalPages = Math.round(message.totalPages));
    message.total !== undefined && (obj.total = Math.round(message.total));
    message.page !== undefined && (obj.page = Math.round(message.page));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PaginatedResponse>, I>>(object: I): PaginatedResponse {
    const message = createBasePaginatedResponse();
    message.perPage = object.perPage ?? 0;
    message.totalPages = object.totalPages ?? 0;
    message.total = object.total ?? 0;
    message.page = object.page ?? 0;
    return message;
  },
};

function createBaseListUsageRequest(): ListUsageRequest {
  return { attributionId: "", from: undefined, to: undefined, order: 0, pagination: undefined };
}

export const ListUsageRequest = {
  encode(message: ListUsageRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.from !== undefined) {
      Timestamp.encode(toTimestamp(message.from), writer.uint32(18).fork()).ldelim();
    }
    if (message.to !== undefined) {
      Timestamp.encode(toTimestamp(message.to), writer.uint32(26).fork()).ldelim();
    }
    if (message.order !== 0) {
      writer.uint32(32).int32(message.order);
    }
    if (message.pagination !== undefined) {
      PaginatedRequest.encode(message.pagination, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListUsageRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListUsageRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        case 2:
          message.from = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 3:
          message.to = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 4:
          message.order = reader.int32() as any;
          break;
        case 5:
          message.pagination = PaginatedRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListUsageRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      from: isSet(object.from) ? fromJsonTimestamp(object.from) : undefined,
      to: isSet(object.to) ? fromJsonTimestamp(object.to) : undefined,
      order: isSet(object.order) ? listUsageRequest_OrderingFromJSON(object.order) : 0,
      pagination: isSet(object.pagination) ? PaginatedRequest.fromJSON(object.pagination) : undefined,
    };
  },

  toJSON(message: ListUsageRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.from !== undefined && (obj.from = message.from.toISOString());
    message.to !== undefined && (obj.to = message.to.toISOString());
    message.order !== undefined && (obj.order = listUsageRequest_OrderingToJSON(message.order));
    message.pagination !== undefined &&
      (obj.pagination = message.pagination ? PaginatedRequest.toJSON(message.pagination) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ListUsageRequest>, I>>(object: I): ListUsageRequest {
    const message = createBaseListUsageRequest();
    message.attributionId = object.attributionId ?? "";
    message.from = object.from ?? undefined;
    message.to = object.to ?? undefined;
    message.order = object.order ?? 0;
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PaginatedRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },
};

function createBaseListUsageResponse(): ListUsageResponse {
  return { usageEntries: [], pagination: undefined, creditBalanceAtStart: 0, creditBalanceAtEnd: 0 };
}

export const ListUsageResponse = {
  encode(message: ListUsageResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.usageEntries) {
      Usage.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PaginatedResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    if (message.creditBalanceAtStart !== 0) {
      writer.uint32(25).double(message.creditBalanceAtStart);
    }
    if (message.creditBalanceAtEnd !== 0) {
      writer.uint32(33).double(message.creditBalanceAtEnd);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListUsageResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListUsageResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.usageEntries.push(Usage.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PaginatedResponse.decode(reader, reader.uint32());
          break;
        case 3:
          message.creditBalanceAtStart = reader.double();
          break;
        case 4:
          message.creditBalanceAtEnd = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListUsageResponse {
    return {
      usageEntries: Array.isArray(object?.usageEntries) ? object.usageEntries.map((e: any) => Usage.fromJSON(e)) : [],
      pagination: isSet(object.pagination) ? PaginatedResponse.fromJSON(object.pagination) : undefined,
      creditBalanceAtStart: isSet(object.creditBalanceAtStart) ? Number(object.creditBalanceAtStart) : 0,
      creditBalanceAtEnd: isSet(object.creditBalanceAtEnd) ? Number(object.creditBalanceAtEnd) : 0,
    };
  },

  toJSON(message: ListUsageResponse): unknown {
    const obj: any = {};
    if (message.usageEntries) {
      obj.usageEntries = message.usageEntries.map((e) => e ? Usage.toJSON(e) : undefined);
    } else {
      obj.usageEntries = [];
    }
    message.pagination !== undefined &&
      (obj.pagination = message.pagination ? PaginatedResponse.toJSON(message.pagination) : undefined);
    message.creditBalanceAtStart !== undefined && (obj.creditBalanceAtStart = message.creditBalanceAtStart);
    message.creditBalanceAtEnd !== undefined && (obj.creditBalanceAtEnd = message.creditBalanceAtEnd);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ListUsageResponse>, I>>(object: I): ListUsageResponse {
    const message = createBaseListUsageResponse();
    message.usageEntries = object.usageEntries?.map((e) => Usage.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PaginatedResponse.fromPartial(object.pagination)
      : undefined;
    message.creditBalanceAtStart = object.creditBalanceAtStart ?? 0;
    message.creditBalanceAtEnd = object.creditBalanceAtEnd ?? 0;
    return message;
  },
};

function createBaseUsage(): Usage {
  return {
    id: "",
    attributionId: "",
    description: "",
    credits: 0,
    effectiveTime: undefined,
    kind: 0,
    workspaceInstanceId: "",
    draft: false,
    metadata: "",
  };
}

export const Usage = {
  encode(message: Usage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.attributionId !== "") {
      writer.uint32(18).string(message.attributionId);
    }
    if (message.description !== "") {
      writer.uint32(26).string(message.description);
    }
    if (message.credits !== 0) {
      writer.uint32(33).double(message.credits);
    }
    if (message.effectiveTime !== undefined) {
      Timestamp.encode(toTimestamp(message.effectiveTime), writer.uint32(42).fork()).ldelim();
    }
    if (message.kind !== 0) {
      writer.uint32(48).int32(message.kind);
    }
    if (message.workspaceInstanceId !== "") {
      writer.uint32(58).string(message.workspaceInstanceId);
    }
    if (message.draft === true) {
      writer.uint32(64).bool(message.draft);
    }
    if (message.metadata !== "") {
      writer.uint32(74).string(message.metadata);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Usage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUsage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.attributionId = reader.string();
          break;
        case 3:
          message.description = reader.string();
          break;
        case 4:
          message.credits = reader.double();
          break;
        case 5:
          message.effectiveTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 6:
          message.kind = reader.int32() as any;
          break;
        case 7:
          message.workspaceInstanceId = reader.string();
          break;
        case 8:
          message.draft = reader.bool();
          break;
        case 9:
          message.metadata = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Usage {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      description: isSet(object.description) ? String(object.description) : "",
      credits: isSet(object.credits) ? Number(object.credits) : 0,
      effectiveTime: isSet(object.effectiveTime) ? fromJsonTimestamp(object.effectiveTime) : undefined,
      kind: isSet(object.kind) ? usage_KindFromJSON(object.kind) : 0,
      workspaceInstanceId: isSet(object.workspaceInstanceId) ? String(object.workspaceInstanceId) : "",
      draft: isSet(object.draft) ? Boolean(object.draft) : false,
      metadata: isSet(object.metadata) ? String(object.metadata) : "",
    };
  },

  toJSON(message: Usage): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.description !== undefined && (obj.description = message.description);
    message.credits !== undefined && (obj.credits = message.credits);
    message.effectiveTime !== undefined && (obj.effectiveTime = message.effectiveTime.toISOString());
    message.kind !== undefined && (obj.kind = usage_KindToJSON(message.kind));
    message.workspaceInstanceId !== undefined && (obj.workspaceInstanceId = message.workspaceInstanceId);
    message.draft !== undefined && (obj.draft = message.draft);
    message.metadata !== undefined && (obj.metadata = message.metadata);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Usage>, I>>(object: I): Usage {
    const message = createBaseUsage();
    message.id = object.id ?? "";
    message.attributionId = object.attributionId ?? "";
    message.description = object.description ?? "";
    message.credits = object.credits ?? 0;
    message.effectiveTime = object.effectiveTime ?? undefined;
    message.kind = object.kind ?? 0;
    message.workspaceInstanceId = object.workspaceInstanceId ?? "";
    message.draft = object.draft ?? false;
    message.metadata = object.metadata ?? "";
    return message;
  },
};

function createBaseSetCostCenterRequest(): SetCostCenterRequest {
  return { costCenter: undefined };
}

export const SetCostCenterRequest = {
  encode(message: SetCostCenterRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.costCenter !== undefined) {
      CostCenter.encode(message.costCenter, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetCostCenterRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetCostCenterRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.costCenter = CostCenter.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetCostCenterRequest {
    return { costCenter: isSet(object.costCenter) ? CostCenter.fromJSON(object.costCenter) : undefined };
  },

  toJSON(message: SetCostCenterRequest): unknown {
    const obj: any = {};
    message.costCenter !== undefined &&
      (obj.costCenter = message.costCenter ? CostCenter.toJSON(message.costCenter) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetCostCenterRequest>, I>>(object: I): SetCostCenterRequest {
    const message = createBaseSetCostCenterRequest();
    message.costCenter = (object.costCenter !== undefined && object.costCenter !== null)
      ? CostCenter.fromPartial(object.costCenter)
      : undefined;
    return message;
  },
};

function createBaseSetCostCenterResponse(): SetCostCenterResponse {
  return {};
}

export const SetCostCenterResponse = {
  encode(_: SetCostCenterResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetCostCenterResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetCostCenterResponse();
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

  fromJSON(_: any): SetCostCenterResponse {
    return {};
  },

  toJSON(_: SetCostCenterResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetCostCenterResponse>, I>>(_: I): SetCostCenterResponse {
    const message = createBaseSetCostCenterResponse();
    return message;
  },
};

function createBaseGetCostCenterRequest(): GetCostCenterRequest {
  return { attributionId: "" };
}

export const GetCostCenterRequest = {
  encode(message: GetCostCenterRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetCostCenterRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetCostCenterRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetCostCenterRequest {
    return { attributionId: isSet(object.attributionId) ? String(object.attributionId) : "" };
  },

  toJSON(message: GetCostCenterRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<GetCostCenterRequest>, I>>(object: I): GetCostCenterRequest {
    const message = createBaseGetCostCenterRequest();
    message.attributionId = object.attributionId ?? "";
    return message;
  },
};

function createBaseGetCostCenterResponse(): GetCostCenterResponse {
  return { costCenter: undefined };
}

export const GetCostCenterResponse = {
  encode(message: GetCostCenterResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.costCenter !== undefined) {
      CostCenter.encode(message.costCenter, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetCostCenterResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetCostCenterResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.costCenter = CostCenter.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetCostCenterResponse {
    return { costCenter: isSet(object.costCenter) ? CostCenter.fromJSON(object.costCenter) : undefined };
  },

  toJSON(message: GetCostCenterResponse): unknown {
    const obj: any = {};
    message.costCenter !== undefined &&
      (obj.costCenter = message.costCenter ? CostCenter.toJSON(message.costCenter) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<GetCostCenterResponse>, I>>(object: I): GetCostCenterResponse {
    const message = createBaseGetCostCenterResponse();
    message.costCenter = (object.costCenter !== undefined && object.costCenter !== null)
      ? CostCenter.fromPartial(object.costCenter)
      : undefined;
    return message;
  },
};

function createBaseCostCenter(): CostCenter {
  return { attributionId: "", spendingLimit: 0, billingStrategy: 0 };
}

export const CostCenter = {
  encode(message: CostCenter, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.spendingLimit !== 0) {
      writer.uint32(16).int32(message.spendingLimit);
    }
    if (message.billingStrategy !== 0) {
      writer.uint32(24).int32(message.billingStrategy);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CostCenter {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCostCenter();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        case 2:
          message.spendingLimit = reader.int32();
          break;
        case 3:
          message.billingStrategy = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CostCenter {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      spendingLimit: isSet(object.spendingLimit) ? Number(object.spendingLimit) : 0,
      billingStrategy: isSet(object.billingStrategy) ? billingStrategyFromJSON(object.billingStrategy) : 0,
    };
  },

  toJSON(message: CostCenter): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.spendingLimit !== undefined && (obj.spendingLimit = Math.round(message.spendingLimit));
    message.billingStrategy !== undefined && (obj.billingStrategy = billingStrategyToJSON(message.billingStrategy));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<CostCenter>, I>>(object: I): CostCenter {
    const message = createBaseCostCenter();
    message.attributionId = object.attributionId ?? "";
    message.spendingLimit = object.spendingLimit ?? 0;
    message.billingStrategy = object.billingStrategy ?? 0;
    return message;
  },
};

export interface UsageService {
  /** GetCostCenter retrieves the active cost center for the given attributionID */
  GetCostCenter(request: DeepPartial<GetCostCenterRequest>, metadata?: grpc.Metadata): Promise<GetCostCenterResponse>;
  /** DEPRECATED (use UpdateBillingStrategy) */
  SetCostCenter(request: DeepPartial<SetCostCenterRequest>, metadata?: grpc.Metadata): Promise<SetCostCenterResponse>;
  /** UpdateBillingStrategy updates the billing strategy for the given attributionID */
  UpdateBillingStrategy(
    request: DeepPartial<UpdateBillingStrategyRequest>,
    metadata?: grpc.Metadata,
  ): Promise<UpdateBillingStrategyResponse>;
  /** Triggers reconciliation of usage with ledger implementation. */
  ReconcileUsageWithLedger(
    request: DeepPartial<ReconcileUsageWithLedgerRequest>,
    metadata?: grpc.Metadata,
  ): Promise<ReconcileUsageWithLedgerResponse>;
  /** ListUsage retrieves all usage for the specified attributionId and theb given time range */
  ListUsage(request: DeepPartial<ListUsageRequest>, metadata?: grpc.Metadata): Promise<ListUsageResponse>;
}

export class UsageServiceClientImpl implements UsageService {
  private readonly rpc: Rpc;

  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.GetCostCenter = this.GetCostCenter.bind(this);
    this.SetCostCenter = this.SetCostCenter.bind(this);
    this.UpdateBillingStrategy = this.UpdateBillingStrategy.bind(this);
    this.ReconcileUsageWithLedger = this.ReconcileUsageWithLedger.bind(this);
    this.ListUsage = this.ListUsage.bind(this);
  }

  GetCostCenter(request: DeepPartial<GetCostCenterRequest>, metadata?: grpc.Metadata): Promise<GetCostCenterResponse> {
    return this.rpc.unary(UsageServiceGetCostCenterDesc, GetCostCenterRequest.fromPartial(request), metadata);
  }

  SetCostCenter(request: DeepPartial<SetCostCenterRequest>, metadata?: grpc.Metadata): Promise<SetCostCenterResponse> {
    return this.rpc.unary(UsageServiceSetCostCenterDesc, SetCostCenterRequest.fromPartial(request), metadata);
  }

  UpdateBillingStrategy(
    request: DeepPartial<UpdateBillingStrategyRequest>,
    metadata?: grpc.Metadata,
  ): Promise<UpdateBillingStrategyResponse> {
    return this.rpc.unary(
      UsageServiceUpdateBillingStrategyDesc,
      UpdateBillingStrategyRequest.fromPartial(request),
      metadata,
    );
  }

  ReconcileUsageWithLedger(
    request: DeepPartial<ReconcileUsageWithLedgerRequest>,
    metadata?: grpc.Metadata,
  ): Promise<ReconcileUsageWithLedgerResponse> {
    return this.rpc.unary(
      UsageServiceReconcileUsageWithLedgerDesc,
      ReconcileUsageWithLedgerRequest.fromPartial(request),
      metadata,
    );
  }

  ListUsage(request: DeepPartial<ListUsageRequest>, metadata?: grpc.Metadata): Promise<ListUsageResponse> {
    return this.rpc.unary(UsageServiceListUsageDesc, ListUsageRequest.fromPartial(request), metadata);
  }
}

export const UsageServiceDesc = { serviceName: "usage.v1.UsageService" };

export const UsageServiceGetCostCenterDesc: UnaryMethodDefinitionish = {
  methodName: "GetCostCenter",
  service: UsageServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return GetCostCenterRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...GetCostCenterResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

export const UsageServiceSetCostCenterDesc: UnaryMethodDefinitionish = {
  methodName: "SetCostCenter",
  service: UsageServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return SetCostCenterRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...SetCostCenterResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

export const UsageServiceUpdateBillingStrategyDesc: UnaryMethodDefinitionish = {
  methodName: "UpdateBillingStrategy",
  service: UsageServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return UpdateBillingStrategyRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...UpdateBillingStrategyResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

export const UsageServiceReconcileUsageWithLedgerDesc: UnaryMethodDefinitionish = {
  methodName: "ReconcileUsageWithLedger",
  service: UsageServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return ReconcileUsageWithLedgerRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...ReconcileUsageWithLedgerResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

export const UsageServiceListUsageDesc: UnaryMethodDefinitionish = {
  methodName: "ListUsage",
  service: UsageServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return ListUsageRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...ListUsageResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

interface UnaryMethodDefinitionishR extends grpc.UnaryMethodDefinition<any, any> {
  requestStream: any;
  responseStream: any;
}

type UnaryMethodDefinitionish = UnaryMethodDefinitionishR;

interface Rpc {
  unary<T extends UnaryMethodDefinitionish>(
    methodDesc: T,
    request: any,
    metadata: grpc.Metadata | undefined,
  ): Promise<any>;
}

export class GrpcWebImpl {
  private host: string;
  private options: {
    transport?: grpc.TransportFactory;

    debug?: boolean;
    metadata?: grpc.Metadata;
    upStreamRetryCodes?: number[];
  };

  constructor(
    host: string,
    options: {
      transport?: grpc.TransportFactory;

      debug?: boolean;
      metadata?: grpc.Metadata;
      upStreamRetryCodes?: number[];
    },
  ) {
    this.host = host;
    this.options = options;
  }

  unary<T extends UnaryMethodDefinitionish>(
    methodDesc: T,
    _request: any,
    metadata: grpc.Metadata | undefined,
  ): Promise<any> {
    const request = { ..._request, ...methodDesc.requestType };
    const maybeCombinedMetadata = metadata && this.options.metadata
      ? new BrowserHeaders({ ...this.options?.metadata.headersMap, ...metadata?.headersMap })
      : metadata || this.options.metadata;
    return new Promise((resolve, reject) => {
      grpc.unary(methodDesc, {
        request,
        host: this.host,
        metadata: maybeCombinedMetadata,
        transport: this.options.transport,
        debug: this.options.debug,
        onEnd: function (response) {
          if (response.status === grpc.Code.OK) {
            resolve(response.message);
          } else {
            const err = new GrpcWebError(response.statusMessage, response.status, response.trailers);
            reject(err);
          }
        },
      });
    });
  }
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

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function toTimestamp(date: Date): Timestamp {
  const seconds = date.getTime() / 1_000;
  const nanos = (date.getTime() % 1_000) * 1_000_000;
  return { seconds, nanos };
}

function fromTimestamp(t: Timestamp): Date {
  let millis = t.seconds * 1_000;
  millis += t.nanos / 1_000_000;
  return new Date(millis);
}

function fromJsonTimestamp(o: any): Date {
  if (o instanceof Date) {
    return o;
  } else if (typeof o === "string") {
    return new Date(o);
  } else {
    return fromTimestamp(Timestamp.fromJSON(o));
  }
}

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

export class GrpcWebError extends Error {
  constructor(message: string, public code: grpc.Code, public metadata: grpc.Metadata) {
    super(message);
  }
}
