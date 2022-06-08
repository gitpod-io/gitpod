/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var gitpod_v1_workspaces_pb = require('../../gitpod/v1/workspaces_pb.js');
var google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');
var google_protobuf_field_mask_pb = require('google-protobuf/google/protobuf/field_mask_pb.js');
var gitpod_v1_pagination_pb = require('../../gitpod/v1/pagination_pb.js');

function serialize_gitpod_v1_CreateAndStartWorkspaceRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest)) {
    throw new Error('Expected argument of type gitpod.v1.CreateAndStartWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_CreateAndStartWorkspaceRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_CreateAndStartWorkspaceResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse)) {
    throw new Error('Expected argument of type gitpod.v1.CreateAndStartWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_CreateAndStartWorkspaceResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetActiveWorkspaceInstanceRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest)) {
    throw new Error('Expected argument of type gitpod.v1.GetActiveWorkspaceInstanceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetActiveWorkspaceInstanceRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetActiveWorkspaceInstanceResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse)) {
    throw new Error('Expected argument of type gitpod.v1.GetActiveWorkspaceInstanceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetActiveWorkspaceInstanceResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetOwnerTokenRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetOwnerTokenRequest)) {
    throw new Error('Expected argument of type gitpod.v1.GetOwnerTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetOwnerTokenRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetOwnerTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetOwnerTokenResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetOwnerTokenResponse)) {
    throw new Error('Expected argument of type gitpod.v1.GetOwnerTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetOwnerTokenResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetOwnerTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest)) {
    throw new Error('Expected argument of type gitpod.v1.GetWorkspaceInstanceOwnerTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse)) {
    throw new Error('Expected argument of type gitpod.v1.GetWorkspaceInstanceOwnerTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetWorkspaceRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetWorkspaceRequest)) {
    throw new Error('Expected argument of type gitpod.v1.GetWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetWorkspaceRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_GetWorkspaceResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.GetWorkspaceResponse)) {
    throw new Error('Expected argument of type gitpod.v1.GetWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_GetWorkspaceResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.GetWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListWorkspacesRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.ListWorkspacesRequest)) {
    throw new Error('Expected argument of type gitpod.v1.ListWorkspacesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListWorkspacesRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.ListWorkspacesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListWorkspacesResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.ListWorkspacesResponse)) {
    throw new Error('Expected argument of type gitpod.v1.ListWorkspacesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListWorkspacesResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.ListWorkspacesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListenToImageBuildLogsRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToImageBuildLogsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToImageBuildLogsRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListenToImageBuildLogsResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToImageBuildLogsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToImageBuildLogsResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListenToWorkspaceInstanceRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToWorkspaceInstanceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToWorkspaceInstanceRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_ListenToWorkspaceInstanceResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse)) {
    throw new Error('Expected argument of type gitpod.v1.ListenToWorkspaceInstanceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_ListenToWorkspaceInstanceResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_StartWorkspaceRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.StartWorkspaceRequest)) {
    throw new Error('Expected argument of type gitpod.v1.StartWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_StartWorkspaceRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.StartWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_StartWorkspaceResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.StartWorkspaceResponse)) {
    throw new Error('Expected argument of type gitpod.v1.StartWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_StartWorkspaceResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.StartWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_StopWorkspaceRequest(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.StopWorkspaceRequest)) {
    throw new Error('Expected argument of type gitpod.v1.StopWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_StopWorkspaceRequest(buffer_arg) {
  return gitpod_v1_workspaces_pb.StopWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_gitpod_v1_StopWorkspaceResponse(arg) {
  if (!(arg instanceof gitpod_v1_workspaces_pb.StopWorkspaceResponse)) {
    throw new Error('Expected argument of type gitpod.v1.StopWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_gitpod_v1_StopWorkspaceResponse(buffer_arg) {
  return gitpod_v1_workspaces_pb.StopWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WorkspacesServiceService = exports.WorkspacesServiceService = {
  // ListWorkspaces enumerates all workspaces belonging to the authenticated user.
listWorkspaces: {
    path: '/gitpod.v1.WorkspacesService/ListWorkspaces',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_workspaces_pb.ListWorkspacesRequest,
    responseType: gitpod_v1_workspaces_pb.ListWorkspacesResponse,
    requestSerialize: serialize_gitpod_v1_ListWorkspacesRequest,
    requestDeserialize: deserialize_gitpod_v1_ListWorkspacesRequest,
    responseSerialize: serialize_gitpod_v1_ListWorkspacesResponse,
    responseDeserialize: deserialize_gitpod_v1_ListWorkspacesResponse,
  },
  // GetWorkspace returns a single workspace.
getWorkspace: {
    path: '/gitpod.v1.WorkspacesService/GetWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_workspaces_pb.GetWorkspaceRequest,
    responseType: gitpod_v1_workspaces_pb.GetWorkspaceResponse,
    requestSerialize: serialize_gitpod_v1_GetWorkspaceRequest,
    requestDeserialize: deserialize_gitpod_v1_GetWorkspaceRequest,
    responseSerialize: serialize_gitpod_v1_GetWorkspaceResponse,
    responseDeserialize: deserialize_gitpod_v1_GetWorkspaceResponse,
  },
  // GetOwnerToken returns an owner token.
getOwnerToken: {
    path: '/gitpod.v1.WorkspacesService/GetOwnerToken',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_workspaces_pb.GetOwnerTokenRequest,
    responseType: gitpod_v1_workspaces_pb.GetOwnerTokenResponse,
    requestSerialize: serialize_gitpod_v1_GetOwnerTokenRequest,
    requestDeserialize: deserialize_gitpod_v1_GetOwnerTokenRequest,
    responseSerialize: serialize_gitpod_v1_GetOwnerTokenResponse,
    responseDeserialize: deserialize_gitpod_v1_GetOwnerTokenResponse,
  },
  // CreateAndStartWorkspace creates a new workspace and starts it.
createAndStartWorkspace: {
    path: '/gitpod.v1.WorkspacesService/CreateAndStartWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest,
    responseType: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse,
    requestSerialize: serialize_gitpod_v1_CreateAndStartWorkspaceRequest,
    requestDeserialize: deserialize_gitpod_v1_CreateAndStartWorkspaceRequest,
    responseSerialize: serialize_gitpod_v1_CreateAndStartWorkspaceResponse,
    responseDeserialize: deserialize_gitpod_v1_CreateAndStartWorkspaceResponse,
  },
  // StartWorkspace starts an existing workspace.
startWorkspace: {
    path: '/gitpod.v1.WorkspacesService/StartWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_workspaces_pb.StartWorkspaceRequest,
    responseType: gitpod_v1_workspaces_pb.StartWorkspaceResponse,
    requestSerialize: serialize_gitpod_v1_StartWorkspaceRequest,
    requestDeserialize: deserialize_gitpod_v1_StartWorkspaceRequest,
    responseSerialize: serialize_gitpod_v1_StartWorkspaceResponse,
    responseDeserialize: deserialize_gitpod_v1_StartWorkspaceResponse,
  },
  // GetRunningWorkspaceInstance returns the currently active instance of a workspace.
// Errors:
//   FAILED_PRECONDITION: if a workspace does not a currently active instance
//
getActiveWorkspaceInstance: {
    path: '/gitpod.v1.WorkspacesService/GetActiveWorkspaceInstance',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest,
    responseType: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse,
    requestSerialize: serialize_gitpod_v1_GetActiveWorkspaceInstanceRequest,
    requestDeserialize: deserialize_gitpod_v1_GetActiveWorkspaceInstanceRequest,
    responseSerialize: serialize_gitpod_v1_GetActiveWorkspaceInstanceResponse,
    responseDeserialize: deserialize_gitpod_v1_GetActiveWorkspaceInstanceResponse,
  },
  // GetWorkspaceInstanceOwnerToken returns the owner token of a workspace instance.
// Note: the owner token is not part of the workspace instance status so that we can scope its access on the
//       API function level.
getWorkspaceInstanceOwnerToken: {
    path: '/gitpod.v1.WorkspacesService/GetWorkspaceInstanceOwnerToken',
    requestStream: false,
    responseStream: false,
    requestType: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest,
    responseType: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse,
    requestSerialize: serialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenRequest,
    requestDeserialize: deserialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenRequest,
    responseSerialize: serialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenResponse,
    responseDeserialize: deserialize_gitpod_v1_GetWorkspaceInstanceOwnerTokenResponse,
  },
  // ListenToWorkspaceInstance listens to workspace instance updates.
listenToWorkspaceInstance: {
    path: '/gitpod.v1.WorkspacesService/ListenToWorkspaceInstance',
    requestStream: false,
    responseStream: true,
    requestType: gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest,
    responseType: gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse,
    requestSerialize: serialize_gitpod_v1_ListenToWorkspaceInstanceRequest,
    requestDeserialize: deserialize_gitpod_v1_ListenToWorkspaceInstanceRequest,
    responseSerialize: serialize_gitpod_v1_ListenToWorkspaceInstanceResponse,
    responseDeserialize: deserialize_gitpod_v1_ListenToWorkspaceInstanceResponse,
  },
  // ListenToImageBuildLogs streams (currently or previously) running workspace image build logs
listenToImageBuildLogs: {
    path: '/gitpod.v1.WorkspacesService/ListenToImageBuildLogs',
    requestStream: false,
    responseStream: true,
    requestType: gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest,
    responseType: gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse,
    requestSerialize: serialize_gitpod_v1_ListenToImageBuildLogsRequest,
    requestDeserialize: deserialize_gitpod_v1_ListenToImageBuildLogsRequest,
    responseSerialize: serialize_gitpod_v1_ListenToImageBuildLogsResponse,
    responseDeserialize: deserialize_gitpod_v1_ListenToImageBuildLogsResponse,
  },
  // StopWorkspace stops a running workspace (instance).
// Errors:
//   NOT_FOUND:           the workspace_id is unkown
//   FAILED_PRECONDITION: if there's no running instance
stopWorkspace: {
    path: '/gitpod.v1.WorkspacesService/StopWorkspace',
    requestStream: false,
    responseStream: true,
    requestType: gitpod_v1_workspaces_pb.StopWorkspaceRequest,
    responseType: gitpod_v1_workspaces_pb.StopWorkspaceResponse,
    requestSerialize: serialize_gitpod_v1_StopWorkspaceRequest,
    requestDeserialize: deserialize_gitpod_v1_StopWorkspaceRequest,
    responseSerialize: serialize_gitpod_v1_StopWorkspaceResponse,
    responseDeserialize: deserialize_gitpod_v1_StopWorkspaceResponse,
  },
};

exports.WorkspacesServiceClient = grpc.makeGenericClientConstructor(WorkspacesServiceService);
