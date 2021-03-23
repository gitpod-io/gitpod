// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('grpc');
var workspace_pb = require('./workspace_pb.js');

function serialize_contentservice_DeleteWorkspaceRequest(arg) {
  if (!(arg instanceof workspace_pb.DeleteWorkspaceRequest)) {
    throw new Error('Expected argument of type contentservice.DeleteWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_DeleteWorkspaceRequest(buffer_arg) {
  return workspace_pb.DeleteWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_DeleteWorkspaceResponse(arg) {
  if (!(arg instanceof workspace_pb.DeleteWorkspaceResponse)) {
    throw new Error('Expected argument of type contentservice.DeleteWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_DeleteWorkspaceResponse(buffer_arg) {
  return workspace_pb.DeleteWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_WorkspaceDownloadURLRequest(arg) {
  if (!(arg instanceof workspace_pb.WorkspaceDownloadURLRequest)) {
    throw new Error('Expected argument of type contentservice.WorkspaceDownloadURLRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_WorkspaceDownloadURLRequest(buffer_arg) {
  return workspace_pb.WorkspaceDownloadURLRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_WorkspaceDownloadURLResponse(arg) {
  if (!(arg instanceof workspace_pb.WorkspaceDownloadURLResponse)) {
    throw new Error('Expected argument of type contentservice.WorkspaceDownloadURLResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_WorkspaceDownloadURLResponse(buffer_arg) {
  return workspace_pb.WorkspaceDownloadURLResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WorkspaceServiceService = exports.WorkspaceServiceService = {
  // WorkspaceDownloadURL provides a URL from where the content of a workspace can be downloaded from
WorkspaceDownloadURL: {
    path: '/contentservice.WorkspaceService/WorkspaceDownloadURL',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.WorkspaceDownloadURLRequest,
    responseType: workspace_pb.WorkspaceDownloadURLResponse,
    requestSerialize: serialize_contentservice_WorkspaceDownloadURLRequest,
    requestDeserialize: deserialize_contentservice_WorkspaceDownloadURLRequest,
    responseSerialize: serialize_contentservice_WorkspaceDownloadURLResponse,
    responseDeserialize: deserialize_contentservice_WorkspaceDownloadURLResponse,
  },
  // DeleteWorkspace deletes the content of a single workspace
deleteWorkspace: {
    path: '/contentservice.WorkspaceService/DeleteWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.DeleteWorkspaceRequest,
    responseType: workspace_pb.DeleteWorkspaceResponse,
    requestSerialize: serialize_contentservice_DeleteWorkspaceRequest,
    requestDeserialize: deserialize_contentservice_DeleteWorkspaceRequest,
    responseSerialize: serialize_contentservice_DeleteWorkspaceResponse,
    responseDeserialize: deserialize_contentservice_DeleteWorkspaceResponse,
  },
};

exports.WorkspaceServiceClient = grpc.makeGenericClientConstructor(WorkspaceServiceService);
