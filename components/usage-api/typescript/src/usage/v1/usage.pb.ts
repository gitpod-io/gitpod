/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "../../google/protobuf/timestamp.pb";
import Long = require("long");

export const protobufPackage = "usage.v1";

export interface ReconcileUsageRequest {
  /** from specifies the starting time range for this request. */
  from:
    | Date
    | undefined;
  /** to specifies the end time range for this request. */
  to: Date | undefined;
}

export interface ReconcileUsageResponse {
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
  /** optional user_id can be used to filter the results to only include instances created by the given user */
  userId: string;
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
  ORDERING_DESCENDING = "ORDERING_DESCENDING",
  ORDERING_ASCENDING = "ORDERING_ASCENDING",
  UNRECOGNIZED = "UNRECOGNIZED",
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

export function listUsageRequest_OrderingToNumber(object: ListUsageRequest_Ordering): number {
  switch (object) {
    case ListUsageRequest_Ordering.ORDERING_DESCENDING:
      return 0;
    case ListUsageRequest_Ordering.ORDERING_ASCENDING:
      return 1;
    case ListUsageRequest_Ordering.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface ListUsageResponse {
  usageEntries: Usage[];
  pagination:
    | PaginatedResponse
    | undefined;
  /** the amount of credits the given account (attributionId) has used during the requested period */
  creditsUsed: number;
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
  KIND_WORKSPACE_INSTANCE = "KIND_WORKSPACE_INSTANCE",
  KIND_INVOICE = "KIND_INVOICE",
  UNRECOGNIZED = "UNRECOGNIZED",
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

export function usage_KindToNumber(object: Usage_Kind): number {
  switch (object) {
    case Usage_Kind.KIND_WORKSPACE_INSTANCE:
      return 0;
    case Usage_Kind.KIND_INVOICE:
      return 1;
    case Usage_Kind.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface SetCostCenterRequest {
  costCenter: CostCenter | undefined;
}

export interface SetCostCenterResponse {
  costCenter: CostCenter | undefined;
}

export interface GetBalanceRequest {
  attributionId: string;
}

export interface GetBalanceResponse {
  credits: number;
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
  billingStrategy: CostCenter_BillingStrategy;
  /** next_billing_time specifies when the next billing cycle happens. Only set when billing strategy is 'other'. This property is readonly. */
  nextBillingTime: Date | undefined;
  billingCycleStart: Date | undefined;
}

export enum CostCenter_BillingStrategy {
  BILLING_STRATEGY_STRIPE = "BILLING_STRATEGY_STRIPE",
  BILLING_STRATEGY_OTHER = "BILLING_STRATEGY_OTHER",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function costCenter_BillingStrategyFromJSON(object: any): CostCenter_BillingStrategy {
  switch (object) {
    case 0:
    case "BILLING_STRATEGY_STRIPE":
      return CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
    case 1:
    case "BILLING_STRATEGY_OTHER":
      return CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER;
    case -1:
    case "UNRECOGNIZED":
    default:
      return CostCenter_BillingStrategy.UNRECOGNIZED;
  }
}

export function costCenter_BillingStrategyToJSON(object: CostCenter_BillingStrategy): string {
  switch (object) {
    case CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE:
      return "BILLING_STRATEGY_STRIPE";
    case CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER:
      return "BILLING_STRATEGY_OTHER";
    case CostCenter_BillingStrategy.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function costCenter_BillingStrategyToNumber(object: CostCenter_BillingStrategy): number {
  switch (object) {
    case CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE:
      return 0;
    case CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER:
      return 1;
    case CostCenter_BillingStrategy.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface ResetUsageRequest {
}

export interface ResetUsageResponse {
}

export interface AddUsageCreditNoteRequest {
  attributionId: string;
  /** the amount of credits to add to the given account */
  credits: number;
  /** a human readable description for the reason this credit note exists */
  description: string;
  /** the id of the user (admin) who created the note */
  userId: string;
}

export interface AddUsageCreditNoteResponse {
}

function createBaseReconcileUsageRequest(): ReconcileUsageRequest {
  return { from: undefined, to: undefined };
}

export const ReconcileUsageRequest = {
  encode(message: ReconcileUsageRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.from !== undefined) {
      Timestamp.encode(toTimestamp(message.from), writer.uint32(10).fork()).ldelim();
    }
    if (message.to !== undefined) {
      Timestamp.encode(toTimestamp(message.to), writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReconcileUsageRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileUsageRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.from = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.to = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): ReconcileUsageRequest {
    return {
      from: isSet(object.from) ? fromJsonTimestamp(object.from) : undefined,
      to: isSet(object.to) ? fromJsonTimestamp(object.to) : undefined,
    };
  },

  toJSON(message: ReconcileUsageRequest): unknown {
    const obj: any = {};
    if (message.from !== undefined) {
      obj.from = message.from.toISOString();
    }
    if (message.to !== undefined) {
      obj.to = message.to.toISOString();
    }
    return obj;
  },

  create(base?: DeepPartial<ReconcileUsageRequest>): ReconcileUsageRequest {
    return ReconcileUsageRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<ReconcileUsageRequest>): ReconcileUsageRequest {
    const message = createBaseReconcileUsageRequest();
    message.from = object.from ?? undefined;
    message.to = object.to ?? undefined;
    return message;
  },
};

function createBaseReconcileUsageResponse(): ReconcileUsageResponse {
  return {};
}

export const ReconcileUsageResponse = {
  encode(_: ReconcileUsageResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReconcileUsageResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileUsageResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): ReconcileUsageResponse {
    return {};
  },

  toJSON(_: ReconcileUsageResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<ReconcileUsageResponse>): ReconcileUsageResponse {
    return ReconcileUsageResponse.fromPartial(base ?? {});
  },
  fromPartial(_: DeepPartial<ReconcileUsageResponse>): ReconcileUsageResponse {
    const message = createBaseReconcileUsageResponse();
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePaginatedRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.perPage = longToNumber(reader.int64() as Long);
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.page = longToNumber(reader.int64() as Long);
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
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
    if (message.perPage !== 0) {
      obj.perPage = Math.round(message.perPage);
    }
    if (message.page !== 0) {
      obj.page = Math.round(message.page);
    }
    return obj;
  },

  create(base?: DeepPartial<PaginatedRequest>): PaginatedRequest {
    return PaginatedRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<PaginatedRequest>): PaginatedRequest {
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePaginatedResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          if (tag !== 16) {
            break;
          }

          message.perPage = longToNumber(reader.int64() as Long);
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.totalPages = longToNumber(reader.int64() as Long);
          continue;
        case 4:
          if (tag !== 32) {
            break;
          }

          message.total = longToNumber(reader.int64() as Long);
          continue;
        case 5:
          if (tag !== 40) {
            break;
          }

          message.page = longToNumber(reader.int64() as Long);
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
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
    if (message.perPage !== 0) {
      obj.perPage = Math.round(message.perPage);
    }
    if (message.totalPages !== 0) {
      obj.totalPages = Math.round(message.totalPages);
    }
    if (message.total !== 0) {
      obj.total = Math.round(message.total);
    }
    if (message.page !== 0) {
      obj.page = Math.round(message.page);
    }
    return obj;
  },

  create(base?: DeepPartial<PaginatedResponse>): PaginatedResponse {
    return PaginatedResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<PaginatedResponse>): PaginatedResponse {
    const message = createBasePaginatedResponse();
    message.perPage = object.perPage ?? 0;
    message.totalPages = object.totalPages ?? 0;
    message.total = object.total ?? 0;
    message.page = object.page ?? 0;
    return message;
  },
};

function createBaseListUsageRequest(): ListUsageRequest {
  return {
    attributionId: "",
    userId: "",
    from: undefined,
    to: undefined,
    order: ListUsageRequest_Ordering.ORDERING_DESCENDING,
    pagination: undefined,
  };
}

export const ListUsageRequest = {
  encode(message: ListUsageRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.userId !== "") {
      writer.uint32(50).string(message.userId);
    }
    if (message.from !== undefined) {
      Timestamp.encode(toTimestamp(message.from), writer.uint32(18).fork()).ldelim();
    }
    if (message.to !== undefined) {
      Timestamp.encode(toTimestamp(message.to), writer.uint32(26).fork()).ldelim();
    }
    if (message.order !== ListUsageRequest_Ordering.ORDERING_DESCENDING) {
      writer.uint32(32).int32(listUsageRequest_OrderingToNumber(message.order));
    }
    if (message.pagination !== undefined) {
      PaginatedRequest.encode(message.pagination, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListUsageRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListUsageRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.attributionId = reader.string();
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.userId = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.from = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.to = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 4:
          if (tag !== 32) {
            break;
          }

          message.order = listUsageRequest_OrderingFromJSON(reader.int32());
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.pagination = PaginatedRequest.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): ListUsageRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      userId: isSet(object.userId) ? String(object.userId) : "",
      from: isSet(object.from) ? fromJsonTimestamp(object.from) : undefined,
      to: isSet(object.to) ? fromJsonTimestamp(object.to) : undefined,
      order: isSet(object.order)
        ? listUsageRequest_OrderingFromJSON(object.order)
        : ListUsageRequest_Ordering.ORDERING_DESCENDING,
      pagination: isSet(object.pagination) ? PaginatedRequest.fromJSON(object.pagination) : undefined,
    };
  },

  toJSON(message: ListUsageRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    if (message.userId !== "") {
      obj.userId = message.userId;
    }
    if (message.from !== undefined) {
      obj.from = message.from.toISOString();
    }
    if (message.to !== undefined) {
      obj.to = message.to.toISOString();
    }
    if (message.order !== ListUsageRequest_Ordering.ORDERING_DESCENDING) {
      obj.order = listUsageRequest_OrderingToJSON(message.order);
    }
    if (message.pagination !== undefined) {
      obj.pagination = PaginatedRequest.toJSON(message.pagination);
    }
    return obj;
  },

  create(base?: DeepPartial<ListUsageRequest>): ListUsageRequest {
    return ListUsageRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<ListUsageRequest>): ListUsageRequest {
    const message = createBaseListUsageRequest();
    message.attributionId = object.attributionId ?? "";
    message.userId = object.userId ?? "";
    message.from = object.from ?? undefined;
    message.to = object.to ?? undefined;
    message.order = object.order ?? ListUsageRequest_Ordering.ORDERING_DESCENDING;
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PaginatedRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },
};

function createBaseListUsageResponse(): ListUsageResponse {
  return { usageEntries: [], pagination: undefined, creditsUsed: 0 };
}

export const ListUsageResponse = {
  encode(message: ListUsageResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.usageEntries) {
      Usage.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PaginatedResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    if (message.creditsUsed !== 0) {
      writer.uint32(25).double(message.creditsUsed);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListUsageResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListUsageResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.usageEntries.push(Usage.decode(reader, reader.uint32()));
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.pagination = PaginatedResponse.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 25) {
            break;
          }

          message.creditsUsed = reader.double();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): ListUsageResponse {
    return {
      usageEntries: Array.isArray(object?.usageEntries) ? object.usageEntries.map((e: any) => Usage.fromJSON(e)) : [],
      pagination: isSet(object.pagination) ? PaginatedResponse.fromJSON(object.pagination) : undefined,
      creditsUsed: isSet(object.creditsUsed) ? Number(object.creditsUsed) : 0,
    };
  },

  toJSON(message: ListUsageResponse): unknown {
    const obj: any = {};
    if (message.usageEntries?.length) {
      obj.usageEntries = message.usageEntries.map((e) => Usage.toJSON(e));
    }
    if (message.pagination !== undefined) {
      obj.pagination = PaginatedResponse.toJSON(message.pagination);
    }
    if (message.creditsUsed !== 0) {
      obj.creditsUsed = message.creditsUsed;
    }
    return obj;
  },

  create(base?: DeepPartial<ListUsageResponse>): ListUsageResponse {
    return ListUsageResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<ListUsageResponse>): ListUsageResponse {
    const message = createBaseListUsageResponse();
    message.usageEntries = object.usageEntries?.map((e) => Usage.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PaginatedResponse.fromPartial(object.pagination)
      : undefined;
    message.creditsUsed = object.creditsUsed ?? 0;
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
    kind: Usage_Kind.KIND_WORKSPACE_INSTANCE,
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
    if (message.kind !== Usage_Kind.KIND_WORKSPACE_INSTANCE) {
      writer.uint32(48).int32(usage_KindToNumber(message.kind));
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUsage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.id = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.attributionId = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.description = reader.string();
          continue;
        case 4:
          if (tag !== 33) {
            break;
          }

          message.credits = reader.double();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.effectiveTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 6:
          if (tag !== 48) {
            break;
          }

          message.kind = usage_KindFromJSON(reader.int32());
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.workspaceInstanceId = reader.string();
          continue;
        case 8:
          if (tag !== 64) {
            break;
          }

          message.draft = reader.bool();
          continue;
        case 9:
          if (tag !== 74) {
            break;
          }

          message.metadata = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
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
      kind: isSet(object.kind) ? usage_KindFromJSON(object.kind) : Usage_Kind.KIND_WORKSPACE_INSTANCE,
      workspaceInstanceId: isSet(object.workspaceInstanceId) ? String(object.workspaceInstanceId) : "",
      draft: isSet(object.draft) ? Boolean(object.draft) : false,
      metadata: isSet(object.metadata) ? String(object.metadata) : "",
    };
  },

  toJSON(message: Usage): unknown {
    const obj: any = {};
    if (message.id !== "") {
      obj.id = message.id;
    }
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    if (message.description !== "") {
      obj.description = message.description;
    }
    if (message.credits !== 0) {
      obj.credits = message.credits;
    }
    if (message.effectiveTime !== undefined) {
      obj.effectiveTime = message.effectiveTime.toISOString();
    }
    if (message.kind !== Usage_Kind.KIND_WORKSPACE_INSTANCE) {
      obj.kind = usage_KindToJSON(message.kind);
    }
    if (message.workspaceInstanceId !== "") {
      obj.workspaceInstanceId = message.workspaceInstanceId;
    }
    if (message.draft === true) {
      obj.draft = message.draft;
    }
    if (message.metadata !== "") {
      obj.metadata = message.metadata;
    }
    return obj;
  },

  create(base?: DeepPartial<Usage>): Usage {
    return Usage.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<Usage>): Usage {
    const message = createBaseUsage();
    message.id = object.id ?? "";
    message.attributionId = object.attributionId ?? "";
    message.description = object.description ?? "";
    message.credits = object.credits ?? 0;
    message.effectiveTime = object.effectiveTime ?? undefined;
    message.kind = object.kind ?? Usage_Kind.KIND_WORKSPACE_INSTANCE;
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetCostCenterRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.costCenter = CostCenter.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): SetCostCenterRequest {
    return { costCenter: isSet(object.costCenter) ? CostCenter.fromJSON(object.costCenter) : undefined };
  },

  toJSON(message: SetCostCenterRequest): unknown {
    const obj: any = {};
    if (message.costCenter !== undefined) {
      obj.costCenter = CostCenter.toJSON(message.costCenter);
    }
    return obj;
  },

  create(base?: DeepPartial<SetCostCenterRequest>): SetCostCenterRequest {
    return SetCostCenterRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<SetCostCenterRequest>): SetCostCenterRequest {
    const message = createBaseSetCostCenterRequest();
    message.costCenter = (object.costCenter !== undefined && object.costCenter !== null)
      ? CostCenter.fromPartial(object.costCenter)
      : undefined;
    return message;
  },
};

function createBaseSetCostCenterResponse(): SetCostCenterResponse {
  return { costCenter: undefined };
}

export const SetCostCenterResponse = {
  encode(message: SetCostCenterResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.costCenter !== undefined) {
      CostCenter.encode(message.costCenter, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetCostCenterResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetCostCenterResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.costCenter = CostCenter.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): SetCostCenterResponse {
    return { costCenter: isSet(object.costCenter) ? CostCenter.fromJSON(object.costCenter) : undefined };
  },

  toJSON(message: SetCostCenterResponse): unknown {
    const obj: any = {};
    if (message.costCenter !== undefined) {
      obj.costCenter = CostCenter.toJSON(message.costCenter);
    }
    return obj;
  },

  create(base?: DeepPartial<SetCostCenterResponse>): SetCostCenterResponse {
    return SetCostCenterResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<SetCostCenterResponse>): SetCostCenterResponse {
    const message = createBaseSetCostCenterResponse();
    message.costCenter = (object.costCenter !== undefined && object.costCenter !== null)
      ? CostCenter.fromPartial(object.costCenter)
      : undefined;
    return message;
  },
};

function createBaseGetBalanceRequest(): GetBalanceRequest {
  return { attributionId: "" };
}

export const GetBalanceRequest = {
  encode(message: GetBalanceRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetBalanceRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetBalanceRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.attributionId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): GetBalanceRequest {
    return { attributionId: isSet(object.attributionId) ? String(object.attributionId) : "" };
  },

  toJSON(message: GetBalanceRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    return obj;
  },

  create(base?: DeepPartial<GetBalanceRequest>): GetBalanceRequest {
    return GetBalanceRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<GetBalanceRequest>): GetBalanceRequest {
    const message = createBaseGetBalanceRequest();
    message.attributionId = object.attributionId ?? "";
    return message;
  },
};

function createBaseGetBalanceResponse(): GetBalanceResponse {
  return { credits: 0 };
}

export const GetBalanceResponse = {
  encode(message: GetBalanceResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.credits !== 0) {
      writer.uint32(33).double(message.credits);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetBalanceResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetBalanceResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 4:
          if (tag !== 33) {
            break;
          }

          message.credits = reader.double();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): GetBalanceResponse {
    return { credits: isSet(object.credits) ? Number(object.credits) : 0 };
  },

  toJSON(message: GetBalanceResponse): unknown {
    const obj: any = {};
    if (message.credits !== 0) {
      obj.credits = message.credits;
    }
    return obj;
  },

  create(base?: DeepPartial<GetBalanceResponse>): GetBalanceResponse {
    return GetBalanceResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<GetBalanceResponse>): GetBalanceResponse {
    const message = createBaseGetBalanceResponse();
    message.credits = object.credits ?? 0;
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetCostCenterRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.attributionId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): GetCostCenterRequest {
    return { attributionId: isSet(object.attributionId) ? String(object.attributionId) : "" };
  },

  toJSON(message: GetCostCenterRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    return obj;
  },

  create(base?: DeepPartial<GetCostCenterRequest>): GetCostCenterRequest {
    return GetCostCenterRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<GetCostCenterRequest>): GetCostCenterRequest {
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetCostCenterResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.costCenter = CostCenter.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): GetCostCenterResponse {
    return { costCenter: isSet(object.costCenter) ? CostCenter.fromJSON(object.costCenter) : undefined };
  },

  toJSON(message: GetCostCenterResponse): unknown {
    const obj: any = {};
    if (message.costCenter !== undefined) {
      obj.costCenter = CostCenter.toJSON(message.costCenter);
    }
    return obj;
  },

  create(base?: DeepPartial<GetCostCenterResponse>): GetCostCenterResponse {
    return GetCostCenterResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<GetCostCenterResponse>): GetCostCenterResponse {
    const message = createBaseGetCostCenterResponse();
    message.costCenter = (object.costCenter !== undefined && object.costCenter !== null)
      ? CostCenter.fromPartial(object.costCenter)
      : undefined;
    return message;
  },
};

function createBaseCostCenter(): CostCenter {
  return {
    attributionId: "",
    spendingLimit: 0,
    billingStrategy: CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE,
    nextBillingTime: undefined,
    billingCycleStart: undefined,
  };
}

export const CostCenter = {
  encode(message: CostCenter, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.spendingLimit !== 0) {
      writer.uint32(16).int32(message.spendingLimit);
    }
    if (message.billingStrategy !== CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE) {
      writer.uint32(24).int32(costCenter_BillingStrategyToNumber(message.billingStrategy));
    }
    if (message.nextBillingTime !== undefined) {
      Timestamp.encode(toTimestamp(message.nextBillingTime), writer.uint32(34).fork()).ldelim();
    }
    if (message.billingCycleStart !== undefined) {
      Timestamp.encode(toTimestamp(message.billingCycleStart), writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CostCenter {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCostCenter();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.attributionId = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.spendingLimit = reader.int32();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.billingStrategy = costCenter_BillingStrategyFromJSON(reader.int32());
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.nextBillingTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.billingCycleStart = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CostCenter {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      spendingLimit: isSet(object.spendingLimit) ? Number(object.spendingLimit) : 0,
      billingStrategy: isSet(object.billingStrategy)
        ? costCenter_BillingStrategyFromJSON(object.billingStrategy)
        : CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE,
      nextBillingTime: isSet(object.nextBillingTime) ? fromJsonTimestamp(object.nextBillingTime) : undefined,
      billingCycleStart: isSet(object.billingCycleStart) ? fromJsonTimestamp(object.billingCycleStart) : undefined,
    };
  },

  toJSON(message: CostCenter): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    if (message.spendingLimit !== 0) {
      obj.spendingLimit = Math.round(message.spendingLimit);
    }
    if (message.billingStrategy !== CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE) {
      obj.billingStrategy = costCenter_BillingStrategyToJSON(message.billingStrategy);
    }
    if (message.nextBillingTime !== undefined) {
      obj.nextBillingTime = message.nextBillingTime.toISOString();
    }
    if (message.billingCycleStart !== undefined) {
      obj.billingCycleStart = message.billingCycleStart.toISOString();
    }
    return obj;
  },

  create(base?: DeepPartial<CostCenter>): CostCenter {
    return CostCenter.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<CostCenter>): CostCenter {
    const message = createBaseCostCenter();
    message.attributionId = object.attributionId ?? "";
    message.spendingLimit = object.spendingLimit ?? 0;
    message.billingStrategy = object.billingStrategy ?? CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
    message.nextBillingTime = object.nextBillingTime ?? undefined;
    message.billingCycleStart = object.billingCycleStart ?? undefined;
    return message;
  },
};

function createBaseResetUsageRequest(): ResetUsageRequest {
  return {};
}

export const ResetUsageRequest = {
  encode(_: ResetUsageRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResetUsageRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResetUsageRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): ResetUsageRequest {
    return {};
  },

  toJSON(_: ResetUsageRequest): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<ResetUsageRequest>): ResetUsageRequest {
    return ResetUsageRequest.fromPartial(base ?? {});
  },
  fromPartial(_: DeepPartial<ResetUsageRequest>): ResetUsageRequest {
    const message = createBaseResetUsageRequest();
    return message;
  },
};

function createBaseResetUsageResponse(): ResetUsageResponse {
  return {};
}

export const ResetUsageResponse = {
  encode(_: ResetUsageResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResetUsageResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResetUsageResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): ResetUsageResponse {
    return {};
  },

  toJSON(_: ResetUsageResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<ResetUsageResponse>): ResetUsageResponse {
    return ResetUsageResponse.fromPartial(base ?? {});
  },
  fromPartial(_: DeepPartial<ResetUsageResponse>): ResetUsageResponse {
    const message = createBaseResetUsageResponse();
    return message;
  },
};

function createBaseAddUsageCreditNoteRequest(): AddUsageCreditNoteRequest {
  return { attributionId: "", credits: 0, description: "", userId: "" };
}

export const AddUsageCreditNoteRequest = {
  encode(message: AddUsageCreditNoteRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.credits !== 0) {
      writer.uint32(16).int32(message.credits);
    }
    if (message.description !== "") {
      writer.uint32(26).string(message.description);
    }
    if (message.userId !== "") {
      writer.uint32(34).string(message.userId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AddUsageCreditNoteRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAddUsageCreditNoteRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.attributionId = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.credits = reader.int32();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.description = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.userId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): AddUsageCreditNoteRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      credits: isSet(object.credits) ? Number(object.credits) : 0,
      description: isSet(object.description) ? String(object.description) : "",
      userId: isSet(object.userId) ? String(object.userId) : "",
    };
  },

  toJSON(message: AddUsageCreditNoteRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    if (message.credits !== 0) {
      obj.credits = Math.round(message.credits);
    }
    if (message.description !== "") {
      obj.description = message.description;
    }
    if (message.userId !== "") {
      obj.userId = message.userId;
    }
    return obj;
  },

  create(base?: DeepPartial<AddUsageCreditNoteRequest>): AddUsageCreditNoteRequest {
    return AddUsageCreditNoteRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<AddUsageCreditNoteRequest>): AddUsageCreditNoteRequest {
    const message = createBaseAddUsageCreditNoteRequest();
    message.attributionId = object.attributionId ?? "";
    message.credits = object.credits ?? 0;
    message.description = object.description ?? "";
    message.userId = object.userId ?? "";
    return message;
  },
};

function createBaseAddUsageCreditNoteResponse(): AddUsageCreditNoteResponse {
  return {};
}

export const AddUsageCreditNoteResponse = {
  encode(_: AddUsageCreditNoteResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AddUsageCreditNoteResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAddUsageCreditNoteResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): AddUsageCreditNoteResponse {
    return {};
  },

  toJSON(_: AddUsageCreditNoteResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<AddUsageCreditNoteResponse>): AddUsageCreditNoteResponse {
    return AddUsageCreditNoteResponse.fromPartial(base ?? {});
  },
  fromPartial(_: DeepPartial<AddUsageCreditNoteResponse>): AddUsageCreditNoteResponse {
    const message = createBaseAddUsageCreditNoteResponse();
    return message;
  },
};

export type UsageServiceDefinition = typeof UsageServiceDefinition;
export const UsageServiceDefinition = {
  name: "UsageService",
  fullName: "usage.v1.UsageService",
  methods: {
    /** GetCostCenter retrieves the active cost center for the given attributionID */
    getCostCenter: {
      name: "GetCostCenter",
      requestType: GetCostCenterRequest,
      requestStream: false,
      responseType: GetCostCenterResponse,
      responseStream: false,
      options: {},
    },
    /** SetCostCenter stores the given cost center */
    setCostCenter: {
      name: "SetCostCenter",
      requestType: SetCostCenterRequest,
      requestStream: false,
      responseType: SetCostCenterResponse,
      responseStream: false,
      options: {},
    },
    /** Triggers reconciliation of usage. */
    reconcileUsage: {
      name: "ReconcileUsage",
      requestType: ReconcileUsageRequest,
      requestStream: false,
      responseType: ReconcileUsageResponse,
      responseStream: false,
      options: {},
    },
    /** ResetUsage resets Usage for CostCenters which have expired or will explire shortly */
    resetUsage: {
      name: "ResetUsage",
      requestType: ResetUsageRequest,
      requestStream: false,
      responseType: ResetUsageResponse,
      responseStream: false,
      options: {},
    },
    /** ListUsage retrieves all usage for the specified attributionId and theb given time range */
    listUsage: {
      name: "ListUsage",
      requestType: ListUsageRequest,
      requestStream: false,
      responseType: ListUsageResponse,
      responseStream: false,
      options: {},
    },
    /** GetBalance returns the current credits balance for the given attributionId */
    getBalance: {
      name: "GetBalance",
      requestType: GetBalanceRequest,
      requestStream: false,
      responseType: GetBalanceResponse,
      responseStream: false,
      options: {},
    },
    /** AddUsageCreditNote adds a usage credit note to the given cost center with the effective date of now */
    addUsageCreditNote: {
      name: "AddUsageCreditNote",
      requestType: AddUsageCreditNoteRequest,
      requestStream: false,
      responseType: AddUsageCreditNoteResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface UsageServiceImplementation<CallContextExt = {}> {
  /** GetCostCenter retrieves the active cost center for the given attributionID */
  getCostCenter(
    request: GetCostCenterRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetCostCenterResponse>>;
  /** SetCostCenter stores the given cost center */
  setCostCenter(
    request: SetCostCenterRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<SetCostCenterResponse>>;
  /** Triggers reconciliation of usage. */
  reconcileUsage(
    request: ReconcileUsageRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ReconcileUsageResponse>>;
  /** ResetUsage resets Usage for CostCenters which have expired or will explire shortly */
  resetUsage(
    request: ResetUsageRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ResetUsageResponse>>;
  /** ListUsage retrieves all usage for the specified attributionId and theb given time range */
  listUsage(request: ListUsageRequest, context: CallContext & CallContextExt): Promise<DeepPartial<ListUsageResponse>>;
  /** GetBalance returns the current credits balance for the given attributionId */
  getBalance(
    request: GetBalanceRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetBalanceResponse>>;
  /** AddUsageCreditNote adds a usage credit note to the given cost center with the effective date of now */
  addUsageCreditNote(
    request: AddUsageCreditNoteRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<AddUsageCreditNoteResponse>>;
}

export interface UsageServiceClient<CallOptionsExt = {}> {
  /** GetCostCenter retrieves the active cost center for the given attributionID */
  getCostCenter(
    request: DeepPartial<GetCostCenterRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetCostCenterResponse>;
  /** SetCostCenter stores the given cost center */
  setCostCenter(
    request: DeepPartial<SetCostCenterRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<SetCostCenterResponse>;
  /** Triggers reconciliation of usage. */
  reconcileUsage(
    request: DeepPartial<ReconcileUsageRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ReconcileUsageResponse>;
  /** ResetUsage resets Usage for CostCenters which have expired or will explire shortly */
  resetUsage(
    request: DeepPartial<ResetUsageRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ResetUsageResponse>;
  /** ListUsage retrieves all usage for the specified attributionId and theb given time range */
  listUsage(request: DeepPartial<ListUsageRequest>, options?: CallOptions & CallOptionsExt): Promise<ListUsageResponse>;
  /** GetBalance returns the current credits balance for the given attributionId */
  getBalance(
    request: DeepPartial<GetBalanceRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetBalanceResponse>;
  /** AddUsageCreditNote adds a usage credit note to the given cost center with the effective date of now */
  addUsageCreditNote(
    request: DeepPartial<AddUsageCreditNoteRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<AddUsageCreditNoteResponse>;
}

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

function toTimestamp(date: Date): Timestamp {
  const seconds = date.getTime() / 1_000;
  const nanos = (date.getTime() % 1_000) * 1_000_000;
  return { seconds, nanos };
}

function fromTimestamp(t: Timestamp): Date {
  let millis = (t.seconds || 0) * 1_000;
  millis += (t.nanos || 0) / 1_000_000;
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
