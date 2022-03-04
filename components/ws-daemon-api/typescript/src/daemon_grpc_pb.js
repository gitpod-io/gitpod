/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var daemon_pb = require('./daemon_pb.js');
var content$service$api_initializer_pb = require('@gitpod/content-service/lib');

function serialize_wsdaemon_BackupWorkspaceRequest(arg) {
  if (!(arg instanceof daemon_pb.BackupWorkspaceRequest)) {
    throw new Error('Expected argument of type wsdaemon.BackupWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_BackupWorkspaceRequest(buffer_arg) {
  return daemon_pb.BackupWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_BackupWorkspaceResponse(arg) {
  if (!(arg instanceof daemon_pb.BackupWorkspaceResponse)) {
    throw new Error('Expected argument of type wsdaemon.BackupWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_BackupWorkspaceResponse(buffer_arg) {
  return daemon_pb.BackupWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_DisposeWorkspaceRequest(arg) {
  if (!(arg instanceof daemon_pb.DisposeWorkspaceRequest)) {
    throw new Error('Expected argument of type wsdaemon.DisposeWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_DisposeWorkspaceRequest(buffer_arg) {
  return daemon_pb.DisposeWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_DisposeWorkspaceResponse(arg) {
  if (!(arg instanceof daemon_pb.DisposeWorkspaceResponse)) {
    throw new Error('Expected argument of type wsdaemon.DisposeWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_DisposeWorkspaceResponse(buffer_arg) {
  return daemon_pb.DisposeWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_InitWorkspaceRequest(arg) {
  if (!(arg instanceof daemon_pb.InitWorkspaceRequest)) {
    throw new Error('Expected argument of type wsdaemon.InitWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_InitWorkspaceRequest(buffer_arg) {
  return daemon_pb.InitWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_InitWorkspaceResponse(arg) {
  if (!(arg instanceof daemon_pb.InitWorkspaceResponse)) {
    throw new Error('Expected argument of type wsdaemon.InitWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_InitWorkspaceResponse(buffer_arg) {
  return daemon_pb.InitWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_TakeSnapshotRequest(arg) {
  if (!(arg instanceof daemon_pb.TakeSnapshotRequest)) {
    throw new Error('Expected argument of type wsdaemon.TakeSnapshotRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_TakeSnapshotRequest(buffer_arg) {
  return daemon_pb.TakeSnapshotRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_TakeSnapshotResponse(arg) {
  if (!(arg instanceof daemon_pb.TakeSnapshotResponse)) {
    throw new Error('Expected argument of type wsdaemon.TakeSnapshotResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_TakeSnapshotResponse(buffer_arg) {
  return daemon_pb.TakeSnapshotResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_WaitForInitRequest(arg) {
  if (!(arg instanceof daemon_pb.WaitForInitRequest)) {
    throw new Error('Expected argument of type wsdaemon.WaitForInitRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_WaitForInitRequest(buffer_arg) {
  return daemon_pb.WaitForInitRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsdaemon_WaitForInitResponse(arg) {
  if (!(arg instanceof daemon_pb.WaitForInitResponse)) {
    throw new Error('Expected argument of type wsdaemon.WaitForInitResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsdaemon_WaitForInitResponse(buffer_arg) {
  return daemon_pb.WaitForInitResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WorkspaceContentServiceService = exports.WorkspaceContentServiceService = {
  // initWorkspace intialises a new workspace folder in the working area
initWorkspace: {
    path: '/wsdaemon.WorkspaceContentService/InitWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: daemon_pb.InitWorkspaceRequest,
    responseType: daemon_pb.InitWorkspaceResponse,
    requestSerialize: serialize_wsdaemon_InitWorkspaceRequest,
    requestDeserialize: deserialize_wsdaemon_InitWorkspaceRequest,
    responseSerialize: serialize_wsdaemon_InitWorkspaceResponse,
    responseDeserialize: deserialize_wsdaemon_InitWorkspaceResponse,
  },
  // WaitForInit waits until a workspace is fully initialized.
// If the workspace is already initialized, this function returns immediately.
// If there is no initialization is going on, an error is returned.
waitForInit: {
    path: '/wsdaemon.WorkspaceContentService/WaitForInit',
    requestStream: false,
    responseStream: false,
    requestType: daemon_pb.WaitForInitRequest,
    responseType: daemon_pb.WaitForInitResponse,
    requestSerialize: serialize_wsdaemon_WaitForInitRequest,
    requestDeserialize: deserialize_wsdaemon_WaitForInitRequest,
    responseSerialize: serialize_wsdaemon_WaitForInitResponse,
    responseDeserialize: deserialize_wsdaemon_WaitForInitResponse,
  },
  // TakeSnapshot creates a backup/snapshot of a workspace
takeSnapshot: {
    path: '/wsdaemon.WorkspaceContentService/TakeSnapshot',
    requestStream: false,
    responseStream: false,
    requestType: daemon_pb.TakeSnapshotRequest,
    responseType: daemon_pb.TakeSnapshotResponse,
    requestSerialize: serialize_wsdaemon_TakeSnapshotRequest,
    requestDeserialize: deserialize_wsdaemon_TakeSnapshotRequest,
    responseSerialize: serialize_wsdaemon_TakeSnapshotResponse,
    responseDeserialize: deserialize_wsdaemon_TakeSnapshotResponse,
  },
  // disposeWorkspace cleans up a workspace, possibly after taking a final backup
disposeWorkspace: {
    path: '/wsdaemon.WorkspaceContentService/DisposeWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: daemon_pb.DisposeWorkspaceRequest,
    responseType: daemon_pb.DisposeWorkspaceResponse,
    requestSerialize: serialize_wsdaemon_DisposeWorkspaceRequest,
    requestDeserialize: deserialize_wsdaemon_DisposeWorkspaceRequest,
    responseSerialize: serialize_wsdaemon_DisposeWorkspaceResponse,
    responseDeserialize: deserialize_wsdaemon_DisposeWorkspaceResponse,
  },
  // BackupWorkspace creates a backup of a workspace
backupWorkspace: {
    path: '/wsdaemon.WorkspaceContentService/BackupWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: daemon_pb.BackupWorkspaceRequest,
    responseType: daemon_pb.BackupWorkspaceResponse,
    requestSerialize: serialize_wsdaemon_BackupWorkspaceRequest,
    requestDeserialize: deserialize_wsdaemon_BackupWorkspaceRequest,
    responseSerialize: serialize_wsdaemon_BackupWorkspaceResponse,
    responseDeserialize: deserialize_wsdaemon_BackupWorkspaceResponse,
  },
};

exports.WorkspaceContentServiceClient = grpc.makeGenericClientConstructor(WorkspaceContentServiceService);
