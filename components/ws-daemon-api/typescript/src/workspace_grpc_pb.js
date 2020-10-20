/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var workspace_pb = require('./workspace_pb.js');
var content$service$api_initializer_pb = require('@gitpod/content-service/lib');

function serialize_wsbs_GitStatusRequest(arg) {
  if (!(arg instanceof workspace_pb.GitStatusRequest)) {
    throw new Error('Expected argument of type wsbs.GitStatusRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_GitStatusRequest(buffer_arg) {
  return workspace_pb.GitStatusRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_GitStatusResponse(arg) {
  if (!(arg instanceof workspace_pb.GitStatusResponse)) {
    throw new Error('Expected argument of type wsbs.GitStatusResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_GitStatusResponse(buffer_arg) {
  return workspace_pb.GitStatusResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_MountShiftfsMarkRequest(arg) {
  if (!(arg instanceof workspace_pb.MountShiftfsMarkRequest)) {
    throw new Error('Expected argument of type wsbs.MountShiftfsMarkRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_MountShiftfsMarkRequest(buffer_arg) {
  return workspace_pb.MountShiftfsMarkRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_MountShiftfsMarkResponse(arg) {
  if (!(arg instanceof workspace_pb.MountShiftfsMarkResponse)) {
    throw new Error('Expected argument of type wsbs.MountShiftfsMarkResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_MountShiftfsMarkResponse(buffer_arg) {
  return workspace_pb.MountShiftfsMarkResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_PauseTheiaRequest(arg) {
  if (!(arg instanceof workspace_pb.PauseTheiaRequest)) {
    throw new Error('Expected argument of type wsbs.PauseTheiaRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_PauseTheiaRequest(buffer_arg) {
  return workspace_pb.PauseTheiaRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_PauseTheiaResponse(arg) {
  if (!(arg instanceof workspace_pb.PauseTheiaResponse)) {
    throw new Error('Expected argument of type wsbs.PauseTheiaResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_PauseTheiaResponse(buffer_arg) {
  return workspace_pb.PauseTheiaResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_TeardownRequest(arg) {
  if (!(arg instanceof workspace_pb.TeardownRequest)) {
    throw new Error('Expected argument of type wsbs.TeardownRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_TeardownRequest(buffer_arg) {
  return workspace_pb.TeardownRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_TeardownResponse(arg) {
  if (!(arg instanceof workspace_pb.TeardownResponse)) {
    throw new Error('Expected argument of type wsbs.TeardownResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_TeardownResponse(buffer_arg) {
  return workspace_pb.TeardownResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_UidmapCanaryRequest(arg) {
  if (!(arg instanceof workspace_pb.UidmapCanaryRequest)) {
    throw new Error('Expected argument of type wsbs.UidmapCanaryRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_UidmapCanaryRequest(buffer_arg) {
  return workspace_pb.UidmapCanaryRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_wsbs_UidmapCanaryResponse(arg) {
  if (!(arg instanceof workspace_pb.UidmapCanaryResponse)) {
    throw new Error('Expected argument of type wsbs.UidmapCanaryResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_wsbs_UidmapCanaryResponse(buffer_arg) {
  return workspace_pb.UidmapCanaryResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var InWorkspaceHelperService = exports.InWorkspaceHelperService = {
  mountShiftfsMark: {
    path: '/wsbs.InWorkspaceHelper/MountShiftfsMark',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.MountShiftfsMarkRequest,
    responseType: workspace_pb.MountShiftfsMarkResponse,
    requestSerialize: serialize_wsbs_MountShiftfsMarkRequest,
    requestDeserialize: deserialize_wsbs_MountShiftfsMarkRequest,
    responseSerialize: serialize_wsbs_MountShiftfsMarkResponse,
    responseDeserialize: deserialize_wsbs_MountShiftfsMarkResponse,
  },
  teardown: {
    path: '/wsbs.InWorkspaceHelper/Teardown',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.TeardownRequest,
    responseType: workspace_pb.TeardownResponse,
    requestSerialize: serialize_wsbs_TeardownRequest,
    requestDeserialize: deserialize_wsbs_TeardownRequest,
    responseSerialize: serialize_wsbs_TeardownResponse,
    responseDeserialize: deserialize_wsbs_TeardownResponse,
  },
  pauseTheiaCanary: {
    path: '/wsbs.InWorkspaceHelper/PauseTheiaCanary',
    requestStream: true,
    responseStream: true,
    requestType: workspace_pb.PauseTheiaResponse,
    responseType: workspace_pb.PauseTheiaRequest,
    requestSerialize: serialize_wsbs_PauseTheiaResponse,
    requestDeserialize: deserialize_wsbs_PauseTheiaResponse,
    responseSerialize: serialize_wsbs_PauseTheiaRequest,
    responseDeserialize: deserialize_wsbs_PauseTheiaRequest,
  },
  gitStatusCanary: {
    path: '/wsbs.InWorkspaceHelper/GitStatusCanary',
    requestStream: true,
    responseStream: true,
    requestType: workspace_pb.GitStatusResponse,
    responseType: workspace_pb.GitStatusRequest,
    requestSerialize: serialize_wsbs_GitStatusResponse,
    requestDeserialize: deserialize_wsbs_GitStatusResponse,
    responseSerialize: serialize_wsbs_GitStatusRequest,
    responseDeserialize: deserialize_wsbs_GitStatusRequest,
  },
  writeIDMapping: {
    path: '/wsbs.InWorkspaceHelper/WriteIDMapping',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.UidmapCanaryRequest,
    responseType: workspace_pb.UidmapCanaryResponse,
    requestSerialize: serialize_wsbs_UidmapCanaryRequest,
    requestDeserialize: deserialize_wsbs_UidmapCanaryRequest,
    responseSerialize: serialize_wsbs_UidmapCanaryResponse,
    responseDeserialize: deserialize_wsbs_UidmapCanaryResponse,
  },
};

exports.InWorkspaceHelperClient = grpc.makeGenericClientConstructor(InWorkspaceHelperService);
var InWorkspaceHelperOldService = exports.InWorkspaceHelperOldService = {
  // Teardown prepares workspace content backups and unmounts shiftfs mounts. The canary is supposed to be triggered
// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
//
// Note that the request/response flow is inverted here, as it's the server (supervisor) which requests the teardown
// from the client (ws-daemon).
teardownCanary: {
    path: '/wsbs.InWorkspaceHelperOld/TeardownCanary',
    requestStream: true,
    responseStream: true,
    requestType: workspace_pb.TeardownResponse,
    responseType: workspace_pb.TeardownRequest,
    requestSerialize: serialize_wsbs_TeardownResponse,
    requestDeserialize: deserialize_wsbs_TeardownResponse,
    responseSerialize: serialize_wsbs_TeardownRequest,
    responseDeserialize: deserialize_wsbs_TeardownRequest,
  },
  // PauseTheia can pause the Theia process and all its children. As long as the request stream
// is held Theia will be paused.
// This is a stop-the-world mechanism for preventing concurrent modification during backup.
pauseTheia: {
    path: '/wsbs.InWorkspaceHelperOld/PauseTheia',
    requestStream: true,
    responseStream: false,
    requestType: workspace_pb.PauseTheiaRequest,
    responseType: workspace_pb.PauseTheiaResponse,
    requestSerialize: serialize_wsbs_PauseTheiaRequest,
    requestDeserialize: deserialize_wsbs_PauseTheiaRequest,
    responseSerialize: serialize_wsbs_PauseTheiaResponse,
    responseDeserialize: deserialize_wsbs_PauseTheiaResponse,
  },
  gitStatus: {
    path: '/wsbs.InWorkspaceHelperOld/GitStatus',
    requestStream: false,
    responseStream: false,
    requestType: workspace_pb.GitStatusRequest,
    responseType: workspace_pb.GitStatusResponse,
    requestSerialize: serialize_wsbs_GitStatusRequest,
    requestDeserialize: deserialize_wsbs_GitStatusRequest,
    responseSerialize: serialize_wsbs_GitStatusResponse,
    responseDeserialize: deserialize_wsbs_GitStatusResponse,
  },
  // UidmapCanary can establish a uid mapping of a new user namespace spawned within the workspace.
uidmapCanary: {
    path: '/wsbs.InWorkspaceHelperOld/UidmapCanary',
    requestStream: true,
    responseStream: true,
    requestType: workspace_pb.UidmapCanaryResponse,
    responseType: workspace_pb.UidmapCanaryRequest,
    requestSerialize: serialize_wsbs_UidmapCanaryResponse,
    requestDeserialize: deserialize_wsbs_UidmapCanaryResponse,
    responseSerialize: serialize_wsbs_UidmapCanaryRequest,
    responseDeserialize: deserialize_wsbs_UidmapCanaryRequest,
  },
};

exports.InWorkspaceHelperOldClient = grpc.makeGenericClientConstructor(InWorkspaceHelperOldService);
