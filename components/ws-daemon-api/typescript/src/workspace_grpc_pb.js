/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var workspace_pb = require('./workspace_pb.js');

function serialize_iws_MountProcRequest(arg) {
  if (!(arg instanceof workspace_pb.MountProcRequest)) {
    throw new Error('Expected argument of type iws.MountProcRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_MountProcRequest(buffer_arg) {
  return workspace_pb.MountProcRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_MountProcResponse(arg) {
  if (!(arg instanceof workspace_pb.MountProcResponse)) {
    throw new Error('Expected argument of type iws.MountProcResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_MountProcResponse(buffer_arg) {
  return workspace_pb.MountProcResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_PrepareForUserNSRequest(arg) {
  if (!(arg instanceof workspace_pb.PrepareForUserNSRequest)) {
    throw new Error('Expected argument of type iws.PrepareForUserNSRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_PrepareForUserNSRequest(buffer_arg) {
  return workspace_pb.PrepareForUserNSRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_PrepareForUserNSResponse(arg) {
  if (!(arg instanceof workspace_pb.PrepareForUserNSResponse)) {
    throw new Error('Expected argument of type iws.PrepareForUserNSResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_PrepareForUserNSResponse(buffer_arg) {
  return workspace_pb.PrepareForUserNSResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_TeardownRequest(arg) {
  if (!(arg instanceof workspace_pb.TeardownRequest)) {
    throw new Error('Expected argument of type iws.TeardownRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_TeardownRequest(buffer_arg) {
  return workspace_pb.TeardownRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_TeardownResponse(arg) {
  if (!(arg instanceof workspace_pb.TeardownResponse)) {
    throw new Error('Expected argument of type iws.TeardownResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_TeardownResponse(buffer_arg) {
  return workspace_pb.TeardownResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_WriteIDMappingRequest(arg) {
  if (!(arg instanceof workspace_pb.WriteIDMappingRequest)) {
    throw new Error('Expected argument of type iws.WriteIDMappingRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_WriteIDMappingRequest(buffer_arg) {
  return workspace_pb.WriteIDMappingRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_WriteIDMappingResponse(arg) {
  if (!(arg instanceof workspace_pb.WriteIDMappingResponse)) {
    throw new Error('Expected argument of type iws.WriteIDMappingResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_WriteIDMappingResponse(buffer_arg) {
  return workspace_pb.WriteIDMappingResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var InWorkspaceServiceService = exports.InWorkspaceServiceService = {
  // PrepareForUserNS prepares a workspace container for wrapping it in a user namespace.
// A container that called this function MUST call Teardown.
//
// This call will make the workspace container's rootfs shared, and mount the workspace
// container's rootfs as a shiftfs mark under `/.workspace/mark` if the workspace has
// the daemon hostPath mount. Can only be used once per workspace.
prepareForUserNS: {
    path: '/iws.InWorkspaceService/PrepareForUserNS',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.PrepareForUserNSRequest,
    responseType: workspace_pb.PrepareForUserNSResponse,
    requestSerialize: serialize_iws_PrepareForUserNSRequest,
    requestDeserialize: deserialize_iws_PrepareForUserNSRequest,
    responseSerialize: serialize_iws_PrepareForUserNSResponse,
    responseDeserialize: deserialize_iws_PrepareForUserNSResponse,
  },
  // WriteIDMapping writes a new user/group ID mapping to /proc/<pid>/uid_map (gid_map respectively). This is used
// for user namespaces and is available four times every 10 seconds.
writeIDMapping: {
    path: '/iws.InWorkspaceService/WriteIDMapping',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.WriteIDMappingRequest,
    responseType: workspace_pb.WriteIDMappingResponse,
    requestSerialize: serialize_iws_WriteIDMappingRequest,
    requestDeserialize: deserialize_iws_WriteIDMappingRequest,
    responseSerialize: serialize_iws_WriteIDMappingResponse,
    responseDeserialize: deserialize_iws_WriteIDMappingResponse,
  },
  // MountProc mounts a masked proc in the container's rootfs.
// For now this can be used only once per workspace.
mountProc: {
    path: '/iws.InWorkspaceService/MountProc',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.MountProcRequest,
    responseType: workspace_pb.MountProcResponse,
    requestSerialize: serialize_iws_MountProcRequest,
    requestDeserialize: deserialize_iws_MountProcRequest,
    responseSerialize: serialize_iws_MountProcResponse,
    responseDeserialize: deserialize_iws_MountProcResponse,
  },
  // Teardown prepares workspace content backups and unmounts shiftfs mounts. The canary is supposed to be triggered
// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
teardown: {
    path: '/iws.InWorkspaceService/Teardown',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.TeardownRequest,
    responseType: workspace_pb.TeardownResponse,
    requestSerialize: serialize_iws_TeardownRequest,
    requestDeserialize: deserialize_iws_TeardownRequest,
    responseSerialize: serialize_iws_TeardownResponse,
    responseDeserialize: deserialize_iws_TeardownResponse,
  },
};

exports.InWorkspaceServiceClient = grpc.makeGenericClientConstructor(InWorkspaceServiceService);
