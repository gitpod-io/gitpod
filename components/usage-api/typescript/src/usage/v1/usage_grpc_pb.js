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

function serialize_usage_v1_GetBilledUsageRequest(arg) {
  if (!(arg instanceof usage_v1_usage_pb.GetBilledUsageRequest)) {
    throw new Error('Expected argument of type usage.v1.GetBilledUsageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetBilledUsageRequest(buffer_arg) {
  return usage_v1_usage_pb.GetBilledUsageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_usage_v1_GetBilledUsageResponse(arg) {
  if (!(arg instanceof usage_v1_usage_pb.GetBilledUsageResponse)) {
    throw new Error('Expected argument of type usage.v1.GetBilledUsageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_usage_v1_GetBilledUsageResponse(buffer_arg) {
  return usage_v1_usage_pb.GetBilledUsageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var UsageServiceService = exports.UsageServiceService = {
  // GetBilleadUsage retrieves all usage for a team.
getBilledUsage: {
    path: '/usage.v1.UsageService/GetBilledUsage',
    requestStream: false,
    responseStream: false,
    requestType: usage_v1_usage_pb.GetBilledUsageRequest,
    responseType: usage_v1_usage_pb.GetBilledUsageResponse,
    requestSerialize: serialize_usage_v1_GetBilledUsageRequest,
    requestDeserialize: deserialize_usage_v1_GetBilledUsageRequest,
    responseSerialize: serialize_usage_v1_GetBilledUsageResponse,
    responseDeserialize: deserialize_usage_v1_GetBilledUsageResponse,
  },
};

exports.UsageServiceClient = grpc.makeGenericClientConstructor(UsageServiceService);
