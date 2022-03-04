// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('@grpc/grpc-js');
var cluster$service_pb = require('./cluster-service_pb.js');

function serialize_workspacemanagerbridge_DeregisterRequest(arg) {
  if (!(arg instanceof cluster$service_pb.DeregisterRequest)) {
    throw new Error('Expected argument of type workspacemanagerbridge.DeregisterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_DeregisterRequest(buffer_arg) {
  return cluster$service_pb.DeregisterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_workspacemanagerbridge_DeregisterResponse(arg) {
  if (!(arg instanceof cluster$service_pb.DeregisterResponse)) {
    throw new Error('Expected argument of type workspacemanagerbridge.DeregisterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_DeregisterResponse(buffer_arg) {
  return cluster$service_pb.DeregisterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_workspacemanagerbridge_ListRequest(arg) {
  if (!(arg instanceof cluster$service_pb.ListRequest)) {
    throw new Error('Expected argument of type workspacemanagerbridge.ListRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_ListRequest(buffer_arg) {
  return cluster$service_pb.ListRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_workspacemanagerbridge_ListResponse(arg) {
  if (!(arg instanceof cluster$service_pb.ListResponse)) {
    throw new Error('Expected argument of type workspacemanagerbridge.ListResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_ListResponse(buffer_arg) {
  return cluster$service_pb.ListResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_workspacemanagerbridge_RegisterRequest(arg) {
  if (!(arg instanceof cluster$service_pb.RegisterRequest)) {
    throw new Error('Expected argument of type workspacemanagerbridge.RegisterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_RegisterRequest(buffer_arg) {
  return cluster$service_pb.RegisterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_workspacemanagerbridge_RegisterResponse(arg) {
  if (!(arg instanceof cluster$service_pb.RegisterResponse)) {
    throw new Error('Expected argument of type workspacemanagerbridge.RegisterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_RegisterResponse(buffer_arg) {
  return cluster$service_pb.RegisterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_workspacemanagerbridge_UpdateRequest(arg) {
  if (!(arg instanceof cluster$service_pb.UpdateRequest)) {
    throw new Error('Expected argument of type workspacemanagerbridge.UpdateRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_UpdateRequest(buffer_arg) {
  return cluster$service_pb.UpdateRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_workspacemanagerbridge_UpdateResponse(arg) {
  if (!(arg instanceof cluster$service_pb.UpdateResponse)) {
    throw new Error('Expected argument of type workspacemanagerbridge.UpdateResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_workspacemanagerbridge_UpdateResponse(buffer_arg) {
  return cluster$service_pb.UpdateResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var ClusterServiceService = exports.ClusterServiceService = {
  register: {
    path: '/workspacemanagerbridge.ClusterService/Register',
    requestStream: false,
    responseStream: false,
    requestType: cluster$service_pb.RegisterRequest,
    responseType: cluster$service_pb.RegisterResponse,
    requestSerialize: serialize_workspacemanagerbridge_RegisterRequest,
    requestDeserialize: deserialize_workspacemanagerbridge_RegisterRequest,
    responseSerialize: serialize_workspacemanagerbridge_RegisterResponse,
    responseDeserialize: deserialize_workspacemanagerbridge_RegisterResponse,
  },
  update: {
    path: '/workspacemanagerbridge.ClusterService/Update',
    requestStream: false,
    responseStream: false,
    requestType: cluster$service_pb.UpdateRequest,
    responseType: cluster$service_pb.UpdateResponse,
    requestSerialize: serialize_workspacemanagerbridge_UpdateRequest,
    requestDeserialize: deserialize_workspacemanagerbridge_UpdateRequest,
    responseSerialize: serialize_workspacemanagerbridge_UpdateResponse,
    responseDeserialize: deserialize_workspacemanagerbridge_UpdateResponse,
  },
  deregister: {
    path: '/workspacemanagerbridge.ClusterService/Deregister',
    requestStream: false,
    responseStream: false,
    requestType: cluster$service_pb.DeregisterRequest,
    responseType: cluster$service_pb.DeregisterResponse,
    requestSerialize: serialize_workspacemanagerbridge_DeregisterRequest,
    requestDeserialize: deserialize_workspacemanagerbridge_DeregisterRequest,
    responseSerialize: serialize_workspacemanagerbridge_DeregisterResponse,
    responseDeserialize: deserialize_workspacemanagerbridge_DeregisterResponse,
  },
  list: {
    path: '/workspacemanagerbridge.ClusterService/List',
    requestStream: false,
    responseStream: false,
    requestType: cluster$service_pb.ListRequest,
    responseType: cluster$service_pb.ListResponse,
    requestSerialize: serialize_workspacemanagerbridge_ListRequest,
    requestDeserialize: deserialize_workspacemanagerbridge_ListRequest,
    responseSerialize: serialize_workspacemanagerbridge_ListResponse,
    responseDeserialize: deserialize_workspacemanagerbridge_ListResponse,
  },
};

exports.ClusterServiceClient = grpc.makeGenericClientConstructor(ClusterServiceService);
