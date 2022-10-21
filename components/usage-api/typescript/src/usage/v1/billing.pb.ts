/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

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
  currency: string;
}

export interface CreateStripeCustomerRequest {
  attributionId: string;
  /** name is the customer name */
  name: string;
  email: string;
  currency: string;
}

export interface CreateStripeCustomerResponse {
  customer: StripeCustomer | undefined;
}

export interface CreateStripeSubscriptionRequest {
  attributionId: string;
  setupIntentId: string;
  usageLimit: number;
}

export interface CreateStripeSubscriptionResponse {
  subscription: StripeSubscription | undefined;
}

export interface StripeSubscription {
  id: string;
}

export interface GetStripeSubscriptionRequest {
  attributionId: string;
  status: string;
}

export interface GetStripeSubscriptionResponse {
  subscriptionId: string;
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
  return { id: "", currency: "" };
}

export const StripeCustomer = {
  encode(message: StripeCustomer, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.currency !== "") {
      writer.uint32(18).string(message.currency);
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
        case 2:
          message.currency = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): StripeCustomer {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      currency: isSet(object.currency) ? String(object.currency) : "",
    };
  },

  toJSON(message: StripeCustomer): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.currency !== undefined && (obj.currency = message.currency);
    return obj;
  },

  fromPartial(object: DeepPartial<StripeCustomer>): StripeCustomer {
    const message = createBaseStripeCustomer();
    message.id = object.id ?? "";
    message.currency = object.currency ?? "";
    return message;
  },
};

function createBaseCreateStripeCustomerRequest(): CreateStripeCustomerRequest {
  return { attributionId: "", name: "", email: "", currency: "" };
}

export const CreateStripeCustomerRequest = {
  encode(message: CreateStripeCustomerRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.name !== "") {
      writer.uint32(18).string(message.name);
    }
    if (message.email !== "") {
      writer.uint32(26).string(message.email);
    }
    if (message.currency !== "") {
      writer.uint32(34).string(message.currency);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateStripeCustomerRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeCustomerRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        case 2:
          message.name = reader.string();
          break;
        case 3:
          message.email = reader.string();
          break;
        case 4:
          message.currency = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateStripeCustomerRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      name: isSet(object.name) ? String(object.name) : "",
      email: isSet(object.email) ? String(object.email) : "",
      currency: isSet(object.currency) ? String(object.currency) : "",
    };
  },

  toJSON(message: CreateStripeCustomerRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.name !== undefined && (obj.name = message.name);
    message.email !== undefined && (obj.email = message.email);
    message.currency !== undefined && (obj.currency = message.currency);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateStripeCustomerRequest>): CreateStripeCustomerRequest {
    const message = createBaseCreateStripeCustomerRequest();
    message.attributionId = object.attributionId ?? "";
    message.name = object.name ?? "";
    message.email = object.email ?? "";
    message.currency = object.currency ?? "";
    return message;
  },
};

function createBaseCreateStripeCustomerResponse(): CreateStripeCustomerResponse {
  return { customer: undefined };
}

export const CreateStripeCustomerResponse = {
  encode(message: CreateStripeCustomerResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.customer !== undefined) {
      StripeCustomer.encode(message.customer, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateStripeCustomerResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeCustomerResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.customer = StripeCustomer.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateStripeCustomerResponse {
    return { customer: isSet(object.customer) ? StripeCustomer.fromJSON(object.customer) : undefined };
  },

  toJSON(message: CreateStripeCustomerResponse): unknown {
    const obj: any = {};
    message.customer !== undefined &&
      (obj.customer = message.customer ? StripeCustomer.toJSON(message.customer) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateStripeCustomerResponse>): CreateStripeCustomerResponse {
    const message = createBaseCreateStripeCustomerResponse();
    message.customer = (object.customer !== undefined && object.customer !== null)
      ? StripeCustomer.fromPartial(object.customer)
      : undefined;
    return message;
  },
};

function createBaseCreateStripeSubscriptionRequest(): CreateStripeSubscriptionRequest {
  return { attributionId: "", setupIntentId: "", usageLimit: 0 };
}

export const CreateStripeSubscriptionRequest = {
  encode(message: CreateStripeSubscriptionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.setupIntentId !== "") {
      writer.uint32(18).string(message.setupIntentId);
    }
    if (message.usageLimit !== 0) {
      writer.uint32(24).int64(message.usageLimit);
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
          message.setupIntentId = reader.string();
          break;
        case 3:
          message.usageLimit = longToNumber(reader.int64() as Long);
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
      setupIntentId: isSet(object.setupIntentId) ? String(object.setupIntentId) : "",
      usageLimit: isSet(object.usageLimit) ? Number(object.usageLimit) : 0,
    };
  },

  toJSON(message: CreateStripeSubscriptionRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.setupIntentId !== undefined && (obj.setupIntentId = message.setupIntentId);
    message.usageLimit !== undefined && (obj.usageLimit = Math.round(message.usageLimit));
    return obj;
  },

  fromPartial(object: DeepPartial<CreateStripeSubscriptionRequest>): CreateStripeSubscriptionRequest {
    const message = createBaseCreateStripeSubscriptionRequest();
    message.attributionId = object.attributionId ?? "";
    message.setupIntentId = object.setupIntentId ?? "";
    message.usageLimit = object.usageLimit ?? 0;
    return message;
  },
};

function createBaseCreateStripeSubscriptionResponse(): CreateStripeSubscriptionResponse {
  return { subscription: undefined };
}

export const CreateStripeSubscriptionResponse = {
  encode(message: CreateStripeSubscriptionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.subscription !== undefined) {
      StripeSubscription.encode(message.subscription, writer.uint32(10).fork()).ldelim();
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
          message.subscription = StripeSubscription.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateStripeSubscriptionResponse {
    return { subscription: isSet(object.subscription) ? StripeSubscription.fromJSON(object.subscription) : undefined };
  },

  toJSON(message: CreateStripeSubscriptionResponse): unknown {
    const obj: any = {};
    message.subscription !== undefined &&
      (obj.subscription = message.subscription ? StripeSubscription.toJSON(message.subscription) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<CreateStripeSubscriptionResponse>): CreateStripeSubscriptionResponse {
    const message = createBaseCreateStripeSubscriptionResponse();
    message.subscription = (object.subscription !== undefined && object.subscription !== null)
      ? StripeSubscription.fromPartial(object.subscription)
      : undefined;
    return message;
  },
};

function createBaseStripeSubscription(): StripeSubscription {
  return { id: "" };
}

export const StripeSubscription = {
  encode(message: StripeSubscription, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StripeSubscription {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStripeSubscription();
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

  fromJSON(object: any): StripeSubscription {
    return { id: isSet(object.id) ? String(object.id) : "" };
  },

  toJSON(message: StripeSubscription): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    return obj;
  },

  fromPartial(object: DeepPartial<StripeSubscription>): StripeSubscription {
    const message = createBaseStripeSubscription();
    message.id = object.id ?? "";
    return message;
  },
};

function createBaseGetStripeSubscriptionRequest(): GetStripeSubscriptionRequest {
  return { attributionId: "", status: "" };
}

export const GetStripeSubscriptionRequest = {
  encode(message: GetStripeSubscriptionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.status !== "") {
      writer.uint32(18).string(message.status);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetStripeSubscriptionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetStripeSubscriptionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.attributionId = reader.string();
          break;
        case 2:
          message.status = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetStripeSubscriptionRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      status: isSet(object.status) ? String(object.status) : "",
    };
  },

  toJSON(message: GetStripeSubscriptionRequest): unknown {
    const obj: any = {};
    message.attributionId !== undefined && (obj.attributionId = message.attributionId);
    message.status !== undefined && (obj.status = message.status);
    return obj;
  },

  fromPartial(object: DeepPartial<GetStripeSubscriptionRequest>): GetStripeSubscriptionRequest {
    const message = createBaseGetStripeSubscriptionRequest();
    message.attributionId = object.attributionId ?? "";
    message.status = object.status ?? "";
    return message;
  },
};

function createBaseGetStripeSubscriptionResponse(): GetStripeSubscriptionResponse {
  return { subscriptionId: "" };
}

export const GetStripeSubscriptionResponse = {
  encode(message: GetStripeSubscriptionResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.subscriptionId !== "") {
      writer.uint32(10).string(message.subscriptionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetStripeSubscriptionResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetStripeSubscriptionResponse();
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

  fromJSON(object: any): GetStripeSubscriptionResponse {
    return { subscriptionId: isSet(object.subscriptionId) ? String(object.subscriptionId) : "" };
  },

  toJSON(message: GetStripeSubscriptionResponse): unknown {
    const obj: any = {};
    message.subscriptionId !== undefined && (obj.subscriptionId = message.subscriptionId);
    return obj;
  },

  fromPartial(object: DeepPartial<GetStripeSubscriptionResponse>): GetStripeSubscriptionResponse {
    const message = createBaseGetStripeSubscriptionResponse();
    message.subscriptionId = object.subscriptionId ?? "";
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
    createStripeCustomer: {
      name: "CreateStripeCustomer",
      requestType: CreateStripeCustomerRequest,
      requestStream: false,
      responseType: CreateStripeCustomerResponse,
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
     * GetStripeSubscription without passing in the `status` will return uncancelled subscriptions
     * Stripe returns a list which may include more than one, but we will throw an error in that case
     */
    getStripeSubscription: {
      name: "GetStripeSubscription",
      requestType: GetStripeSubscriptionRequest,
      requestStream: false,
      responseType: GetStripeSubscriptionResponse,
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
  createStripeCustomer(
    request: CreateStripeCustomerRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateStripeCustomerResponse>>;
  createStripeSubscription(
    request: CreateStripeSubscriptionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateStripeSubscriptionResponse>>;
  /**
   * GetStripeSubscription without passing in the `status` will return uncancelled subscriptions
   * Stripe returns a list which may include more than one, but we will throw an error in that case
   */
  getStripeSubscription(
    request: GetStripeSubscriptionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetStripeSubscriptionResponse>>;
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
  createStripeCustomer(
    request: DeepPartial<CreateStripeCustomerRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateStripeCustomerResponse>;
  createStripeSubscription(
    request: DeepPartial<CreateStripeSubscriptionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateStripeSubscriptionResponse>;
  /**
   * GetStripeSubscription without passing in the `status` will return uncancelled subscriptions
   * Stripe returns a list which may include more than one, but we will throw an error in that case
   */
  getStripeSubscription(
    request: DeepPartial<GetStripeSubscriptionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetStripeSubscriptionResponse>;
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
