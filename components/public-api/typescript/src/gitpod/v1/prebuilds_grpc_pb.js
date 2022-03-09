// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var gitpod_v1_prebuilds_pb = require('../../gitpod/v1/prebuilds_pb.js');
var gitpod_v1_pagination_pb = require('../../gitpod/v1/pagination_pb.js');

function serialize_gitpod_v1_GetRunningPrebuildRequest(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest)) {
    throw new Error('Expected argument of type gitpod.v1.GetRunningPrebuildRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetRunningPrebuildRequest(buffer_arg) {
  return gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetRunningPrebuildResponse(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse)) {
    throw new Error('Expected argument of type gitpod.v1.GetRunningPrebuildResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetRunningPrebuildResponse(buffer_arg) {
  return gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var PrebuildsServiceService = exports.PrebuildsServiceService = {
  // GetRunningPrebuild returns the prebuild ID of a running prebuild,
// or NOT_FOUND if there is no prebuild running for the content_url.
getRunningPrebuild: {
    path: '/gitpod.v1.PrebuildsService/GetRunningPrebuild',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest,
    responseType: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse,
    requestSerialize: serialize_gitpod_v1_GetRunningPrebuildRequest,
    requestDeserialize: deserialize_gitpod_v1_GetRunningPrebuildRequest,
    responseSerialize: serialize_gitpod_v1_GetRunningPrebuildResponse,
    responseDeserialize: deserialize_gitpod_v1_GetRunningPrebuildResponse,
  },
};

exports.PrebuildsServiceClient = grpc.makeGenericClientConstructor(PrebuildsServiceService);
