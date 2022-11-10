// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
'use strict';
var grpc = require('@grpc/grpc-js');
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

function serialize_contentservice_WorkspaceSnapshotExistsRequest(arg) {
  if (!(arg instanceof workspace_pb.WorkspaceSnapshotExistsRequest)) {
    throw new Error('Expected argument of type contentservice.WorkspaceSnapshotExistsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_WorkspaceSnapshotExistsRequest(buffer_arg) {
  return workspace_pb.WorkspaceSnapshotExistsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_contentservice_WorkspaceSnapshotExistsResponse(arg) {
  if (!(arg instanceof workspace_pb.WorkspaceSnapshotExistsResponse)) {
    throw new Error('Expected argument of type contentservice.WorkspaceSnapshotExistsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_contentservice_WorkspaceSnapshotExistsResponse(buffer_arg) {
  return workspace_pb.WorkspaceSnapshotExistsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WorkspaceServiceService = exports.WorkspaceServiceService = {
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
  // WorkspaceSnapshotExists checks whether the snapshot exists or not
workspaceSnapshotExists: {
    path: '/contentservice.WorkspaceService/WorkspaceSnapshotExists',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.WorkspaceSnapshotExistsRequest,
    responseType: workspace_pb.WorkspaceSnapshotExistsResponse,
    requestSerialize: serialize_contentservice_WorkspaceSnapshotExistsRequest,
    requestDeserialize: deserialize_contentservice_WorkspaceSnapshotExistsRequest,
    responseSerialize: serialize_contentservice_WorkspaceSnapshotExistsResponse,
    responseDeserialize: deserialize_contentservice_WorkspaceSnapshotExistsResponse,
  },
};

exports.WorkspaceServiceClient = grpc.makeGenericClientConstructor(WorkspaceServiceService);
