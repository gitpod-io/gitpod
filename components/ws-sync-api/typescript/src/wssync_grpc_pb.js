/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var wssync_pb = require('./wssync_pb.js');
var content$service$api_initializer_pb = require('@gitpod/content-service/lib');

function serialize_wssync_DisposeWorkspaceRequest(arg) {
  if (!(arg instanceof wssync_pb.DisposeWorkspaceRequest)) {
    throw new Error('Expected argument of type wssync.DisposeWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_DisposeWorkspaceRequest(buffer_arg) {
  return wssync_pb.DisposeWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wssync_DisposeWorkspaceResponse(arg) {
  if (!(arg instanceof wssync_pb.DisposeWorkspaceResponse)) {
    throw new Error('Expected argument of type wssync.DisposeWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_DisposeWorkspaceResponse(buffer_arg) {
  return wssync_pb.DisposeWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wssync_InitWorkspaceRequest(arg) {
  if (!(arg instanceof wssync_pb.InitWorkspaceRequest)) {
    throw new Error('Expected argument of type wssync.InitWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_InitWorkspaceRequest(buffer_arg) {
  return wssync_pb.InitWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wssync_InitWorkspaceResponse(arg) {
  if (!(arg instanceof wssync_pb.InitWorkspaceResponse)) {
    throw new Error('Expected argument of type wssync.InitWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_InitWorkspaceResponse(buffer_arg) {
  return wssync_pb.InitWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wssync_TakeSnapshotRequest(arg) {
  if (!(arg instanceof wssync_pb.TakeSnapshotRequest)) {
    throw new Error('Expected argument of type wssync.TakeSnapshotRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_TakeSnapshotRequest(buffer_arg) {
  return wssync_pb.TakeSnapshotRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wssync_TakeSnapshotResponse(arg) {
  if (!(arg instanceof wssync_pb.TakeSnapshotResponse)) {
    throw new Error('Expected argument of type wssync.TakeSnapshotResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_TakeSnapshotResponse(buffer_arg) {
  return wssync_pb.TakeSnapshotResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wssync_WaitForInitRequest(arg) {
  if (!(arg instanceof wssync_pb.WaitForInitRequest)) {
    throw new Error('Expected argument of type wssync.WaitForInitRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_WaitForInitRequest(buffer_arg) {
  return wssync_pb.WaitForInitRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wssync_WaitForInitResponse(arg) {
  if (!(arg instanceof wssync_pb.WaitForInitResponse)) {
    throw new Error('Expected argument of type wssync.WaitForInitResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wssync_WaitForInitResponse(buffer_arg) {
  return wssync_pb.WaitForInitResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WorkspaceContentServiceService = exports.WorkspaceContentServiceService = {
  // initWorkspace intialises a new workspace folder in the working area
  initWorkspace: {
    path: '/wssync.WorkspaceContentService/InitWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: wssync_pb.InitWorkspaceRequest,
    responseType: wssync_pb.InitWorkspaceResponse,
    requestSerialize: serialize_wssync_InitWorkspaceRequest,
    requestDeserialize: deserialize_wssync_InitWorkspaceRequest,
    responseSerialize: serialize_wssync_InitWorkspaceResponse,
    responseDeserialize: deserialize_wssync_InitWorkspaceResponse,
  },
  // WaitForInit waits until a workspace is fully initialized.
  // If the workspace is already initialized, this function returns immediately.
  // If there is no initialization is going on, an error is returned.
  waitForInit: {
    path: '/wssync.WorkspaceContentService/WaitForInit',
    requestStream: false,
    responseStream: false,
    requestType: wssync_pb.WaitForInitRequest,
    responseType: wssync_pb.WaitForInitResponse,
    requestSerialize: serialize_wssync_WaitForInitRequest,
    requestDeserialize: deserialize_wssync_WaitForInitRequest,
    responseSerialize: serialize_wssync_WaitForInitResponse,
    responseDeserialize: deserialize_wssync_WaitForInitResponse,
  },
  // TakeSnapshot creates a backup/snapshot of a workspace
  takeSnapshot: {
    path: '/wssync.WorkspaceContentService/TakeSnapshot',
    requestStream: false,
    responseStream: false,
    requestType: wssync_pb.TakeSnapshotRequest,
    responseType: wssync_pb.TakeSnapshotResponse,
    requestSerialize: serialize_wssync_TakeSnapshotRequest,
    requestDeserialize: deserialize_wssync_TakeSnapshotRequest,
    responseSerialize: serialize_wssync_TakeSnapshotResponse,
    responseDeserialize: deserialize_wssync_TakeSnapshotResponse,
  },
  // disposeWorkspace cleans up a workspace, possibly after taking a final backup
  disposeWorkspace: {
    path: '/wssync.WorkspaceContentService/DisposeWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: wssync_pb.DisposeWorkspaceRequest,
    responseType: wssync_pb.DisposeWorkspaceResponse,
    requestSerialize: serialize_wssync_DisposeWorkspaceRequest,
    requestDeserialize: deserialize_wssync_DisposeWorkspaceRequest,
    responseSerialize: serialize_wssync_DisposeWorkspaceResponse,
    responseDeserialize: deserialize_wssync_DisposeWorkspaceResponse,
  },
};

exports.WorkspaceContentServiceClient = grpc.makeGenericClientConstructor(WorkspaceContentServiceService);
