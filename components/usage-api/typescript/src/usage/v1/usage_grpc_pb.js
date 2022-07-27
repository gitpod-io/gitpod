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

function serialize_usage_v1_CollectUsageRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.CollectUsageRequest)) {
    throw new Error('Expected argument of type usage.v1.CollectUsageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_CollectUsageRequest(buffer_arg) {
  return usage_v1_usage_pb.CollectUsageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_CollectUsageResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.CollectUsageResponse)) {
    throw new Error('Expected argument of type usage.v1.CollectUsageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_CollectUsageResponse(buffer_arg) {
  return usage_v1_usage_pb.CollectUsageResponse.deserializeBinary(new Uint8Array(buffer_arg));
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
  // CollectUsage collects usage for the specified time period, and stores the usage records in the database, returning the records.
collectUsage: {
    path: '/usage.v1.UsageService/CollectUsage',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.CollectUsageRequest,
    responseType: usage_v1_usage_pb.CollectUsageResponse,
    requestSerialize: serialize_usage_v1_CollectUsageRequest,
    requestDeserialize: deserialize_usage_v1_CollectUsageRequest,
    responseSerialize: serialize_usage_v1_CollectUsageResponse,
    responseDeserialize: deserialize_usage_v1_CollectUsageResponse,
  },
};

exports.UsageServiceClient = grpc.makeGenericClientConstructor(UsageServiceService);
