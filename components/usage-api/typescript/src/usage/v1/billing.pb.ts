/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import Long = require("long");

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
  attributionId?: string | undefined;
  stripeCustomerId?: string | undefined;
}

export interface GetStripeCustomerResponse {
  customer: StripeCustomer | undefined;
  attributionId: string;
}

export interface StripeCustomer {
  id: string;
  currency: string;
  invalidBillingAddress: boolean;
}

export interface CreateStripeCustomerRequest {
  attributionId: string;
  /** name is the customer name */
  name: string;
  email: string;
  currency: string;
  /** Gitpod User ID for the user setting up billing. */
  billingCreatorUserId: string;
}

export interface CreateStripeCustomerResponse {
  customer: StripeCustomer | undefined;
}

export interface CreateHoldPaymentIntentRequest {
  attributionId: string;
}

export interface CreateHoldPaymentIntentResponse {
  paymentIntentId: string;
  paymentIntentClientSecret: string;
}

export interface CreateStripeSubscriptionRequest {
  attributionId: string;
  usageLimit: number;
  paymentIntentId: string;
}

export interface CreateStripeSubscriptionResponse {
  subscription: StripeSubscription | undefined;
}

export interface StripeSubscription {
  id: string;
}

export interface UpdateCustomerSubscriptionsTaxStateRequest {
  customerId: string;
}

export interface UpdateCustomerSubscriptionsTaxStateResponse {
}

export interface GetPriceInformationRequest {
  attributionId: string;
}

export interface GetPriceInformationResponse {
  humanReadableDescription: string;
}

export interface OnChargeDisputeRequest {
  disputeId: string;
}

export interface OnChargeDisputeResponse {
}

function createBaseReconcileInvoicesRequest(): ReconcileInvoicesRequest {
  return {};
}

export const ReconcileInvoicesRequest = {
  encode(_: ReconcileInvoicesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReconcileInvoicesRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileInvoicesRequest();
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

  fromJSON(_: any): ReconcileInvoicesRequest {
    return {};
  },

  toJSON(_: ReconcileInvoicesRequest): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<ReconcileInvoicesRequest>): ReconcileInvoicesRequest {
    return ReconcileInvoicesRequest.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReconcileInvoicesResponse();
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

  fromJSON(_: any): ReconcileInvoicesResponse {
    return {};
  },

  toJSON(_: ReconcileInvoicesResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<ReconcileInvoicesResponse>): ReconcileInvoicesResponse {
    return ReconcileInvoicesResponse.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFinalizeInvoiceRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.invoiceId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): FinalizeInvoiceRequest {
    return { invoiceId: isSet(object.invoiceId) ? String(object.invoiceId) : "" };
  },

  toJSON(message: FinalizeInvoiceRequest): unknown {
    const obj: any = {};
    if (message.invoiceId !== "") {
      obj.invoiceId = message.invoiceId;
    }
    return obj;
  },

  create(base?: DeepPartial<FinalizeInvoiceRequest>): FinalizeInvoiceRequest {
    return FinalizeInvoiceRequest.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFinalizeInvoiceResponse();
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

  fromJSON(_: any): FinalizeInvoiceResponse {
    return {};
  },

  toJSON(_: FinalizeInvoiceResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<FinalizeInvoiceResponse>): FinalizeInvoiceResponse {
    return FinalizeInvoiceResponse.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCancelSubscriptionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.subscriptionId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CancelSubscriptionRequest {
    return { subscriptionId: isSet(object.subscriptionId) ? String(object.subscriptionId) : "" };
  },

  toJSON(message: CancelSubscriptionRequest): unknown {
    const obj: any = {};
    if (message.subscriptionId !== "") {
      obj.subscriptionId = message.subscriptionId;
    }
    return obj;
  },

  create(base?: DeepPartial<CancelSubscriptionRequest>): CancelSubscriptionRequest {
    return CancelSubscriptionRequest.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCancelSubscriptionResponse();
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

  fromJSON(_: any): CancelSubscriptionResponse {
    return {};
  },

  toJSON(_: CancelSubscriptionResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<CancelSubscriptionResponse>): CancelSubscriptionResponse {
    return CancelSubscriptionResponse.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetStripeCustomerRequest();
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
          if (tag !== 18) {
            break;
          }

          message.stripeCustomerId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
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
    if (message.attributionId !== undefined) {
      obj.attributionId = message.attributionId;
    }
    if (message.stripeCustomerId !== undefined) {
      obj.stripeCustomerId = message.stripeCustomerId;
    }
    return obj;
  },

  create(base?: DeepPartial<GetStripeCustomerRequest>): GetStripeCustomerRequest {
    return GetStripeCustomerRequest.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetStripeCustomerResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.customer = StripeCustomer.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
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

  fromJSON(object: any): GetStripeCustomerResponse {
    return {
      customer: isSet(object.customer) ? StripeCustomer.fromJSON(object.customer) : undefined,
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
    };
  },

  toJSON(message: GetStripeCustomerResponse): unknown {
    const obj: any = {};
    if (message.customer !== undefined) {
      obj.customer = StripeCustomer.toJSON(message.customer);
    }
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    return obj;
  },

  create(base?: DeepPartial<GetStripeCustomerResponse>): GetStripeCustomerResponse {
    return GetStripeCustomerResponse.fromPartial(base ?? {});
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
  return { id: "", currency: "", invalidBillingAddress: false };
}

export const StripeCustomer = {
  encode(message: StripeCustomer, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.currency !== "") {
      writer.uint32(18).string(message.currency);
    }
    if (message.invalidBillingAddress === true) {
      writer.uint32(24).bool(message.invalidBillingAddress);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StripeCustomer {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStripeCustomer();
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

          message.currency = reader.string();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.invalidBillingAddress = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): StripeCustomer {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      currency: isSet(object.currency) ? String(object.currency) : "",
      invalidBillingAddress: isSet(object.invalidBillingAddress) ? Boolean(object.invalidBillingAddress) : false,
    };
  },

  toJSON(message: StripeCustomer): unknown {
    const obj: any = {};
    if (message.id !== "") {
      obj.id = message.id;
    }
    if (message.currency !== "") {
      obj.currency = message.currency;
    }
    if (message.invalidBillingAddress === true) {
      obj.invalidBillingAddress = message.invalidBillingAddress;
    }
    return obj;
  },

  create(base?: DeepPartial<StripeCustomer>): StripeCustomer {
    return StripeCustomer.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<StripeCustomer>): StripeCustomer {
    const message = createBaseStripeCustomer();
    message.id = object.id ?? "";
    message.currency = object.currency ?? "";
    message.invalidBillingAddress = object.invalidBillingAddress ?? false;
    return message;
  },
};

function createBaseCreateStripeCustomerRequest(): CreateStripeCustomerRequest {
  return { attributionId: "", name: "", email: "", currency: "", billingCreatorUserId: "" };
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
    if (message.billingCreatorUserId !== "") {
      writer.uint32(42).string(message.billingCreatorUserId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateStripeCustomerRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeCustomerRequest();
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
          if (tag !== 18) {
            break;
          }

          message.name = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.email = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.currency = reader.string();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.billingCreatorUserId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CreateStripeCustomerRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      name: isSet(object.name) ? String(object.name) : "",
      email: isSet(object.email) ? String(object.email) : "",
      currency: isSet(object.currency) ? String(object.currency) : "",
      billingCreatorUserId: isSet(object.billingCreatorUserId) ? String(object.billingCreatorUserId) : "",
    };
  },

  toJSON(message: CreateStripeCustomerRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    if (message.name !== "") {
      obj.name = message.name;
    }
    if (message.email !== "") {
      obj.email = message.email;
    }
    if (message.currency !== "") {
      obj.currency = message.currency;
    }
    if (message.billingCreatorUserId !== "") {
      obj.billingCreatorUserId = message.billingCreatorUserId;
    }
    return obj;
  },

  create(base?: DeepPartial<CreateStripeCustomerRequest>): CreateStripeCustomerRequest {
    return CreateStripeCustomerRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<CreateStripeCustomerRequest>): CreateStripeCustomerRequest {
    const message = createBaseCreateStripeCustomerRequest();
    message.attributionId = object.attributionId ?? "";
    message.name = object.name ?? "";
    message.email = object.email ?? "";
    message.currency = object.currency ?? "";
    message.billingCreatorUserId = object.billingCreatorUserId ?? "";
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeCustomerResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.customer = StripeCustomer.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CreateStripeCustomerResponse {
    return { customer: isSet(object.customer) ? StripeCustomer.fromJSON(object.customer) : undefined };
  },

  toJSON(message: CreateStripeCustomerResponse): unknown {
    const obj: any = {};
    if (message.customer !== undefined) {
      obj.customer = StripeCustomer.toJSON(message.customer);
    }
    return obj;
  },

  create(base?: DeepPartial<CreateStripeCustomerResponse>): CreateStripeCustomerResponse {
    return CreateStripeCustomerResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<CreateStripeCustomerResponse>): CreateStripeCustomerResponse {
    const message = createBaseCreateStripeCustomerResponse();
    message.customer = (object.customer !== undefined && object.customer !== null)
      ? StripeCustomer.fromPartial(object.customer)
      : undefined;
    return message;
  },
};

function createBaseCreateHoldPaymentIntentRequest(): CreateHoldPaymentIntentRequest {
  return { attributionId: "" };
}

export const CreateHoldPaymentIntentRequest = {
  encode(message: CreateHoldPaymentIntentRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateHoldPaymentIntentRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateHoldPaymentIntentRequest();
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

  fromJSON(object: any): CreateHoldPaymentIntentRequest {
    return { attributionId: isSet(object.attributionId) ? String(object.attributionId) : "" };
  },

  toJSON(message: CreateHoldPaymentIntentRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    return obj;
  },

  create(base?: DeepPartial<CreateHoldPaymentIntentRequest>): CreateHoldPaymentIntentRequest {
    return CreateHoldPaymentIntentRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<CreateHoldPaymentIntentRequest>): CreateHoldPaymentIntentRequest {
    const message = createBaseCreateHoldPaymentIntentRequest();
    message.attributionId = object.attributionId ?? "";
    return message;
  },
};

function createBaseCreateHoldPaymentIntentResponse(): CreateHoldPaymentIntentResponse {
  return { paymentIntentId: "", paymentIntentClientSecret: "" };
}

export const CreateHoldPaymentIntentResponse = {
  encode(message: CreateHoldPaymentIntentResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.paymentIntentId !== "") {
      writer.uint32(10).string(message.paymentIntentId);
    }
    if (message.paymentIntentClientSecret !== "") {
      writer.uint32(18).string(message.paymentIntentClientSecret);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateHoldPaymentIntentResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateHoldPaymentIntentResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.paymentIntentId = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.paymentIntentClientSecret = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CreateHoldPaymentIntentResponse {
    return {
      paymentIntentId: isSet(object.paymentIntentId) ? String(object.paymentIntentId) : "",
      paymentIntentClientSecret: isSet(object.paymentIntentClientSecret)
        ? String(object.paymentIntentClientSecret)
        : "",
    };
  },

  toJSON(message: CreateHoldPaymentIntentResponse): unknown {
    const obj: any = {};
    if (message.paymentIntentId !== "") {
      obj.paymentIntentId = message.paymentIntentId;
    }
    if (message.paymentIntentClientSecret !== "") {
      obj.paymentIntentClientSecret = message.paymentIntentClientSecret;
    }
    return obj;
  },

  create(base?: DeepPartial<CreateHoldPaymentIntentResponse>): CreateHoldPaymentIntentResponse {
    return CreateHoldPaymentIntentResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<CreateHoldPaymentIntentResponse>): CreateHoldPaymentIntentResponse {
    const message = createBaseCreateHoldPaymentIntentResponse();
    message.paymentIntentId = object.paymentIntentId ?? "";
    message.paymentIntentClientSecret = object.paymentIntentClientSecret ?? "";
    return message;
  },
};

function createBaseCreateStripeSubscriptionRequest(): CreateStripeSubscriptionRequest {
  return { attributionId: "", usageLimit: 0, paymentIntentId: "" };
}

export const CreateStripeSubscriptionRequest = {
  encode(message: CreateStripeSubscriptionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    if (message.usageLimit !== 0) {
      writer.uint32(24).int64(message.usageLimit);
    }
    if (message.paymentIntentId !== "") {
      writer.uint32(34).string(message.paymentIntentId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateStripeSubscriptionRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeSubscriptionRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.attributionId = reader.string();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.usageLimit = longToNumber(reader.int64() as Long);
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.paymentIntentId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CreateStripeSubscriptionRequest {
    return {
      attributionId: isSet(object.attributionId) ? String(object.attributionId) : "",
      usageLimit: isSet(object.usageLimit) ? Number(object.usageLimit) : 0,
      paymentIntentId: isSet(object.paymentIntentId) ? String(object.paymentIntentId) : "",
    };
  },

  toJSON(message: CreateStripeSubscriptionRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    if (message.usageLimit !== 0) {
      obj.usageLimit = Math.round(message.usageLimit);
    }
    if (message.paymentIntentId !== "") {
      obj.paymentIntentId = message.paymentIntentId;
    }
    return obj;
  },

  create(base?: DeepPartial<CreateStripeSubscriptionRequest>): CreateStripeSubscriptionRequest {
    return CreateStripeSubscriptionRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<CreateStripeSubscriptionRequest>): CreateStripeSubscriptionRequest {
    const message = createBaseCreateStripeSubscriptionRequest();
    message.attributionId = object.attributionId ?? "";
    message.usageLimit = object.usageLimit ?? 0;
    message.paymentIntentId = object.paymentIntentId ?? "";
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateStripeSubscriptionResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.subscription = StripeSubscription.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): CreateStripeSubscriptionResponse {
    return { subscription: isSet(object.subscription) ? StripeSubscription.fromJSON(object.subscription) : undefined };
  },

  toJSON(message: CreateStripeSubscriptionResponse): unknown {
    const obj: any = {};
    if (message.subscription !== undefined) {
      obj.subscription = StripeSubscription.toJSON(message.subscription);
    }
    return obj;
  },

  create(base?: DeepPartial<CreateStripeSubscriptionResponse>): CreateStripeSubscriptionResponse {
    return CreateStripeSubscriptionResponse.fromPartial(base ?? {});
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
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStripeSubscription();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.id = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): StripeSubscription {
    return { id: isSet(object.id) ? String(object.id) : "" };
  },

  toJSON(message: StripeSubscription): unknown {
    const obj: any = {};
    if (message.id !== "") {
      obj.id = message.id;
    }
    return obj;
  },

  create(base?: DeepPartial<StripeSubscription>): StripeSubscription {
    return StripeSubscription.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<StripeSubscription>): StripeSubscription {
    const message = createBaseStripeSubscription();
    message.id = object.id ?? "";
    return message;
  },
};

function createBaseUpdateCustomerSubscriptionsTaxStateRequest(): UpdateCustomerSubscriptionsTaxStateRequest {
  return { customerId: "" };
}

export const UpdateCustomerSubscriptionsTaxStateRequest = {
  encode(message: UpdateCustomerSubscriptionsTaxStateRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.customerId !== "") {
      writer.uint32(10).string(message.customerId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateCustomerSubscriptionsTaxStateRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateCustomerSubscriptionsTaxStateRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.customerId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): UpdateCustomerSubscriptionsTaxStateRequest {
    return { customerId: isSet(object.customerId) ? String(object.customerId) : "" };
  },

  toJSON(message: UpdateCustomerSubscriptionsTaxStateRequest): unknown {
    const obj: any = {};
    if (message.customerId !== "") {
      obj.customerId = message.customerId;
    }
    return obj;
  },

  create(base?: DeepPartial<UpdateCustomerSubscriptionsTaxStateRequest>): UpdateCustomerSubscriptionsTaxStateRequest {
    return UpdateCustomerSubscriptionsTaxStateRequest.fromPartial(base ?? {});
  },
  fromPartial(
    object: DeepPartial<UpdateCustomerSubscriptionsTaxStateRequest>,
  ): UpdateCustomerSubscriptionsTaxStateRequest {
    const message = createBaseUpdateCustomerSubscriptionsTaxStateRequest();
    message.customerId = object.customerId ?? "";
    return message;
  },
};

function createBaseUpdateCustomerSubscriptionsTaxStateResponse(): UpdateCustomerSubscriptionsTaxStateResponse {
  return {};
}

export const UpdateCustomerSubscriptionsTaxStateResponse = {
  encode(_: UpdateCustomerSubscriptionsTaxStateResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateCustomerSubscriptionsTaxStateResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateCustomerSubscriptionsTaxStateResponse();
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

  fromJSON(_: any): UpdateCustomerSubscriptionsTaxStateResponse {
    return {};
  },

  toJSON(_: UpdateCustomerSubscriptionsTaxStateResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<UpdateCustomerSubscriptionsTaxStateResponse>): UpdateCustomerSubscriptionsTaxStateResponse {
    return UpdateCustomerSubscriptionsTaxStateResponse.fromPartial(base ?? {});
  },
  fromPartial(
    _: DeepPartial<UpdateCustomerSubscriptionsTaxStateResponse>,
  ): UpdateCustomerSubscriptionsTaxStateResponse {
    const message = createBaseUpdateCustomerSubscriptionsTaxStateResponse();
    return message;
  },
};

function createBaseGetPriceInformationRequest(): GetPriceInformationRequest {
  return { attributionId: "" };
}

export const GetPriceInformationRequest = {
  encode(message: GetPriceInformationRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.attributionId !== "") {
      writer.uint32(10).string(message.attributionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetPriceInformationRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetPriceInformationRequest();
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

  fromJSON(object: any): GetPriceInformationRequest {
    return { attributionId: isSet(object.attributionId) ? String(object.attributionId) : "" };
  },

  toJSON(message: GetPriceInformationRequest): unknown {
    const obj: any = {};
    if (message.attributionId !== "") {
      obj.attributionId = message.attributionId;
    }
    return obj;
  },

  create(base?: DeepPartial<GetPriceInformationRequest>): GetPriceInformationRequest {
    return GetPriceInformationRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<GetPriceInformationRequest>): GetPriceInformationRequest {
    const message = createBaseGetPriceInformationRequest();
    message.attributionId = object.attributionId ?? "";
    return message;
  },
};

function createBaseGetPriceInformationResponse(): GetPriceInformationResponse {
  return { humanReadableDescription: "" };
}

export const GetPriceInformationResponse = {
  encode(message: GetPriceInformationResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.humanReadableDescription !== "") {
      writer.uint32(18).string(message.humanReadableDescription);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetPriceInformationResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetPriceInformationResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          if (tag !== 18) {
            break;
          }

          message.humanReadableDescription = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): GetPriceInformationResponse {
    return {
      humanReadableDescription: isSet(object.humanReadableDescription) ? String(object.humanReadableDescription) : "",
    };
  },

  toJSON(message: GetPriceInformationResponse): unknown {
    const obj: any = {};
    if (message.humanReadableDescription !== "") {
      obj.humanReadableDescription = message.humanReadableDescription;
    }
    return obj;
  },

  create(base?: DeepPartial<GetPriceInformationResponse>): GetPriceInformationResponse {
    return GetPriceInformationResponse.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<GetPriceInformationResponse>): GetPriceInformationResponse {
    const message = createBaseGetPriceInformationResponse();
    message.humanReadableDescription = object.humanReadableDescription ?? "";
    return message;
  },
};

function createBaseOnChargeDisputeRequest(): OnChargeDisputeRequest {
  return { disputeId: "" };
}

export const OnChargeDisputeRequest = {
  encode(message: OnChargeDisputeRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.disputeId !== "") {
      writer.uint32(10).string(message.disputeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OnChargeDisputeRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOnChargeDisputeRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.disputeId = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): OnChargeDisputeRequest {
    return { disputeId: isSet(object.disputeId) ? String(object.disputeId) : "" };
  },

  toJSON(message: OnChargeDisputeRequest): unknown {
    const obj: any = {};
    if (message.disputeId !== "") {
      obj.disputeId = message.disputeId;
    }
    return obj;
  },

  create(base?: DeepPartial<OnChargeDisputeRequest>): OnChargeDisputeRequest {
    return OnChargeDisputeRequest.fromPartial(base ?? {});
  },
  fromPartial(object: DeepPartial<OnChargeDisputeRequest>): OnChargeDisputeRequest {
    const message = createBaseOnChargeDisputeRequest();
    message.disputeId = object.disputeId ?? "";
    return message;
  },
};

function createBaseOnChargeDisputeResponse(): OnChargeDisputeResponse {
  return {};
}

export const OnChargeDisputeResponse = {
  encode(_: OnChargeDisputeResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OnChargeDisputeResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOnChargeDisputeResponse();
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

  fromJSON(_: any): OnChargeDisputeResponse {
    return {};
  },

  toJSON(_: OnChargeDisputeResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<OnChargeDisputeResponse>): OnChargeDisputeResponse {
    return OnChargeDisputeResponse.fromPartial(base ?? {});
  },
  fromPartial(_: DeepPartial<OnChargeDisputeResponse>): OnChargeDisputeResponse {
    const message = createBaseOnChargeDisputeResponse();
    return message;
  },
};

export type BillingServiceDefinition = typeof BillingServiceDefinition;
export const BillingServiceDefinition = {
  name: "BillingService",
  fullName: "usage.v1.BillingService",
  methods: {
    /**
     * ReconcileInvoices retrieves current credit balance and reflects it in
     * billing system. Internal RPC, not intended for general consumption.
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
    /**
     * CreateHoldPaymentIntent is meant to create a PaymentIntent for the given
     * customer, that is meant as measure to verify the payment
     * method/creditability of this user on first signup, before we create the
     * subscription
     */
    createHoldPaymentIntent: {
      name: "CreateHoldPaymentIntent",
      requestType: CreateHoldPaymentIntentRequest,
      requestStream: false,
      responseType: CreateHoldPaymentIntentResponse,
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
    updateCustomerSubscriptionsTaxState: {
      name: "UpdateCustomerSubscriptionsTaxState",
      requestType: UpdateCustomerSubscriptionsTaxStateRequest,
      requestStream: false,
      responseType: UpdateCustomerSubscriptionsTaxStateResponse,
      responseStream: false,
      options: {},
    },
    /** GetPriceInformation returns the price information for a given attribtion id */
    getPriceInformation: {
      name: "GetPriceInformation",
      requestType: GetPriceInformationRequest,
      requestStream: false,
      responseType: GetPriceInformationResponse,
      responseStream: false,
      options: {},
    },
    /**
     * OnChargeDispute handles charge disputes created with the underlying payment
     * provider.
     */
    onChargeDispute: {
      name: "OnChargeDispute",
      requestType: OnChargeDisputeRequest,
      requestStream: false,
      responseType: OnChargeDisputeResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface BillingServiceImplementation<CallContextExt = {}> {
  /**
   * ReconcileInvoices retrieves current credit balance and reflects it in
   * billing system. Internal RPC, not intended for general consumption.
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
  /**
   * CreateHoldPaymentIntent is meant to create a PaymentIntent for the given
   * customer, that is meant as measure to verify the payment
   * method/creditability of this user on first signup, before we create the
   * subscription
   */
  createHoldPaymentIntent(
    request: CreateHoldPaymentIntentRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateHoldPaymentIntentResponse>>;
  createStripeSubscription(
    request: CreateStripeSubscriptionRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateStripeSubscriptionResponse>>;
  updateCustomerSubscriptionsTaxState(
    request: UpdateCustomerSubscriptionsTaxStateRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<UpdateCustomerSubscriptionsTaxStateResponse>>;
  /** GetPriceInformation returns the price information for a given attribtion id */
  getPriceInformation(
    request: GetPriceInformationRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetPriceInformationResponse>>;
  /**
   * OnChargeDispute handles charge disputes created with the underlying payment
   * provider.
   */
  onChargeDispute(
    request: OnChargeDisputeRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<OnChargeDisputeResponse>>;
}

export interface BillingServiceClient<CallOptionsExt = {}> {
  /**
   * ReconcileInvoices retrieves current credit balance and reflects it in
   * billing system. Internal RPC, not intended for general consumption.
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
  /**
   * CreateHoldPaymentIntent is meant to create a PaymentIntent for the given
   * customer, that is meant as measure to verify the payment
   * method/creditability of this user on first signup, before we create the
   * subscription
   */
  createHoldPaymentIntent(
    request: DeepPartial<CreateHoldPaymentIntentRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateHoldPaymentIntentResponse>;
  createStripeSubscription(
    request: DeepPartial<CreateStripeSubscriptionRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateStripeSubscriptionResponse>;
  updateCustomerSubscriptionsTaxState(
    request: DeepPartial<UpdateCustomerSubscriptionsTaxStateRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<UpdateCustomerSubscriptionsTaxStateResponse>;
  /** GetPriceInformation returns the price information for a given attribtion id */
  getPriceInformation(
    request: DeepPartial<GetPriceInformationRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetPriceInformationResponse>;
  /**
   * OnChargeDispute handles charge disputes created with the underlying payment
   * provider.
   */
  onChargeDispute(
    request: DeepPartial<OnChargeDisputeRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<OnChargeDisputeResponse>;
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
