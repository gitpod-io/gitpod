// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var gitpod_v1_prebuilds_pb = require('../../gitpod/v1/prebuilds_pb.js');
var gitpod_v1_workspaces_pb = require('../../gitpod/v1/workspaces_pb.js');
var google_rpc_status_pb = require('../../google/rpc/status_pb.js');

function serialize_gitpod_v1_GetPrebuildRequest(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.GetPrebuildRequest)) {
    throw new Error('Expected argument of type gitpod.v1.GetPrebuildRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetPrebuildRequest(buffer_arg) {
  return gitpod_v1_prebuilds_pb.GetPrebuildRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetPrebuildResponse(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.GetPrebuildResponse)) {
    throw new Error('Expected argument of type gitpod.v1.GetPrebuildResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetPrebuildResponse(buffer_arg) {
  return gitpod_v1_prebuilds_pb.GetPrebuildResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

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

function serialize_gitpod_v1_ListenToPrebuildLogsRequest(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToPrebuildLogsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToPrebuildLogsRequest(buffer_arg) {
  return gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListenToPrebuildLogsResponse(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToPrebuildLogsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToPrebuildLogsResponse(buffer_arg) {
  return gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListenToPrebuildStatusRequest(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToPrebuildStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToPrebuildStatusRequest(buffer_arg) {
  return gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListenToPrebuildStatusResponse(arg) {
  if (!(arg instanceof gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToPrebuildStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToPrebuildStatusResponse(buffer_arg) {
  return gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// import "gitpod/v1/pagination.proto";
//
var PrebuildsServiceService = exports.PrebuildsServiceService = {
  // GetPrebuild retrieves a single rebuild.
// Errors:
//   NOT_FOUND if the prebuild_id does not exist
getPrebuild: {
    path: '/gitpod.v1.PrebuildsService/GetPrebuild',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_prebuilds_pb.GetPrebuildRequest,
    responseType: gitpod_v1_prebuilds_pb.GetPrebuildResponse,
    requestSerialize: serialize_gitpod_v1_GetPrebuildRequest,
    requestDeserialize: deserialize_gitpod_v1_GetPrebuildRequest,
    responseSerialize: serialize_gitpod_v1_GetPrebuildResponse,
    responseDeserialize: deserialize_gitpod_v1_GetPrebuildResponse,
  },
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
  // ListenToPrebuildStatus streams status updates for a prebuild. If the prebuild is already
// in the Done phase, only that single status is streamed.
listenToPrebuildStatus: {
    path: '/gitpod.v1.PrebuildsService/ListenToPrebuildStatus',
    requestStream: false,
    responseStream: true,
    requestType: gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest,
    responseType: gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse,
    requestSerialize: serialize_gitpod_v1_ListenToPrebuildStatusRequest,
    requestDeserialize: deserialize_gitpod_v1_ListenToPrebuildStatusRequest,
    responseSerialize: serialize_gitpod_v1_ListenToPrebuildStatusResponse,
    responseDeserialize: deserialize_gitpod_v1_ListenToPrebuildStatusResponse,
  },
  // ListenToPrebuildLogs returns the log output of a prebuild.
// This does NOT include an image build if one happened.
listenToPrebuildLogs: {
    path: '/gitpod.v1.PrebuildsService/ListenToPrebuildLogs',
    requestStream: false,
    responseStream: true,
    requestType: gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest,
    responseType: gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse,
    requestSerialize: serialize_gitpod_v1_ListenToPrebuildLogsRequest,
    requestDeserialize: deserialize_gitpod_v1_ListenToPrebuildLogsRequest,
    responseSerialize: serialize_gitpod_v1_ListenToPrebuildLogsResponse,
    responseDeserialize: deserialize_gitpod_v1_ListenToPrebuildLogsResponse,
  },
};

exports.PrebuildsServiceClient = grpc.makeGenericClientConstructor(PrebuildsServiceService);
