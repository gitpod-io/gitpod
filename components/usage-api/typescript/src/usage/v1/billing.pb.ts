/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { CostCenter } from "./usage.pb";

export const protobufPackage = "usage.v1";

export interface ReconcileInvoicesRequest {
}

export interface ReconcileInvoicesResponse {
}

export interface FinalizeInvoiceRequest {
  invoiceId: string;
}

export interface FinalizeInvoiceResponse {
}

export interface CreateStripeSubscriptionRequest {
  attributionId: string;
  stripeIntentId: string;
  usageLimit: number;
}

export interface CreateStripeSubscriptionResponse {
  customer: StripeCustomer | undefined;
  costCenter: CostCenter | undefined;
}

export interface CancelSubscriptionRequest {
  subscriptionId: string;
}

export interface CancelSubscriptionResponse {
}

export interface GetStripeCustomerRequest {
  attributionId: string | undefined;
  stripeCustomerId: string | undefined;
}

export interface GetStripeCustomerResponse {
  customer: StripeCustomer | undefined;
  attributionId: string;
}

export interface StripeCustomer {
  id: string;
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

function createBaseCreateStripeSubscriptionRequest(): CreateStripeSubscriptionRequest {
  return { attributionId: "", stripeIntentId: "", usageLimit: 0 };
}

export const CreateStripeSubscriptionRequest = {
  encode(message: CreateStripeSubscriptionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.stripeIntentId !== "") {
      writer.uint32(18).string(message.stripeIntentId);
    }
    if (message.usageLimit !== 0) {
      writer.uint32(24).int32(message.usageLimit);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateStripeSubscriptionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeSubscriptionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        case 2:
          message.stripeIntentId = reader.string();
          break;
        case 3:
          message.usageLimit = reader.int32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateStripeSubscriptionRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      stripeIntentId: isSet(object.stripeIntentId) ? String(object.stripeIntentId) : "",
      usageLimit: isSet(object.usageLimit) ? Number(object.usageLimit) : 0,
    };
  },

  toJSON(message: CreateStripeSubscriptionRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.stripeIntentId !== undefined && (obj.stripeIntentId = message.stripeIntentId);
    message.usageLimit !== undefined && (obj.usageLimit = Math.round(message.usageLimit));
    return obj;
  },

  fromPartial(object: DeepPartial<CreateStripeSubscriptionRequest>): CreateStripeSubscriptionRequest {
    const message = createBaseCreateStripeSubscriptionRequest();
    message.attributionId = object.attributionId ?? "";
    message.stripeIntentId = object.stripeIntentId ?? "";
    message.usageLimit = object.usageLimit ?? 0;
    return message;
  },
};

function createBaseCreateStripeSubscriptionResponse(): CreateStripeSubscriptionResponse {
  return { customer: undefined, costCenter: undefined };
}

export const CreateStripeSubscriptionResponse = {
  encode(message: CreateStripeSubscriptionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.customer !== undefined) {
      StripeCustomer.encode(message.customer, writer.uint32(10).fork()).ldelim();
    }
    if (message.costCenter !== undefined) {
      CostCenter.encode(message.costCenter, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateStripeSubscriptionResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeSubscriptionResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.customer = StripeCustomer.decode(reader, reader.uint32());
          break;
        case 2:
          message.costCenter = CostCenter.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateStripeSubscriptionResponse {
    return {
      customer: isSet(object.customer) ? StripeCustomer.fromJSON(object.customer) : undefined,
      costCenter: isSet(object.costCenter) ? CostCenter.fromJSON(object.costCenter) : undefined,
    };
  },

  toJSON(message: CreateStripeSubscriptionResponse): unknown {
    const obj: any = {};
    message.customer !== undefined &&
      (obj.customer = message.customer ? StripeCustomer.toJSON(message.customer) : undefined);
    message.costCenter !== undefined &&
      (obj.costCenter = message.costCenter ? CostCenter.toJSON(message.costCenter) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateStripeSubscriptionResponse>): CreateStripeSubscriptionResponse {
    const message = createBaseCreateStripeSubscriptionResponse();
    message.customer = (object.customer !== undefined && object.customer !== null)
      ? StripeCustomer.fromPartial(object.customer)
      : undefined;
    message.costCenter = (object.costCenter !== undefined && object.costCenter !== null)
      ? CostCenter.fromPartial(object.costCenter)
      : undefined;
    return message;
  },
};

function createBaseCancelSubscriptionRequest(): CancelSubscriptionRequest {
  return { subscriptionId: "" };
}

export const CancelSubscriptionRequest = {
  encode(message: CancelSubscriptionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.subscriptionId !== "") {
      writer.uint32(10).string(message.subscriptionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CancelSubscriptionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCancelSubscriptionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.subscriptionId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CancelSubscriptionRequest {
    return { subscriptionId: isSet(object.subscriptionId) ? String(object.subscriptionId) : "" };
  },

  toJSON(message: CancelSubscriptionRequest): unknown {
    const obj: any = {};
    message.subscriptionId !== undefined && (obj.subscriptionId = message.subscriptionId);
    return obj;
  },

  fromPartial(object: DeepPartial<CancelSubscriptionRequest>): CancelSubscriptionRequest {
    const message = createBaseCancelSubscriptionRequest();
    message.subscriptionId = object.subscriptionId ?? "";
    return message;
  },
};

function createBaseCancelSubscriptionResponse(): CancelSubscriptionResponse {
  return {};
}

export const CancelSubscriptionResponse = {
  encode(_: CancelSubscriptionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CancelSubscriptionResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCancelSubscriptionResponse();
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

  fromJSON(_: any): CancelSubscriptionResponse {
    return {};
  },

  toJSON(_: CancelSubscriptionResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<CancelSubscriptionResponse>): CancelSubscriptionResponse {
    const message = createBaseCancelSubscriptionResponse();
    return message;
  },
};

function createBaseGetStripeCustomerRequest(): GetStripeCustomerRequest {
  return { attributionId: undefined, stripeCustomerId: undefined };
}

export const GetStripeCustomerRequest = {
  encode(message: GetStripeCustomerRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== undefined) {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.stripeCustomerId !== undefined) {
      writer.uint32(18).string(message.stripeCustomerId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetStripeCustomerRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetStripeCustomerRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        case 2:
          message.stripeCustomerId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetStripeCustomerRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : undefined,
      stripeCustomerId: isSet(object.stripeCustomerId) ? String(object.stripeCustomerId) : undefined,
    };
  },

  toJSON(message: GetStripeCustomerRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.stripeCustomerId !== undefined && (obj.stripeCustomerId = message.stripeCustomerId);
    return obj;
  },

  fromPartial(object: DeepPartial<GetStripeCustomerRequest>): GetStripeCustomerRequest {
    const message = createBaseGetStripeCustomerRequest();
    message.attributionId = object.attributionId ?? undefined;
    message.stripeCustomerId = object.stripeCustomerId ?? undefined;
    return message;
  },
};

function createBaseGetStripeCustomerResponse(): GetStripeCustomerResponse {
  return { customer: undefined, attributionId: "" };
}

export const GetStripeCustomerResponse = {
  encode(message: GetStripeCustomerResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.customer !== undefined) {
      StripeCustomer.encode(message.customer, writer.uint32(10).fork()).ldelim();
    }
    if (message.attributionId !== "") {
      writer.uint32(18).string(message.attributionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetStripeCustomerResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetStripeCustomerResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.customer = StripeCustomer.decode(reader, reader.uint32());
          break;
        case 2:
          message.attributionId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetStripeCustomerResponse {
    return {
      customer: isSet(object.customer) ? StripeCustomer.fromJSON(object.customer) : undefined,
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
    };
  },

  toJSON(message: GetStripeCustomerResponse): unknown {
    const obj: any = {};
    message.customer !== undefined &&
      (obj.customer = message.customer ? StripeCustomer.toJSON(message.customer) : undefined);
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    return obj;
  },

  fromPartial(object: DeepPartial<GetStripeCustomerResponse>): GetStripeCustomerResponse {
    const message = createBaseGetStripeCustomerResponse();
    message.customer = (object.customer !== undefined && object.customer !== null)
      ? StripeCustomer.fromPartial(object.customer)
      : undefined;
    message.attributionId = object.attributionId ?? "";
    return message;
  },
};

function createBaseStripeCustomer(): StripeCustomer {
  return { id: "" };
}

export const StripeCustomer = {
  encode(message: StripeCustomer, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StripeCustomer {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStripeCustomer();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): StripeCustomer {
    return { id: isSet(object.id) ? String(object.id) : "" };
  },

  toJSON(message: StripeCustomer): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    return obj;
  },

  fromPartial(object: DeepPartial<StripeCustomer>): StripeCustomer {
    const message = createBaseStripeCustomer();
    message.id = object.id ?? "";
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
    createStripeSubscription: {
      name: "CreateStripeSubscription",
      requestType: CreateStripeSubscriptionRequest,
      requestStream: false,
      responseType: CreateStripeSubscriptionResponse,
      responseStream: false,
      options: {},
    },
    /**
     * CancelSubscription cancels a stripe subscription in our system
     * Called by a stripe webhook
     */
    cancelSubscription: {
      name: "CancelSubscription",
      requestType: CancelSubscriptionRequest,
      requestStream: false,
      responseType: CancelSubscriptionResponse,
      responseStream: false,
      options: {},
    },
    /** GetStripeCustomer retrieves a Stripe Customer */
    getStripeCustomer: {
      name: "GetStripeCustomer",
      requestType: GetStripeCustomerRequest,
      requestStream: false,
      responseType: GetStripeCustomerResponse,
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
  /**
   * FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
   * having been invoiced.
   */
  finalizeInvoice(
    request: FinalizeInvoiceRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<FinalizeInvoiceResponse>>;
  createStripeSubscription(
    request: CreateStripeSubscriptionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateStripeSubscriptionResponse>>;
  /**
   * CancelSubscription cancels a stripe subscription in our system
   * Called by a stripe webhook
   */
  cancelSubscription(
    request: CancelSubscriptionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CancelSubscriptionResponse>>;
  /** GetStripeCustomer retrieves a Stripe Customer */
  getStripeCustomer(
    request: GetStripeCustomerRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetStripeCustomerResponse>>;
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
  /**
   * FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
   * having been invoiced.
   */
  finalizeInvoice(
    request: DeepPartial<FinalizeInvoiceRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<FinalizeInvoiceResponse>;
  createStripeSubscription(
    request: DeepPartial<CreateStripeSubscriptionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateStripeSubscriptionResponse>;
  /**
   * CancelSubscription cancels a stripe subscription in our system
   * Called by a stripe webhook
   */
  cancelSubscription(
    request: DeepPartial<CancelSubscriptionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CancelSubscriptionResponse>;
  /** GetStripeCustomer retrieves a Stripe Customer */
  getStripeCustomer(
    request: DeepPartial<GetStripeCustomerRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetStripeCustomerResponse>;
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
