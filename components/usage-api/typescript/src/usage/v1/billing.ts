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

export enum System {
  SYSTEM_UNKNOWN = 0,
  SYSTEM_CHARGEBEE = 1,
  SYSTEM_STRIPE = 2,
  UNRECOGNIZED = -1,
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

  fromPartial<I extends Exact<DeepPartial<ReconcileInvoicesRequest>, I>>(_: I): ReconcileInvoicesRequest {
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

  fromPartial<I extends Exact<DeepPartial<ReconcileInvoicesResponse>, I>>(_: I): ReconcileInvoicesResponse {
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

  fromPartial<I extends Exact<DeepPartial<GetUpcomingInvoiceRequest>, I>>(object: I): GetUpcomingInvoiceRequest {
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

  fromPartial<I extends Exact<DeepPartial<GetUpcomingInvoiceResponse>, I>>(object: I): GetUpcomingInvoiceResponse {
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

  fromPartial<I extends Exact<DeepPartial<FinalizeInvoiceRequest>, I>>(object: I): FinalizeInvoiceRequest {
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

  fromPartial<I extends Exact<DeepPartial<FinalizeInvoiceResponse>, I>>(_: I): FinalizeInvoiceResponse {
    const message = createBaseFinalizeInvoiceResponse();
    return message;
  },
};

function createBaseSetBilledSessionRequest(): SetBilledSessionRequest {
  return { instanceId: "", from: undefined, system: 0 };
}

export const SetBilledSessionRequest = {
  encode(message: SetBilledSessionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.instanceId !== "") {
      writer.uint32(10).string(message.instanceId);
    }
    if (message.from !== undefined) {
      Timestamp.encode(toTimestamp(message.from), writer.uint32(18).fork()).ldelim();
    }
    if (message.system !== 0) {
      writer.uint32(24).int32(message.system);
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
          message.system = reader.int32() as any;
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
      system: isSet(object.system) ? systemFromJSON(object.system) : 0,
    };
  },

  toJSON(message: SetBilledSessionRequest): unknown {
    const obj: any = {};
    message.instanceId !== undefined && (obj.instanceId = message.instanceId);
    message.from !== undefined && (obj.from = message.from.toISOString());
    message.system !== undefined && (obj.system = systemToJSON(message.system));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetBilledSessionRequest>, I>>(object: I): SetBilledSessionRequest {
    const message = createBaseSetBilledSessionRequest();
    message.instanceId = object.instanceId ?? "";
    message.from = object.from ?? undefined;
    message.system = object.system ?? 0;
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

  fromPartial<I extends Exact<DeepPartial<SetBilledSessionResponse>, I>>(_: I): SetBilledSessionResponse {
    const message = createBaseSetBilledSessionResponse();
    return message;
  },
};

export interface BillingService {
  /**
   * ReconcileInvoices retrieves current credit balance and reflects it in billing system.
   * Internal RPC, not intended for general consumption.
   */
  ReconcileInvoices(
    request: DeepPartial<ReconcileInvoicesRequest>,
    metadata?: grpc.Metadata,
  ): Promise<ReconcileInvoicesResponse>;
  /** GetUpcomingInvoice retrieves the latest invoice for a given query. */
  GetUpcomingInvoice(
    request: DeepPartial<GetUpcomingInvoiceRequest>,
    metadata?: grpc.Metadata,
  ): Promise<GetUpcomingInvoiceResponse>;
  /**
   * FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
   * having been invoiced.
   */
  FinalizeInvoice(
    request: DeepPartial<FinalizeInvoiceRequest>,
    metadata?: grpc.Metadata,
  ): Promise<FinalizeInvoiceResponse>;
  /** SetBilledSession marks an instance as billed with a billing system */
  SetBilledSession(
    request: DeepPartial<SetBilledSessionRequest>,
    metadata?: grpc.Metadata,
  ): Promise<SetBilledSessionResponse>;
}

export class BillingServiceClientImpl implements BillingService {
  private readonly rpc: Rpc;

  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.ReconcileInvoices = this.ReconcileInvoices.bind(this);
    this.GetUpcomingInvoice = this.GetUpcomingInvoice.bind(this);
    this.FinalizeInvoice = this.FinalizeInvoice.bind(this);
    this.SetBilledSession = this.SetBilledSession.bind(this);
  }

  ReconcileInvoices(
    request: DeepPartial<ReconcileInvoicesRequest>,
    metadata?: grpc.Metadata,
  ): Promise<ReconcileInvoicesResponse> {
    return this.rpc.unary(BillingServiceReconcileInvoicesDesc, ReconcileInvoicesRequest.fromPartial(request), metadata);
  }

  GetUpcomingInvoice(
    request: DeepPartial<GetUpcomingInvoiceRequest>,
    metadata?: grpc.Metadata,
  ): Promise<GetUpcomingInvoiceResponse> {
    return this.rpc.unary(
      BillingServiceGetUpcomingInvoiceDesc,
      GetUpcomingInvoiceRequest.fromPartial(request),
      metadata,
    );
  }

  FinalizeInvoice(
    request: DeepPartial<FinalizeInvoiceRequest>,
    metadata?: grpc.Metadata,
  ): Promise<FinalizeInvoiceResponse> {
    return this.rpc.unary(BillingServiceFinalizeInvoiceDesc, FinalizeInvoiceRequest.fromPartial(request), metadata);
  }

  SetBilledSession(
    request: DeepPartial<SetBilledSessionRequest>,
    metadata?: grpc.Metadata,
  ): Promise<SetBilledSessionResponse> {
    return this.rpc.unary(BillingServiceSetBilledSessionDesc, SetBilledSessionRequest.fromPartial(request), metadata);
  }
}

export const BillingServiceDesc = { serviceName: "usage.v1.BillingService" };

export const BillingServiceReconcileInvoicesDesc: UnaryMethodDefinitionish = {
  methodName: "ReconcileInvoices",
  service: BillingServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return ReconcileInvoicesRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...ReconcileInvoicesResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

export const BillingServiceGetUpcomingInvoiceDesc: UnaryMethodDefinitionish = {
  methodName: "GetUpcomingInvoice",
  service: BillingServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return GetUpcomingInvoiceRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...GetUpcomingInvoiceResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

export const BillingServiceFinalizeInvoiceDesc: UnaryMethodDefinitionish = {
  methodName: "FinalizeInvoice",
  service: BillingServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return FinalizeInvoiceRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...FinalizeInvoiceResponse.decode(data),
        toObject() {
          return this;
        },
      };
    },
  } as any,
};

export const BillingServiceSetBilledSessionDesc: UnaryMethodDefinitionish = {
  methodName: "SetBilledSession",
  service: BillingServiceDesc,
  requestStream: false,
  responseStream: false,
  requestType: {
    serializeBinary() {
      return SetBilledSessionRequest.encode(this).finish();
    },
  } as any,
  responseType: {
    deserializeBinary(data: Uint8Array) {
      return {
        ...SetBilledSessionResponse.decode(data),
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
