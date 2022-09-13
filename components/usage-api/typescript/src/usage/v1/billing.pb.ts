/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "../../google/protobuf/timestamp.pb";

export const protobufPackage = "usage.v1";

export enum System {
  SYSTEM_UNKNOWN = "SYSTEM_UNKNOWN",
  SYSTEM_CHARGEBEE = "SYSTEM_CHARGEBEE",
  SYSTEM_STRIPE = "SYSTEM_STRIPE",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function systemFromJSON(object: any): System {
  switch (object) {
    case 0:
    case "SYSTEM_UNKNOWN":
      return System.SYSTEM_UNKNOWN;
    case 1:
    case "SYSTEM_CHARGEBEE":
      return System.SYSTEM_CHARGEBEE;
    case 2:
    case "SYSTEM_STRIPE":
      return System.SYSTEM_STRIPE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return System.UNRECOGNIZED;
  }
}

export function systemToJSON(object: System): string {
  switch (object) {
    case System.SYSTEM_UNKNOWN:
      return "SYSTEM_UNKNOWN";
    case System.SYSTEM_CHARGEBEE:
      return "SYSTEM_CHARGEBEE";
    case System.SYSTEM_STRIPE:
      return "SYSTEM_STRIPE";
    case System.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function systemToNumber(object: System): number {
  switch (object) {
    case System.SYSTEM_UNKNOWN:
      return 0;
    case System.SYSTEM_CHARGEBEE:
      return 1;
    case System.SYSTEM_STRIPE:
      return 2;
    case System.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface ReconcileInvoicesRequest {
}

export interface ReconcileInvoicesResponse {
}

export interface GetUpcomingInvoiceRequest {
  teamId: string | undefined;
  userId: string | undefined;
}

export interface GetUpcomingInvoiceResponse {
  invoiceId: string;
  currency: string;
  amount: number;
  credits: number;
}

export interface FinalizeInvoiceRequest {
  invoiceId: string;
}

export interface FinalizeInvoiceResponse {
}

/**
 * If there are two billable sessions for this instance ID,
 * the second one's "from" will be the first one's "to"
 */
export interface SetBilledSessionRequest {
  instanceId: string;
  from: Date | undefined;
  system: System;
}

export interface SetBilledSessionResponse {
}

function createBaseReconcileInvoicesRequest(): ReconcileInvoicesRequest {
  return {};
}

export const ReconcileInvoicesRequest = {
  encode(_: ReconcileInvoicesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReconcileInvoicesRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileInvoicesRequest();
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

  fromJSON(_: any): ReconcileInvoicesRequest {
    return {};
  },

  toJSON(_: ReconcileInvoicesRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ReconcileInvoicesRequest>): ReconcileInvoicesRequest {
    const message = createBaseReconcileInvoicesRequest();
    return message;
  },
};

function createBaseReconcileInvoicesResponse(): ReconcileInvoicesResponse {
  return {};
}

export const ReconcileInvoicesResponse = {
  encode(_: ReconcileInvoicesResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReconcileInvoicesResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileInvoicesResponse();
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

  fromJSON(_: any): ReconcileInvoicesResponse {
    return {};
  },

  toJSON(_: ReconcileInvoicesResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ReconcileInvoicesResponse>): ReconcileInvoicesResponse {
    const message = createBaseReconcileInvoicesResponse();
    return message;
  },
};

function createBaseGetUpcomingInvoiceRequest(): GetUpcomingInvoiceRequest {
  return { teamId: undefined, userId: undefined };
}

export const GetUpcomingInvoiceRequest = {
  encode(message: GetUpcomingInvoiceRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.teamId !== undefined) {
      writer.uint32(10).string(message.teamId);
    }
    if (message.userId !== undefined) {
      writer.uint32(18).string(message.userId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetUpcomingInvoiceRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetUpcomingInvoiceRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.teamId = reader.string();
          break;
        case 2:
          message.userId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetUpcomingInvoiceRequest {
    return {
      teamId: isSet(object.teamId) ? String(object.teamId) : undefined,
      userId: isSet(object.userId) ? String(object.userId) : undefined,
    };
  },

  toJSON(message: GetUpcomingInvoiceRequest): unknown {
    const obj: any = {};
    message.teamId !== undefined && (obj.teamId = message.teamId);
    message.userId !== undefined && (obj.userId = message.userId);
    return obj;
  },

  fromPartial(object: DeepPartial<GetUpcomingInvoiceRequest>): GetUpcomingInvoiceRequest {
    const message = createBaseGetUpcomingInvoiceRequest();
    message.teamId = object.teamId ?? undefined;
    message.userId = object.userId ?? undefined;
    return message;
  },
};

function createBaseGetUpcomingInvoiceResponse(): GetUpcomingInvoiceResponse {
  return { invoiceId: "", currency: "", amount: 0, credits: 0 };
}

export const GetUpcomingInvoiceResponse = {
  encode(message: GetUpcomingInvoiceResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.invoiceId !== "") {
      writer.uint32(10).string(message.invoiceId);
    }
    if (message.currency !== "") {
      writer.uint32(18).string(message.currency);
    }
    if (message.amount !== 0) {
      writer.uint32(25).double(message.amount);
    }
    if (message.credits !== 0) {
      writer.uint32(32).int64(message.credits);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetUpcomingInvoiceResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetUpcomingInvoiceResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.invoiceId = reader.string();
          break;
        case 2:
          message.currency = reader.string();
          break;
        case 3:
          message.amount = reader.double();
          break;
        case 4:
          message.credits = longToNumber(reader.int64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetUpcomingInvoiceResponse {
    return {
      invoiceId: isSet(object.invoiceId) ? String(object.invoiceId) : "",
      currency: isSet(object.currency) ? String(object.currency) : "",
      amount: isSet(object.amount) ? Number(object.amount) : 0,
      credits: isSet(object.credits) ? Number(object.credits) : 0,
    };
  },

  toJSON(message: GetUpcomingInvoiceResponse): unknown {
    const obj: any = {};
    message.invoiceId !== undefined && (obj.invoiceId = message.invoiceId);
    message.currency !== undefined && (obj.currency = message.currency);
    message.amount !== undefined && (obj.amount = message.amount);
    message.credits !== undefined && (obj.credits = Math.round(message.credits));
    return obj;
  },

  fromPartial(object: DeepPartial<GetUpcomingInvoiceResponse>): GetUpcomingInvoiceResponse {
    const message = createBaseGetUpcomingInvoiceResponse();
    message.invoiceId = object.invoiceId ?? "";
    message.currency = object.currency ?? "";
    message.amount = object.amount ?? 0;
    message.credits = object.credits ?? 0;
    return message;
  },
};

function createBaseFinalizeInvoiceRequest(): FinalizeInvoiceRequest {
  return { invoiceId: "" };
}

export const FinalizeInvoiceRequest = {
  encode(message: FinalizeInvoiceRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.invoiceId !== "") {
      writer.uint32(10).string(message.invoiceId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): FinalizeInvoiceRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFinalizeInvoiceRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.invoiceId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): FinalizeInvoiceRequest {
    return { invoiceId: isSet(object.invoiceId) ? String(object.invoiceId) : "" };
  },

  toJSON(message: FinalizeInvoiceRequest): unknown {
    const obj: any = {};
    message.invoiceId !== undefined && (obj.invoiceId = message.invoiceId);
    return obj;
  },

  fromPartial(object: DeepPartial<FinalizeInvoiceRequest>): FinalizeInvoiceRequest {
    const message = createBaseFinalizeInvoiceRequest();
    message.invoiceId = object.invoiceId ?? "";
    return message;
  },
};

function createBaseFinalizeInvoiceResponse(): FinalizeInvoiceResponse {
  return {};
}

export const FinalizeInvoiceResponse = {
  encode(_: FinalizeInvoiceResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): FinalizeInvoiceResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFinalizeInvoiceResponse();
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

  fromJSON(_: any): FinalizeInvoiceResponse {
    return {};
  },

  toJSON(_: FinalizeInvoiceResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<FinalizeInvoiceResponse>): FinalizeInvoiceResponse {
    const message = createBaseFinalizeInvoiceResponse();
    return message;
  },
};

function createBaseSetBilledSessionRequest(): SetBilledSessionRequest {
  return { instanceId: "", from: undefined, system: System.SYSTEM_UNKNOWN };
}

export const SetBilledSessionRequest = {
  encode(message: SetBilledSessionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.instanceId !== "") {
      writer.uint32(10).string(message.instanceId);
    }
    if (message.from !== undefined) {
      Timestamp.encode(toTimestamp(message.from), writer.uint32(18).fork()).ldelim();
    }
    if (message.system !== System.SYSTEM_UNKNOWN) {
      writer.uint32(24).int32(systemToNumber(message.system));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetBilledSessionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetBilledSessionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.instanceId = reader.string();
          break;
        case 2:
          message.from = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 3:
          message.system = systemFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetBilledSessionRequest {
    return {
      instanceId: isSet(object.instanceId) ? String(object.instanceId) : "",
      from: isSet(object.from) ? fromJsonTimestamp(object.from) : undefined,
      system: isSet(object.system) ? systemFromJSON(object.system) : System.SYSTEM_UNKNOWN,
    };
  },

  toJSON(message: SetBilledSessionRequest): unknown {
    const obj: any = {};
    message.instanceId !== undefined && (obj.instanceId = message.instanceId);
    message.from !== undefined && (obj.from = message.from.toISOString());
    message.system !== undefined && (obj.system = systemToJSON(message.system));
    return obj;
  },

  fromPartial(object: DeepPartial<SetBilledSessionRequest>): SetBilledSessionRequest {
    const message = createBaseSetBilledSessionRequest();
    message.instanceId = object.instanceId ?? "";
    message.from = object.from ?? undefined;
    message.system = object.system ?? System.SYSTEM_UNKNOWN;
    return message;
  },
};

function createBaseSetBilledSessionResponse(): SetBilledSessionResponse {
  return {};
}

export const SetBilledSessionResponse = {
  encode(_: SetBilledSessionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetBilledSessionResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetBilledSessionResponse();
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

  fromJSON(_: any): SetBilledSessionResponse {
    return {};
  },

  toJSON(_: SetBilledSessionResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<SetBilledSessionResponse>): SetBilledSessionResponse {
    const message = createBaseSetBilledSessionResponse();
    return message;
  },
};

export type BillingServiceDefinition = typeof BillingServiceDefinition;
export const BillingServiceDefinition = {
  name: "BillingService",
  fullName: "usage.v1.BillingService",
  methods: {
    /**
     * ReconcileInvoices retrieves current credit balance and reflects it in billing system.
     * Internal RPC, not intended for general consumption.
     */
    reconcileInvoices: {
      name: "ReconcileInvoices",
      requestType: ReconcileInvoicesRequest,
      requestStream: false,
      responseType: ReconcileInvoicesResponse,
      responseStream: false,
      options: {},
    },
    /** GetUpcomingInvoice retrieves the latest invoice for a given query. */
    getUpcomingInvoice: {
      name: "GetUpcomingInvoice",
      requestType: GetUpcomingInvoiceRequest,
      requestStream: false,
      responseType: GetUpcomingInvoiceResponse,
      responseStream: false,
      options: {},
    },
    /**
     * FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
     * having been invoiced.
     */
    finalizeInvoice: {
      name: "FinalizeInvoice",
      requestType: FinalizeInvoiceRequest,
      requestStream: false,
      responseType: FinalizeInvoiceResponse,
      responseStream: false,
      options: {},
    },
    /** SetBilledSession marks an instance as billed with a billing system */
    setBilledSession: {
      name: "SetBilledSession",
      requestType: SetBilledSessionRequest,
      requestStream: false,
      responseType: SetBilledSessionResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface BillingServiceServiceImplementation<CallContextExt = {}> {
  /**
   * ReconcileInvoices retrieves current credit balance and reflects it in billing system.
   * Internal RPC, not intended for general consumption.
   */
  reconcileInvoices(
    request: ReconcileInvoicesRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ReconcileInvoicesResponse>>;
  /** GetUpcomingInvoice retrieves the latest invoice for a given query. */
  getUpcomingInvoice(
    request: GetUpcomingInvoiceRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetUpcomingInvoiceResponse>>;
  /**
   * FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
   * having been invoiced.
   */
  finalizeInvoice(
    request: FinalizeInvoiceRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<FinalizeInvoiceResponse>>;
  /** SetBilledSession marks an instance as billed with a billing system */
  setBilledSession(
    request: SetBilledSessionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<SetBilledSessionResponse>>;
}

export interface BillingServiceClient<CallOptionsExt = {}> {
  /**
   * ReconcileInvoices retrieves current credit balance and reflects it in billing system.
   * Internal RPC, not intended for general consumption.
   */
  reconcileInvoices(
    request: DeepPartial<ReconcileInvoicesRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ReconcileInvoicesResponse>;
  /** GetUpcomingInvoice retrieves the latest invoice for a given query. */
  getUpcomingInvoice(
    request: DeepPartial<GetUpcomingInvoiceRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetUpcomingInvoiceResponse>;
  /**
   * FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
   * having been invoiced.
   */
  finalizeInvoice(
    request: DeepPartial<FinalizeInvoiceRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<FinalizeInvoiceResponse>;
  /** SetBilledSession marks an instance as billed with a billing system */
  setBilledSession(
    request: DeepPartial<SetBilledSessionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<SetBilledSessionResponse>;
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
