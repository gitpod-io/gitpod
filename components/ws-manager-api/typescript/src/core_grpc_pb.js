/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var core_pb = require('./core_pb.js');
var content$service$api_initializer_pb = require('@gitpod/content-service/lib');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');

function serialize_wsman_ControlAdmissionRequest(arg) {
  if (!(arg instanceof core_pb.ControlAdmissionRequest)) {
    throw new Error('Expected argument of type wsman.ControlAdmissionRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_ControlAdmissionRequest(buffer_arg) {
  return core_pb.ControlAdmissionRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_ControlAdmissionResponse(arg) {
  if (!(arg instanceof core_pb.ControlAdmissionResponse)) {
    throw new Error('Expected argument of type wsman.ControlAdmissionResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_ControlAdmissionResponse(buffer_arg) {
  return core_pb.ControlAdmissionResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_ControlPortRequest(arg) {
  if (!(arg instanceof core_pb.ControlPortRequest)) {
    throw new Error('Expected argument of type wsman.ControlPortRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_ControlPortRequest(buffer_arg) {
  return core_pb.ControlPortRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_ControlPortResponse(arg) {
  if (!(arg instanceof core_pb.ControlPortResponse)) {
    throw new Error('Expected argument of type wsman.ControlPortResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_ControlPortResponse(buffer_arg) {
  return core_pb.ControlPortResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_DescribeWorkspaceRequest(arg) {
  if (!(arg instanceof core_pb.DescribeWorkspaceRequest)) {
    throw new Error('Expected argument of type wsman.DescribeWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_DescribeWorkspaceRequest(buffer_arg) {
  return core_pb.DescribeWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_DescribeWorkspaceResponse(arg) {
  if (!(arg instanceof core_pb.DescribeWorkspaceResponse)) {
    throw new Error('Expected argument of type wsman.DescribeWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_DescribeWorkspaceResponse(buffer_arg) {
  return core_pb.DescribeWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_GetWorkspacesRequest(arg) {
  if (!(arg instanceof core_pb.GetWorkspacesRequest)) {
    throw new Error('Expected argument of type wsman.GetWorkspacesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_GetWorkspacesRequest(buffer_arg) {
  return core_pb.GetWorkspacesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_GetWorkspacesResponse(arg) {
  if (!(arg instanceof core_pb.GetWorkspacesResponse)) {
    throw new Error('Expected argument of type wsman.GetWorkspacesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_GetWorkspacesResponse(buffer_arg) {
  return core_pb.GetWorkspacesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_MarkActiveRequest(arg) {
  if (!(arg instanceof core_pb.MarkActiveRequest)) {
    throw new Error('Expected argument of type wsman.MarkActiveRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_MarkActiveRequest(buffer_arg) {
  return core_pb.MarkActiveRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_MarkActiveResponse(arg) {
  if (!(arg instanceof core_pb.MarkActiveResponse)) {
    throw new Error('Expected argument of type wsman.MarkActiveResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_MarkActiveResponse(buffer_arg) {
  return core_pb.MarkActiveResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_SetTimeoutRequest(arg) {
  if (!(arg instanceof core_pb.SetTimeoutRequest)) {
    throw new Error('Expected argument of type wsman.SetTimeoutRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_SetTimeoutRequest(buffer_arg) {
  return core_pb.SetTimeoutRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_SetTimeoutResponse(arg) {
  if (!(arg instanceof core_pb.SetTimeoutResponse)) {
    throw new Error('Expected argument of type wsman.SetTimeoutResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_SetTimeoutResponse(buffer_arg) {
  return core_pb.SetTimeoutResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_StartWorkspaceRequest(arg) {
  if (!(arg instanceof core_pb.StartWorkspaceRequest)) {
    throw new Error('Expected argument of type wsman.StartWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_StartWorkspaceRequest(buffer_arg) {
  return core_pb.StartWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_StartWorkspaceResponse(arg) {
  if (!(arg instanceof core_pb.StartWorkspaceResponse)) {
    throw new Error('Expected argument of type wsman.StartWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_StartWorkspaceResponse(buffer_arg) {
  return core_pb.StartWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_StopWorkspaceRequest(arg) {
  if (!(arg instanceof core_pb.StopWorkspaceRequest)) {
    throw new Error('Expected argument of type wsman.StopWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_StopWorkspaceRequest(buffer_arg) {
  return core_pb.StopWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_StopWorkspaceResponse(arg) {
  if (!(arg instanceof core_pb.StopWorkspaceResponse)) {
    throw new Error('Expected argument of type wsman.StopWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_StopWorkspaceResponse(buffer_arg) {
  return core_pb.StopWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_SubscribeRequest(arg) {
  if (!(arg instanceof core_pb.SubscribeRequest)) {
    throw new Error('Expected argument of type wsman.SubscribeRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_SubscribeRequest(buffer_arg) {
  return core_pb.SubscribeRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_SubscribeResponse(arg) {
  if (!(arg instanceof core_pb.SubscribeResponse)) {
    throw new Error('Expected argument of type wsman.SubscribeResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_SubscribeResponse(buffer_arg) {
  return core_pb.SubscribeResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_TakeSnapshotRequest(arg) {
  if (!(arg instanceof core_pb.TakeSnapshotRequest)) {
    throw new Error('Expected argument of type wsman.TakeSnapshotRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_TakeSnapshotRequest(buffer_arg) {
  return core_pb.TakeSnapshotRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsman_TakeSnapshotResponse(arg) {
  if (!(arg instanceof core_pb.TakeSnapshotResponse)) {
    throw new Error('Expected argument of type wsman.TakeSnapshotResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsman_TakeSnapshotResponse(buffer_arg) {
  return core_pb.TakeSnapshotResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WorkspaceManagerService = exports.WorkspaceManagerService = {
  // getWorkspaces produces a list of running workspaces and their status
getWorkspaces: {
    path: '/wsman.WorkspaceManager/GetWorkspaces',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.GetWorkspacesRequest,
    responseType: core_pb.GetWorkspacesResponse,
    requestSerialize: serialize_wsman_GetWorkspacesRequest,
    requestDeserialize: deserialize_wsman_GetWorkspacesRequest,
    responseSerialize: serialize_wsman_GetWorkspacesResponse,
    responseDeserialize: deserialize_wsman_GetWorkspacesResponse,
  },
  // startWorkspace creates a new running workspace within the manager's cluster
startWorkspace: {
    path: '/wsman.WorkspaceManager/StartWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.StartWorkspaceRequest,
    responseType: core_pb.StartWorkspaceResponse,
    requestSerialize: serialize_wsman_StartWorkspaceRequest,
    requestDeserialize: deserialize_wsman_StartWorkspaceRequest,
    responseSerialize: serialize_wsman_StartWorkspaceResponse,
    responseDeserialize: deserialize_wsman_StartWorkspaceResponse,
  },
  // stopWorkspace stops a running workspace
stopWorkspace: {
    path: '/wsman.WorkspaceManager/StopWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.StopWorkspaceRequest,
    responseType: core_pb.StopWorkspaceResponse,
    requestSerialize: serialize_wsman_StopWorkspaceRequest,
    requestDeserialize: deserialize_wsman_StopWorkspaceRequest,
    responseSerialize: serialize_wsman_StopWorkspaceResponse,
    responseDeserialize: deserialize_wsman_StopWorkspaceResponse,
  },
  // describeWorkspace investigates a workspace and returns its status, and configuration
describeWorkspace: {
    path: '/wsman.WorkspaceManager/DescribeWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.DescribeWorkspaceRequest,
    responseType: core_pb.DescribeWorkspaceResponse,
    requestSerialize: serialize_wsman_DescribeWorkspaceRequest,
    requestDeserialize: deserialize_wsman_DescribeWorkspaceRequest,
    responseSerialize: serialize_wsman_DescribeWorkspaceResponse,
    responseDeserialize: deserialize_wsman_DescribeWorkspaceResponse,
  },
  // subscribe streams all status updates to a client
subscribe: {
    path: '/wsman.WorkspaceManager/Subscribe',
    requestStream: false,
    responseStream: true,
    requestType: core_pb.SubscribeRequest,
    responseType: core_pb.SubscribeResponse,
    requestSerialize: serialize_wsman_SubscribeRequest,
    requestDeserialize: deserialize_wsman_SubscribeRequest,
    responseSerialize: serialize_wsman_SubscribeResponse,
    responseDeserialize: deserialize_wsman_SubscribeResponse,
  },
  // markActive records a workspace as being active which prevents it from timing out
markActive: {
    path: '/wsman.WorkspaceManager/MarkActive',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.MarkActiveRequest,
    responseType: core_pb.MarkActiveResponse,
    requestSerialize: serialize_wsman_MarkActiveRequest,
    requestDeserialize: deserialize_wsman_MarkActiveRequest,
    responseSerialize: serialize_wsman_MarkActiveResponse,
    responseDeserialize: deserialize_wsman_MarkActiveResponse,
  },
  // setTimeout changes the default timeout for a running workspace
setTimeout: {
    path: '/wsman.WorkspaceManager/SetTimeout',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.SetTimeoutRequest,
    responseType: core_pb.SetTimeoutResponse,
    requestSerialize: serialize_wsman_SetTimeoutRequest,
    requestDeserialize: deserialize_wsman_SetTimeoutRequest,
    responseSerialize: serialize_wsman_SetTimeoutResponse,
    responseDeserialize: deserialize_wsman_SetTimeoutResponse,
  },
  // controlPort publicly exposes or un-exposes a network port for a workspace
controlPort: {
    path: '/wsman.WorkspaceManager/ControlPort',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.ControlPortRequest,
    responseType: core_pb.ControlPortResponse,
    requestSerialize: serialize_wsman_ControlPortRequest,
    requestDeserialize: deserialize_wsman_ControlPortRequest,
    responseSerialize: serialize_wsman_ControlPortResponse,
    responseDeserialize: deserialize_wsman_ControlPortResponse,
  },
  // takeSnapshot creates a copy of the workspace content which can initialize a new workspace.
takeSnapshot: {
    path: '/wsman.WorkspaceManager/TakeSnapshot',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.TakeSnapshotRequest,
    responseType: core_pb.TakeSnapshotResponse,
    requestSerialize: serialize_wsman_TakeSnapshotRequest,
    requestDeserialize: deserialize_wsman_TakeSnapshotRequest,
    responseSerialize: serialize_wsman_TakeSnapshotResponse,
    responseDeserialize: deserialize_wsman_TakeSnapshotResponse,
  },
  // controlAdmission makes a workspace accessible for everyone or for the owner only
controlAdmission: {
    path: '/wsman.WorkspaceManager/ControlAdmission',
    requestStream: false,
    responseStream: false,
    requestType: core_pb.ControlAdmissionRequest,
    responseType: core_pb.ControlAdmissionResponse,
    requestSerialize: serialize_wsman_ControlAdmissionRequest,
    requestDeserialize: deserialize_wsman_ControlAdmissionRequest,
    responseSerialize: serialize_wsman_ControlAdmissionResponse,
    responseDeserialize: deserialize_wsman_ControlAdmissionResponse,
  },
};

exports.WorkspaceManagerClient = grpc.makeGenericClientConstructor(WorkspaceManagerService);
