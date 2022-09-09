/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var usage_v1_usage_pb = require('../../usage/v1/usage_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');

function serialize_usage_v1_GetCostCenterRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.GetCostCenterRequest)) {
    throw new Error('Expected argument of type usage.v1.GetCostCenterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetCostCenterRequest(buffer_arg) {
  return usage_v1_usage_pb.GetCostCenterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_GetCostCenterResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.GetCostCenterResponse)) {
    throw new Error('Expected argument of type usage.v1.GetCostCenterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetCostCenterResponse(buffer_arg) {
  return usage_v1_usage_pb.GetCostCenterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ListUsageRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ListUsageRequest)) {
    throw new Error('Expected argument of type usage.v1.ListUsageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ListUsageRequest(buffer_arg) {
  return usage_v1_usage_pb.ListUsageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ListUsageResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ListUsageResponse)) {
    throw new Error('Expected argument of type usage.v1.ListUsageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ListUsageResponse(buffer_arg) {
  return usage_v1_usage_pb.ListUsageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ReconcileUsageWithLedgerRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ReconcileUsageWithLedgerRequest)) {
    throw new Error('Expected argument of type usage.v1.ReconcileUsageWithLedgerRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ReconcileUsageWithLedgerRequest(buffer_arg) {
  return usage_v1_usage_pb.ReconcileUsageWithLedgerRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ReconcileUsageWithLedgerResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ReconcileUsageWithLedgerResponse)) {
    throw new Error('Expected argument of type usage.v1.ReconcileUsageWithLedgerResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ReconcileUsageWithLedgerResponse(buffer_arg) {
  return usage_v1_usage_pb.ReconcileUsageWithLedgerResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_SetCostCenterRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.SetCostCenterRequest)) {
    throw new Error('Expected argument of type usage.v1.SetCostCenterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_SetCostCenterRequest(buffer_arg) {
  return usage_v1_usage_pb.SetCostCenterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_SetCostCenterResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.SetCostCenterResponse)) {
    throw new Error('Expected argument of type usage.v1.SetCostCenterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_SetCostCenterResponse(buffer_arg) {
  return usage_v1_usage_pb.SetCostCenterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var UsageServiceService = exports.UsageServiceService = {
  // GetCostCenter retrieves the active cost center for the given attributionID
getCostCenter: {
    path: '/usage.v1.UsageService/GetCostCenter',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.GetCostCenterRequest,
    responseType: usage_v1_usage_pb.GetCostCenterResponse,
    requestSerialize: serialize_usage_v1_GetCostCenterRequest,
    requestDeserialize: deserialize_usage_v1_GetCostCenterRequest,
    responseSerialize: serialize_usage_v1_GetCostCenterResponse,
    responseDeserialize: deserialize_usage_v1_GetCostCenterResponse,
  },
  // SetCostCenter stores the given cost center
setCostCenter: {
    path: '/usage.v1.UsageService/SetCostCenter',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.SetCostCenterRequest,
    responseType: usage_v1_usage_pb.SetCostCenterResponse,
    requestSerialize: serialize_usage_v1_SetCostCenterRequest,
    requestDeserialize: deserialize_usage_v1_SetCostCenterRequest,
    responseSerialize: serialize_usage_v1_SetCostCenterResponse,
    responseDeserialize: deserialize_usage_v1_SetCostCenterResponse,
  },
  // Triggers reconciliation of usage with ledger implementation.
reconcileUsageWithLedger: {
    path: '/usage.v1.UsageService/ReconcileUsageWithLedger',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest,
    responseType: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse,
    requestSerialize: serialize_usage_v1_ReconcileUsageWithLedgerRequest,
    requestDeserialize: deserialize_usage_v1_ReconcileUsageWithLedgerRequest,
    responseSerialize: serialize_usage_v1_ReconcileUsageWithLedgerResponse,
    responseDeserialize: deserialize_usage_v1_ReconcileUsageWithLedgerResponse,
  },
  // ListUsage retrieves all usage for the specified attributionId and theb given time range
listUsage: {
    path: '/usage.v1.UsageService/ListUsage',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.ListUsageRequest,
    responseType: usage_v1_usage_pb.ListUsageResponse,
    requestSerialize: serialize_usage_v1_ListUsageRequest,
    requestDeserialize: deserialize_usage_v1_ListUsageRequest,
    responseSerialize: serialize_usage_v1_ListUsageResponse,
    responseDeserialize: deserialize_usage_v1_ListUsageResponse,
  },
};

exports.UsageServiceClient = grpc.makeGenericClientConstructor(UsageServiceService);
