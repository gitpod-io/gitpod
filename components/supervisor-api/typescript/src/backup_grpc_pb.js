// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var backup_pb = require('./backup_pb.js');

function serialize_supervisor_PrepareBackupRequest(arg) {
  if (!(arg instanceof backup_pb.PrepareBackupRequest)) {
    throw new Error('Expected argument of type supervisor.PrepareBackupRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_PrepareBackupRequest(buffer_arg) {
  return backup_pb.PrepareBackupRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_PrepareBackupResponse(arg) {
  if (!(arg instanceof backup_pb.PrepareBackupResponse)) {
    throw new Error('Expected argument of type supervisor.PrepareBackupResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_PrepareBackupResponse(buffer_arg) {
  return backup_pb.PrepareBackupResponse.deserializeBinary(new Uint8Array(buffer_arg));
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
    requestType: backup_pb.PrepareBackupRequest,
    responseType: backup_pb.PrepareBackupResponse,
    requestSerialize: serialize_supervisor_PrepareBackupRequest,
    requestDeserialize: deserialize_supervisor_PrepareBackupRequest,
    responseSerialize: serialize_supervisor_PrepareBackupResponse,
    responseDeserialize: deserialize_supervisor_PrepareBackupResponse,
  },
};

exports.BackupServiceClient = grpc.makeGenericClientConstructor(BackupServiceService);
