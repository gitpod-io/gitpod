/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var token_pb = require('./token_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');

function serialize_supervisor_ClearTokenRequest(arg) {
  if (!(arg instanceof token_pb.ClearTokenRequest)) {
    throw new Error('Expected argument of type supervisor.ClearTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ClearTokenRequest(buffer_arg) {
  return token_pb.ClearTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ClearTokenResponse(arg) {
  if (!(arg instanceof token_pb.ClearTokenResponse)) {
    throw new Error('Expected argument of type supervisor.ClearTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ClearTokenResponse(buffer_arg) {
  return token_pb.ClearTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_GetTokenRequest(arg) {
  if (!(arg instanceof token_pb.GetTokenRequest)) {
    throw new Error('Expected argument of type supervisor.GetTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_GetTokenRequest(buffer_arg) {
  return token_pb.GetTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_GetTokenResponse(arg) {
  if (!(arg instanceof token_pb.GetTokenResponse)) {
    throw new Error('Expected argument of type supervisor.GetTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_GetTokenResponse(buffer_arg) {
  return token_pb.GetTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ProvideTokenRequest(arg) {
  if (!(arg instanceof token_pb.ProvideTokenRequest)) {
    throw new Error('Expected argument of type supervisor.ProvideTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ProvideTokenRequest(buffer_arg) {
  return token_pb.ProvideTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ProvideTokenResponse(arg) {
  if (!(arg instanceof token_pb.ProvideTokenResponse)) {
    throw new Error('Expected argument of type supervisor.ProvideTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ProvideTokenResponse(buffer_arg) {
  return token_pb.ProvideTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SetTokenRequest(arg) {
  if (!(arg instanceof token_pb.SetTokenRequest)) {
    throw new Error('Expected argument of type supervisor.SetTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SetTokenRequest(buffer_arg) {
  return token_pb.SetTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SetTokenResponse(arg) {
  if (!(arg instanceof token_pb.SetTokenResponse)) {
    throw new Error('Expected argument of type supervisor.SetTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SetTokenResponse(buffer_arg) {
  return token_pb.SetTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var TokenServiceService = exports.TokenServiceService = {
  getToken: {
    path: '/supervisor.TokenService/GetToken',
    requestStream: false,
    responseStream: false,
    requestType: token_pb.GetTokenRequest,
    responseType: token_pb.GetTokenResponse,
    requestSerialize: serialize_supervisor_GetTokenRequest,
    requestDeserialize: deserialize_supervisor_GetTokenRequest,
    responseSerialize: serialize_supervisor_GetTokenResponse,
    responseDeserialize: deserialize_supervisor_GetTokenResponse,
  },
  setToken: {
    path: '/supervisor.TokenService/SetToken',
    requestStream: false,
    responseStream: false,
    requestType: token_pb.SetTokenRequest,
    responseType: token_pb.SetTokenResponse,
    requestSerialize: serialize_supervisor_SetTokenRequest,
    requestDeserialize: deserialize_supervisor_SetTokenRequest,
    responseSerialize: serialize_supervisor_SetTokenResponse,
    responseDeserialize: deserialize_supervisor_SetTokenResponse,
  },
  clearToken: {
    path: '/supervisor.TokenService/ClearToken',
    requestStream: false,
    responseStream: false,
    requestType: token_pb.ClearTokenRequest,
    responseType: token_pb.ClearTokenResponse,
    requestSerialize: serialize_supervisor_ClearTokenRequest,
    requestDeserialize: deserialize_supervisor_ClearTokenRequest,
    responseSerialize: serialize_supervisor_ClearTokenResponse,
    responseDeserialize: deserialize_supervisor_ClearTokenResponse,
  },
  provideToken: {
    path: '/supervisor.TokenService/ProvideToken',
    requestStream: true,
    responseStream: true,
    requestType: token_pb.ProvideTokenRequest,
    responseType: token_pb.ProvideTokenResponse,
    requestSerialize: serialize_supervisor_ProvideTokenRequest,
    requestDeserialize: deserialize_supervisor_ProvideTokenRequest,
    responseSerialize: serialize_supervisor_ProvideTokenResponse,
    responseDeserialize: deserialize_supervisor_ProvideTokenResponse,
  },
};

exports.TokenServiceClient = grpc.makeGenericClientConstructor(TokenServiceService);
