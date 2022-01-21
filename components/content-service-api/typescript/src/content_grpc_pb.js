// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('@grpc/grpc-js');
var content_pb = require('./content_pb.js');

function serialize_contentservice_DeleteUserContentRequest(arg) {
  if (!(arg instanceof content_pb.DeleteUserContentRequest)) {
    throw new Error('Expected argument of type contentservice.DeleteUserContentRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_DeleteUserContentRequest(buffer_arg) {
  return content_pb.DeleteUserContentRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_DeleteUserContentResponse(arg) {
  if (!(arg instanceof content_pb.DeleteUserContentResponse)) {
    throw new Error('Expected argument of type contentservice.DeleteUserContentResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_DeleteUserContentResponse(buffer_arg) {
  return content_pb.DeleteUserContentResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

var ContentServiceService = (exports.ContentServiceService = {
  // DeleteUserContent deletes all content associated with a user.
  deleteUserContent: {
    path: '/contentservice.ContentService/DeleteUserContent',
    requestStream: false,
    responseStream: false,
    requestType: content_pb.DeleteUserContentRequest,
    responseType: content_pb.DeleteUserContentResponse,
    requestSerialize: serialize_contentservice_DeleteUserContentRequest,
    requestDeserialize: deserialize_contentservice_DeleteUserContentRequest,
    responseSerialize: serialize_contentservice_DeleteUserContentResponse,
    responseDeserialize: deserialize_contentservice_DeleteUserContentResponse,
  },
});

exports.ContentServiceClient = grpc.makeGenericClientConstructor(ContentServiceService);
