/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var supervisor_pb = require('./supervisor_pb.js');
var google_api_annotations_pb = require('./google/api/annotations_pb.js');

function serialize_supervisor_ContentStatusRequest(arg) {
  if (!(arg instanceof supervisor_pb.ContentStatusRequest)) {
    throw new Error('Expected argument of type supervisor.ContentStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ContentStatusRequest(buffer_arg) {
  return supervisor_pb.ContentStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ContentStatusResponse(arg) {
  if (!(arg instanceof supervisor_pb.ContentStatusResponse)) {
    throw new Error('Expected argument of type supervisor.ContentStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ContentStatusResponse(buffer_arg) {
  return supervisor_pb.ContentStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_DebugPauseTheiaRequest(arg) {
  if (!(arg instanceof supervisor_pb.DebugPauseTheiaRequest)) {
    throw new Error('Expected argument of type supervisor.DebugPauseTheiaRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_DebugPauseTheiaRequest(buffer_arg) {
  return supervisor_pb.DebugPauseTheiaRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_DebugPauseTheiaResponse(arg) {
  if (!(arg instanceof supervisor_pb.DebugPauseTheiaResponse)) {
    throw new Error('Expected argument of type supervisor.DebugPauseTheiaResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_DebugPauseTheiaResponse(buffer_arg) {
  return supervisor_pb.DebugPauseTheiaResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_PrepareBackupRequest(arg) {
  if (!(arg instanceof supervisor_pb.PrepareBackupRequest)) {
    throw new Error('Expected argument of type supervisor.PrepareBackupRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_PrepareBackupRequest(buffer_arg) {
  return supervisor_pb.PrepareBackupRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_PrepareBackupResponse(arg) {
  if (!(arg instanceof supervisor_pb.PrepareBackupResponse)) {
    throw new Error('Expected argument of type supervisor.PrepareBackupResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_PrepareBackupResponse(buffer_arg) {
  return supervisor_pb.PrepareBackupResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_StatusRequest(arg) {
  if (!(arg instanceof supervisor_pb.StatusRequest)) {
    throw new Error('Expected argument of type supervisor.StatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_StatusRequest(buffer_arg) {
  return supervisor_pb.StatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_StatusResponse(arg) {
  if (!(arg instanceof supervisor_pb.StatusResponse)) {
    throw new Error('Expected argument of type supervisor.StatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_StatusResponse(buffer_arg) {
  return supervisor_pb.StatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// BackupService provides workspace-facing, backup related services
var BackupServiceService = exports.BackupServiceService = {
  // Prepare prepares a workspace backup and is intended to be called by the PreStop
  // hook of the container. It should hardly ever be neccesary to call this from any
  // other point.
  prepare: {
    path: '/supervisor.BackupService/Prepare',
    requestStream: false,
    responseStream: false,
    requestType: supervisor_pb.PrepareBackupRequest,
    responseType: supervisor_pb.PrepareBackupResponse,
    requestSerialize: serialize_supervisor_PrepareBackupRequest,
    requestDeserialize: deserialize_supervisor_PrepareBackupRequest,
    responseSerialize: serialize_supervisor_PrepareBackupResponse,
    responseDeserialize: deserialize_supervisor_PrepareBackupResponse,
  },
  // Status offers feedback on the workspace backup status. This status information can
  // be relayed to the user to provide transparency as to how "safe" their files/content
  // data are w.r.t. to being lost.
  status: {
    path: '/supervisor.BackupService/Status',
    requestStream: false,
    responseStream: false,
    requestType: supervisor_pb.StatusRequest,
    responseType: supervisor_pb.StatusResponse,
    requestSerialize: serialize_supervisor_StatusRequest,
    requestDeserialize: deserialize_supervisor_StatusRequest,
    responseSerialize: serialize_supervisor_StatusResponse,
    responseDeserialize: deserialize_supervisor_StatusResponse,
  },
  // DebugPauseTheia is just for demo purpose and will be removed.
  debugPauseTheia: {
    path: '/supervisor.BackupService/DebugPauseTheia',
    requestStream: false,
    responseStream: false,
    requestType: supervisor_pb.DebugPauseTheiaRequest,
    responseType: supervisor_pb.DebugPauseTheiaResponse,
    requestSerialize: serialize_supervisor_DebugPauseTheiaRequest,
    requestDeserialize: deserialize_supervisor_DebugPauseTheiaRequest,
    responseSerialize: serialize_supervisor_DebugPauseTheiaResponse,
    responseDeserialize: deserialize_supervisor_DebugPauseTheiaResponse,
  },
  // ContentStatus returns the status of the workspace content
  contentStatus: {
    path: '/supervisor.BackupService/ContentStatus',
    requestStream: false,
    responseStream: false,
    requestType: supervisor_pb.ContentStatusRequest,
    responseType: supervisor_pb.ContentStatusResponse,
    requestSerialize: serialize_supervisor_ContentStatusRequest,
    requestDeserialize: deserialize_supervisor_ContentStatusRequest,
    responseSerialize: serialize_supervisor_ContentStatusResponse,
    responseDeserialize: deserialize_supervisor_ContentStatusResponse,
  },
};

exports.BackupServiceClient = grpc.makeGenericClientConstructor(BackupServiceService);
