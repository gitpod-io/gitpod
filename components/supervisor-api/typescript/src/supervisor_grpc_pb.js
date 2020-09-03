// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var supervisor_pb = require('./supervisor_pb.js');
var google_api_annotations_pb = require('./google/api/annotations_pb.js');

function serialize_supervisor_BackupStatusRequest(arg) {
  if (!(arg instanceof supervisor_pb.BackupStatusRequest)) {
    throw new Error('Expected argument of type supervisor.BackupStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_BackupStatusRequest(buffer_arg) {
  return supervisor_pb.BackupStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_BackupStatusResponse(arg) {
  if (!(arg instanceof supervisor_pb.BackupStatusResponse)) {
    throw new Error('Expected argument of type supervisor.BackupStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_BackupStatusResponse(buffer_arg) {
  return supervisor_pb.BackupStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

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

function serialize_supervisor_IDEStatusRequest(arg) {
  if (!(arg instanceof supervisor_pb.IDEStatusRequest)) {
    throw new Error('Expected argument of type supervisor.IDEStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_IDEStatusRequest(buffer_arg) {
  return supervisor_pb.IDEStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_IDEStatusResponse(arg) {
  if (!(arg instanceof supervisor_pb.IDEStatusResponse)) {
    throw new Error('Expected argument of type supervisor.IDEStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_IDEStatusResponse(buffer_arg) {
  return supervisor_pb.IDEStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
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

function serialize_supervisor_SupervisorStatusRequest(arg) {
  if (!(arg instanceof supervisor_pb.SupervisorStatusRequest)) {
    throw new Error('Expected argument of type supervisor.SupervisorStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SupervisorStatusRequest(buffer_arg) {
  return supervisor_pb.SupervisorStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SupervisorStatusResponse(arg) {
  if (!(arg instanceof supervisor_pb.SupervisorStatusResponse)) {
    throw new Error('Expected argument of type supervisor.SupervisorStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SupervisorStatusResponse(buffer_arg) {
  return supervisor_pb.SupervisorStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
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
};

exports.BackupServiceClient = grpc.makeGenericClientConstructor(BackupServiceService);
// StatusService provides status feedback for the various in-workspace services.
var StatusServiceService = exports.StatusServiceService = {
  // SupervisorStatus returns once supervisor is running.
  supervisorStatus: {
    path: '/supervisor.StatusService/SupervisorStatus',
    requestStream: false,
    responseStream: false,
    requestType: supervisor_pb.SupervisorStatusRequest,
    responseType: supervisor_pb.SupervisorStatusResponse,
    requestSerialize: serialize_supervisor_SupervisorStatusRequest,
    requestDeserialize: deserialize_supervisor_SupervisorStatusRequest,
    responseSerialize: serialize_supervisor_SupervisorStatusResponse,
    responseDeserialize: deserialize_supervisor_SupervisorStatusResponse,
  },
  // IDEStatus returns OK if the IDE can serve requests.
  iDEStatus: {
    path: '/supervisor.StatusService/IDEStatus',
    requestStream: false,
    responseStream: false,
    requestType: supervisor_pb.IDEStatusRequest,
    responseType: supervisor_pb.IDEStatusResponse,
    requestSerialize: serialize_supervisor_IDEStatusRequest,
    requestDeserialize: deserialize_supervisor_IDEStatusRequest,
    responseSerialize: serialize_supervisor_IDEStatusResponse,
    responseDeserialize: deserialize_supervisor_IDEStatusResponse,
  },
  // BackupStatus offers feedback on the workspace backup status. This status information can
  // be relayed to the user to provide transparency as to how "safe" their files/content
  // data are w.r.t. to being lost.
  backupStatus: {
    path: '/supervisor.StatusService/BackupStatus',
    requestStream: false,
    responseStream: false,
    requestType: supervisor_pb.BackupStatusRequest,
    responseType: supervisor_pb.BackupStatusResponse,
    requestSerialize: serialize_supervisor_BackupStatusRequest,
    requestDeserialize: deserialize_supervisor_BackupStatusRequest,
    responseSerialize: serialize_supervisor_BackupStatusResponse,
    responseDeserialize: deserialize_supervisor_BackupStatusResponse,
  },
  // ContentStatus returns the status of the workspace content. When used with `wait`, the call
  // returns when the content has become available.
  contentStatus: {
    path: '/supervisor.StatusService/ContentStatus',
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

exports.StatusServiceClient = grpc.makeGenericClientConstructor(StatusServiceService);
