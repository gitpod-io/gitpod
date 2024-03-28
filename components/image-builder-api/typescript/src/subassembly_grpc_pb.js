/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var subassembly_pb = require('./subassembly_pb.js');

function serialize_builder_CreateSubassemblyRequest(arg) {
  if (!(arg instanceof subassembly_pb.CreateSubassemblyRequest)) {
    throw new Error('Expected argument of type builder.CreateSubassemblyRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_CreateSubassemblyRequest(buffer_arg) {
  return subassembly_pb.CreateSubassemblyRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_CreateSubassemblyResponse(arg) {
  if (!(arg instanceof subassembly_pb.CreateSubassemblyResponse)) {
    throw new Error('Expected argument of type builder.CreateSubassemblyResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_CreateSubassemblyResponse(buffer_arg) {
  return subassembly_pb.CreateSubassemblyResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_GetSubassemblyRequest(arg) {
  if (!(arg instanceof subassembly_pb.GetSubassemblyRequest)) {
    throw new Error('Expected argument of type builder.GetSubassemblyRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_GetSubassemblyRequest(buffer_arg) {
  return subassembly_pb.GetSubassemblyRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_builder_GetSubassemblyResponse(arg) {
  if (!(arg instanceof subassembly_pb.GetSubassemblyResponse)) {
    throw new Error('Expected argument of type builder.GetSubassemblyResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_builder_GetSubassemblyResponse(buffer_arg) {
  return subassembly_pb.GetSubassemblyResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var SubassemblyServiceService = exports.SubassemblyServiceService = {
  // CreateSubassembly creates a subassembly from an OCI image
createSubassembly: {
    path: '/builder.SubassemblyService/CreateSubassembly',
    requestStream: false,
    responseStream: false,
    requestType: subassembly_pb.CreateSubassemblyRequest,
    responseType: subassembly_pb.CreateSubassemblyResponse,
    requestSerialize: serialize_builder_CreateSubassemblyRequest,
    requestDeserialize: deserialize_builder_CreateSubassemblyRequest,
    responseSerialize: serialize_builder_CreateSubassemblyResponse,
    responseDeserialize: deserialize_builder_CreateSubassemblyResponse,
  },
  // GetSubassembly returns the status and URL for a subassembly
getSubassembly: {
    path: '/builder.SubassemblyService/GetSubassembly',
    requestStream: false,
    responseStream: false,
    requestType: subassembly_pb.GetSubassemblyRequest,
    responseType: subassembly_pb.GetSubassemblyResponse,
    requestSerialize: serialize_builder_GetSubassemblyRequest,
    requestDeserialize: deserialize_builder_GetSubassemblyRequest,
    responseSerialize: serialize_builder_GetSubassemblyResponse,
    responseDeserialize: deserialize_builder_GetSubassemblyResponse,
  },
};

exports.SubassemblyServiceClient = grpc.makeGenericClientConstructor(SubassemblyServiceService);
