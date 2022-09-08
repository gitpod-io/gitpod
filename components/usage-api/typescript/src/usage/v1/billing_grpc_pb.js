/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var usage_v1_billing_pb = require('../../usage/v1/billing_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');

function serialize_usage_v1_FinalizeInvoiceRequest(arg) {
  if (!(arg instanceof usage_v1_billing_pb.FinalizeInvoiceRequest)) {
    throw new Error('Expected argument of type usage.v1.FinalizeInvoiceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_FinalizeInvoiceRequest(buffer_arg) {
  return usage_v1_billing_pb.FinalizeInvoiceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_FinalizeInvoiceResponse(arg) {
  if (!(arg instanceof usage_v1_billing_pb.FinalizeInvoiceResponse)) {
    throw new Error('Expected argument of type usage.v1.FinalizeInvoiceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_FinalizeInvoiceResponse(buffer_arg) {
  return usage_v1_billing_pb.FinalizeInvoiceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_GetUpcomingInvoiceRequest(arg) {
  if (!(arg instanceof usage_v1_billing_pb.GetUpcomingInvoiceRequest)) {
    throw new Error('Expected argument of type usage.v1.GetUpcomingInvoiceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetUpcomingInvoiceRequest(buffer_arg) {
  return usage_v1_billing_pb.GetUpcomingInvoiceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_GetUpcomingInvoiceResponse(arg) {
  if (!(arg instanceof usage_v1_billing_pb.GetUpcomingInvoiceResponse)) {
    throw new Error('Expected argument of type usage.v1.GetUpcomingInvoiceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetUpcomingInvoiceResponse(buffer_arg) {
  return usage_v1_billing_pb.GetUpcomingInvoiceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ReconcileInvoicesRequest(arg) {
  if (!(arg instanceof usage_v1_billing_pb.ReconcileInvoicesRequest)) {
    throw new Error('Expected argument of type usage.v1.ReconcileInvoicesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ReconcileInvoicesRequest(buffer_arg) {
  return usage_v1_billing_pb.ReconcileInvoicesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ReconcileInvoicesResponse(arg) {
  if (!(arg instanceof usage_v1_billing_pb.ReconcileInvoicesResponse)) {
    throw new Error('Expected argument of type usage.v1.ReconcileInvoicesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ReconcileInvoicesResponse(buffer_arg) {
  return usage_v1_billing_pb.ReconcileInvoicesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_SetBilledSessionRequest(arg) {
  if (!(arg instanceof usage_v1_billing_pb.SetBilledSessionRequest)) {
    throw new Error('Expected argument of type usage.v1.SetBilledSessionRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_SetBilledSessionRequest(buffer_arg) {
  return usage_v1_billing_pb.SetBilledSessionRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_SetBilledSessionResponse(arg) {
  if (!(arg instanceof usage_v1_billing_pb.SetBilledSessionResponse)) {
    throw new Error('Expected argument of type usage.v1.SetBilledSessionResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_SetBilledSessionResponse(buffer_arg) {
  return usage_v1_billing_pb.SetBilledSessionResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var BillingServiceService = exports.BillingServiceService = {
  // ReconcileInvoices retrieves current credit balance and reflects it in billing system.
// Internal RPC, not intended for general consumption.
reconcileInvoices: {
    path: '/usage.v1.BillingService/ReconcileInvoices',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_billing_pb.ReconcileInvoicesRequest,
    responseType: usage_v1_billing_pb.ReconcileInvoicesResponse,
    requestSerialize: serialize_usage_v1_ReconcileInvoicesRequest,
    requestDeserialize: deserialize_usage_v1_ReconcileInvoicesRequest,
    responseSerialize: serialize_usage_v1_ReconcileInvoicesResponse,
    responseDeserialize: deserialize_usage_v1_ReconcileInvoicesResponse,
  },
  // GetUpcomingInvoice retrieves the latest invoice for a given query.
getUpcomingInvoice: {
    path: '/usage.v1.BillingService/GetUpcomingInvoice',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_billing_pb.GetUpcomingInvoiceRequest,
    responseType: usage_v1_billing_pb.GetUpcomingInvoiceResponse,
    requestSerialize: serialize_usage_v1_GetUpcomingInvoiceRequest,
    requestDeserialize: deserialize_usage_v1_GetUpcomingInvoiceRequest,
    responseSerialize: serialize_usage_v1_GetUpcomingInvoiceResponse,
    responseDeserialize: deserialize_usage_v1_GetUpcomingInvoiceResponse,
  },
  // FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
// having been invoiced.
finalizeInvoice: {
    path: '/usage.v1.BillingService/FinalizeInvoice',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_billing_pb.FinalizeInvoiceRequest,
    responseType: usage_v1_billing_pb.FinalizeInvoiceResponse,
    requestSerialize: serialize_usage_v1_FinalizeInvoiceRequest,
    requestDeserialize: deserialize_usage_v1_FinalizeInvoiceRequest,
    responseSerialize: serialize_usage_v1_FinalizeInvoiceResponse,
    responseDeserialize: deserialize_usage_v1_FinalizeInvoiceResponse,
  },
  // SetBilledSession marks an instance as billed with a billing system
setBilledSession: {
    path: '/usage.v1.BillingService/SetBilledSession',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_billing_pb.SetBilledSessionRequest,
    responseType: usage_v1_billing_pb.SetBilledSessionResponse,
    requestSerialize: serialize_usage_v1_SetBilledSessionRequest,
    requestDeserialize: deserialize_usage_v1_SetBilledSessionRequest,
    responseSerialize: serialize_usage_v1_SetBilledSessionResponse,
    responseDeserialize: deserialize_usage_v1_SetBilledSessionResponse,
  },
};

exports.BillingServiceClient = grpc.makeGenericClientConstructor(BillingServiceService);
