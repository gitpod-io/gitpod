// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var status_pb = require('./status_pb.js');

function serialize_supervisor_BackupStatusRequest(arg) {
  if (!(arg instanceof status_pb.BackupStatusRequest)) {
    throw new Error('Expected argument of type supervisor.BackupStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_BackupStatusRequest(buffer_arg) {
  return status_pb.BackupStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_BackupStatusResponse(arg) {
  if (!(arg instanceof status_pb.BackupStatusResponse)) {
    throw new Error('Expected argument of type supervisor.BackupStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_BackupStatusResponse(buffer_arg) {
  return status_pb.BackupStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ContentStatusRequest(arg) {
  if (!(arg instanceof status_pb.ContentStatusRequest)) {
    throw new Error('Expected argument of type supervisor.ContentStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ContentStatusRequest(buffer_arg) {
  return status_pb.ContentStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_ContentStatusResponse(arg) {
  if (!(arg instanceof status_pb.ContentStatusResponse)) {
    throw new Error('Expected argument of type supervisor.ContentStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_ContentStatusResponse(buffer_arg) {
  return status_pb.ContentStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_IDEStatusRequest(arg) {
  if (!(arg instanceof status_pb.IDEStatusRequest)) {
    throw new Error('Expected argument of type supervisor.IDEStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_IDEStatusRequest(buffer_arg) {
  return status_pb.IDEStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_IDEStatusResponse(arg) {
  if (!(arg instanceof status_pb.IDEStatusResponse)) {
    throw new Error('Expected argument of type supervisor.IDEStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_IDEStatusResponse(buffer_arg) {
  return status_pb.IDEStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_PortsStatusRequest(arg) {
  if (!(arg instanceof status_pb.PortsStatusRequest)) {
    throw new Error('Expected argument of type supervisor.PortsStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_PortsStatusRequest(buffer_arg) {
  return status_pb.PortsStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_PortsStatusResponse(arg) {
  if (!(arg instanceof status_pb.PortsStatusResponse)) {
    throw new Error('Expected argument of type supervisor.PortsStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_PortsStatusResponse(buffer_arg) {
  return status_pb.PortsStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SupervisorStatusRequest(arg) {
  if (!(arg instanceof status_pb.SupervisorStatusRequest)) {
    throw new Error('Expected argument of type supervisor.SupervisorStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SupervisorStatusRequest(buffer_arg) {
  return status_pb.SupervisorStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_supervisor_SupervisorStatusResponse(arg) {
  if (!(arg instanceof status_pb.SupervisorStatusResponse)) {
    throw new Error('Expected argument of type supervisor.SupervisorStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_supervisor_SupervisorStatusResponse(buffer_arg) {
  return status_pb.SupervisorStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// StatusService provides status feedback for the various in-workspace services.
var StatusServiceService = exports.StatusServiceService = {
  // SupervisorStatus returns once supervisor is running.
supervisorStatus: {
    path: '/supervisor.StatusService/SupervisorStatus',
    requestStream: false,
    responseStream: false,
    requestType: status_pb.SupervisorStatusRequest,
    responseType: status_pb.SupervisorStatusResponse,
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
    requestType: status_pb.IDEStatusRequest,
    responseType: status_pb.IDEStatusResponse,
    requestSerialize: serialize_supervisor_IDEStatusRequest,
    requestDeserialize: deserialize_supervisor_IDEStatusRequest,
    responseSerialize: serialize_supervisor_IDEStatusResponse,
    responseDeserialize: deserialize_supervisor_IDEStatusResponse,
  },
  // ContentStatus returns the status of the workspace content. When used with `wait`, the call
// returns when the content has become available.
contentStatus: {
    path: '/supervisor.StatusService/ContentStatus',
    requestStream: false,
    responseStream: false,
    requestType: status_pb.ContentStatusRequest,
    responseType: status_pb.ContentStatusResponse,
    requestSerialize: serialize_supervisor_ContentStatusRequest,
    requestDeserialize: deserialize_supervisor_ContentStatusRequest,
    responseSerialize: serialize_supervisor_ContentStatusResponse,
    responseDeserialize: deserialize_supervisor_ContentStatusResponse,
  },
  // BackupStatus offers feedback on the workspace backup status. This status information can
// be relayed to the user to provide transparency as to how "safe" their files/content
// data are w.r.t. to being lost.
backupStatus: {
    path: '/supervisor.StatusService/BackupStatus',
    requestStream: false,
    responseStream: false,
    requestType: status_pb.BackupStatusRequest,
    responseType: status_pb.BackupStatusResponse,
    requestSerialize: serialize_supervisor_BackupStatusRequest,
    requestDeserialize: deserialize_supervisor_BackupStatusRequest,
    responseSerialize: serialize_supervisor_BackupStatusResponse,
    responseDeserialize: deserialize_supervisor_BackupStatusResponse,
  },
  // PortsStatus provides feedback about the network ports currently in use.
portsStatus: {
    path: '/supervisor.StatusService/PortsStatus',
    requestStream: false,
    responseStream: true,
    requestType: status_pb.PortsStatusRequest,
    responseType: status_pb.PortsStatusResponse,
    requestSerialize: serialize_supervisor_PortsStatusRequest,
    requestDeserialize: deserialize_supervisor_PortsStatusRequest,
    responseSerialize: serialize_supervisor_PortsStatusResponse,
    responseDeserialize: deserialize_supervisor_PortsStatusResponse,
  },
};

exports.StatusServiceClient = grpc.makeGenericClientConstructor(StatusServiceService);
