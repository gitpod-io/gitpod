// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('@grpc/grpc-js');
var streams_pb = require('./streams_pb.js');

function serialize_contentservice_AccessStreamRequest(arg) {
  if (!(arg instanceof streams_pb.AccessStreamRequest)) {
    throw new Error('Expected argument of type contentservice.AccessStreamRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_AccessStreamRequest(buffer_arg) {
  return streams_pb.AccessStreamRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_AccessStreamResponse(arg) {
  if (!(arg instanceof streams_pb.AccessStreamResponse)) {
    throw new Error('Expected argument of type contentservice.AccessStreamResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_AccessStreamResponse(buffer_arg) {
  return streams_pb.AccessStreamResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_CommitStreamRequest(arg) {
  if (!(arg instanceof streams_pb.CommitStreamRequest)) {
    throw new Error('Expected argument of type contentservice.CommitStreamRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_CommitStreamRequest(buffer_arg) {
  return streams_pb.CommitStreamRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_CommitStreamResponse(arg) {
  if (!(arg instanceof streams_pb.CommitStreamResponse)) {
    throw new Error('Expected argument of type contentservice.CommitStreamResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_CommitStreamResponse(buffer_arg) {
  return streams_pb.CommitStreamResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_StartStreamRequest(arg) {
  if (!(arg instanceof streams_pb.StartStreamRequest)) {
    throw new Error('Expected argument of type contentservice.StartStreamRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_StartStreamRequest(buffer_arg) {
  return streams_pb.StartStreamRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_StartStreamResponse(arg) {
  if (!(arg instanceof streams_pb.StartStreamResponse)) {
    throw new Error('Expected argument of type contentservice.StartStreamResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_StartStreamResponse(buffer_arg) {
  return streams_pb.StartStreamResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var LogStreamServiceService = exports.LogStreamServiceService = {
  startStream: {
    path: '/contentservice.LogStreamService/StartStream',
    requestStream: false,
    responseStream: false,
    requestType: streams_pb.StartStreamRequest,
    responseType: streams_pb.StartStreamResponse,
    requestSerialize: serialize_contentservice_StartStreamRequest,
    requestDeserialize: deserialize_contentservice_StartStreamRequest,
    responseSerialize: serialize_contentservice_StartStreamResponse,
    responseDeserialize: deserialize_contentservice_StartStreamResponse,
  },
  commitStream: {
    path: '/contentservice.LogStreamService/CommitStream',
    requestStream: false,
    responseStream: false,
    requestType: streams_pb.CommitStreamRequest,
    responseType: streams_pb.CommitStreamResponse,
    requestSerialize: serialize_contentservice_CommitStreamRequest,
    requestDeserialize: deserialize_contentservice_CommitStreamRequest,
    responseSerialize: serialize_contentservice_CommitStreamResponse,
    responseDeserialize: deserialize_contentservice_CommitStreamResponse,
  },
  accessStream: {
    path: '/contentservice.LogStreamService/AccessStream',
    requestStream: false,
    responseStream: false,
    requestType: streams_pb.AccessStreamRequest,
    responseType: streams_pb.AccessStreamResponse,
    requestSerialize: serialize_contentservice_AccessStreamRequest,
    requestDeserialize: deserialize_contentservice_AccessStreamRequest,
    responseSerialize: serialize_contentservice_AccessStreamResponse,
    responseDeserialize: deserialize_contentservice_AccessStreamResponse,
  },
};

exports.LogStreamServiceClient = grpc.makeGenericClientConstructor(LogStreamServiceService);
