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
var usage_v1_usage_pb = require('../../usage/v1/usage_pb.js');

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

function serialize_usage_v1_GetLatestInvoiceRequest(arg) {
  if (!(arg instanceof usage_v1_billing_pb.GetLatestInvoiceRequest)) {
    throw new Error('Expected argument of type usage.v1.GetLatestInvoiceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetLatestInvoiceRequest(buffer_arg) {
  return usage_v1_billing_pb.GetLatestInvoiceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_GetLatestInvoiceResponse(arg) {
  if (!(arg instanceof usage_v1_billing_pb.GetLatestInvoiceResponse)) {
    throw new Error('Expected argument of type usage.v1.GetLatestInvoiceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetLatestInvoiceResponse(buffer_arg) {
  return usage_v1_billing_pb.GetLatestInvoiceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_UpdateInvoicesRequest(arg) {
  if (!(arg instanceof usage_v1_billing_pb.UpdateInvoicesRequest)) {
    throw new Error('Expected argument of type usage.v1.UpdateInvoicesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_UpdateInvoicesRequest(buffer_arg) {
  return usage_v1_billing_pb.UpdateInvoicesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_UpdateInvoicesResponse(arg) {
  if (!(arg instanceof usage_v1_billing_pb.UpdateInvoicesResponse)) {
    throw new Error('Expected argument of type usage.v1.UpdateInvoicesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_UpdateInvoicesResponse(buffer_arg) {
  return usage_v1_billing_pb.UpdateInvoicesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var BillingServiceService = exports.BillingServiceService = {
  // UpdateInvoices takes provides BilledSessions and reflects their usage
// in a billing system.
// This is an Internal RPC used by the usage reconciler and not intended for general consumption.
updateInvoices: {
    path: '/usage.v1.BillingService/UpdateInvoices',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_billing_pb.UpdateInvoicesRequest,
    responseType: usage_v1_billing_pb.UpdateInvoicesResponse,
    requestSerialize: serialize_usage_v1_UpdateInvoicesRequest,
    requestDeserialize: deserialize_usage_v1_UpdateInvoicesRequest,
    responseSerialize: serialize_usage_v1_UpdateInvoicesResponse,
    responseDeserialize: deserialize_usage_v1_UpdateInvoicesResponse,
  },
  // GetLatestInvoice retrieves the latest invoice for a given query.
getLatestInvoice: {
    path: '/usage.v1.BillingService/GetLatestInvoice',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_billing_pb.GetLatestInvoiceRequest,
    responseType: usage_v1_billing_pb.GetLatestInvoiceResponse,
    requestSerialize: serialize_usage_v1_GetLatestInvoiceRequest,
    requestDeserialize: deserialize_usage_v1_GetLatestInvoiceRequest,
    responseSerialize: serialize_usage_v1_GetLatestInvoiceResponse,
    responseDeserialize: deserialize_usage_v1_GetLatestInvoiceResponse,
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
};

exports.BillingServiceClient = grpc.makeGenericClientConstructor(BillingServiceService);
