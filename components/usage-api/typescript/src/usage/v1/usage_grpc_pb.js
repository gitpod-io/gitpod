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

function serialize_usage_v1_LastUsageReconcilationTimeRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.LastUsageReconcilationTimeRequest)) {
    throw new Error('Expected argument of type usage.v1.LastUsageReconcilationTimeRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_LastUsageReconcilationTimeRequest(buffer_arg) {
  return usage_v1_usage_pb.LastUsageReconcilationTimeRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_LastUsageReconcilationTimeResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.LastUsageReconcilationTimeResponse)) {
    throw new Error('Expected argument of type usage.v1.LastUsageReconcilationTimeResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_LastUsageReconcilationTimeResponse(buffer_arg) {
  return usage_v1_usage_pb.LastUsageReconcilationTimeResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ListBilledUsageRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ListBilledUsageRequest)) {
    throw new Error('Expected argument of type usage.v1.ListBilledUsageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ListBilledUsageRequest(buffer_arg) {
  return usage_v1_usage_pb.ListBilledUsageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ListBilledUsageResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ListBilledUsageResponse)) {
    throw new Error('Expected argument of type usage.v1.ListBilledUsageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ListBilledUsageResponse(buffer_arg) {
  return usage_v1_usage_pb.ListBilledUsageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ReconcileUsageRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ReconcileUsageRequest)) {
    throw new Error('Expected argument of type usage.v1.ReconcileUsageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ReconcileUsageRequest(buffer_arg) {
  return usage_v1_usage_pb.ReconcileUsageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_ReconcileUsageResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.ReconcileUsageResponse)) {
    throw new Error('Expected argument of type usage.v1.ReconcileUsageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_ReconcileUsageResponse(buffer_arg) {
  return usage_v1_usage_pb.ReconcileUsageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var UsageServiceService = exports.UsageServiceService = {
  // ListBilledUsage retrieves all usage for the specified attributionId
listBilledUsage: {
    path: '/usage.v1.UsageService/ListBilledUsage',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.ListBilledUsageRequest,
    responseType: usage_v1_usage_pb.ListBilledUsageResponse,
    requestSerialize: serialize_usage_v1_ListBilledUsageRequest,
    requestDeserialize: deserialize_usage_v1_ListBilledUsageRequest,
    responseSerialize: serialize_usage_v1_ListBilledUsageResponse,
    responseDeserialize: deserialize_usage_v1_ListBilledUsageResponse,
  },
  // ReconcileUsage collects usage for the specified time period, and stores the usage records in the database, returning the records.
reconcileUsage: {
    path: '/usage.v1.UsageService/ReconcileUsage',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.ReconcileUsageRequest,
    responseType: usage_v1_usage_pb.ReconcileUsageResponse,
    requestSerialize: serialize_usage_v1_ReconcileUsageRequest,
    requestDeserialize: deserialize_usage_v1_ReconcileUsageRequest,
    responseSerialize: serialize_usage_v1_ReconcileUsageResponse,
    responseDeserialize: deserialize_usage_v1_ReconcileUsageResponse,
  },
  // LastUsageReconcilationTime returns the last time the usage reconciler ran.
lastUsageReconcilationTime: {
    path: '/usage.v1.UsageService/LastUsageReconcilationTime',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.LastUsageReconcilationTimeRequest,
    responseType: usage_v1_usage_pb.LastUsageReconcilationTimeResponse,
    requestSerialize: serialize_usage_v1_LastUsageReconcilationTimeRequest,
    requestDeserialize: deserialize_usage_v1_LastUsageReconcilationTimeRequest,
    responseSerialize: serialize_usage_v1_LastUsageReconcilationTimeResponse,
    responseDeserialize: deserialize_usage_v1_LastUsageReconcilationTimeResponse,
  },
  // GetCostCenter retrieves the spending limit with its associated attributionID
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
};

exports.UsageServiceClient = grpc.makeGenericClientConstructor(UsageServiceService);
