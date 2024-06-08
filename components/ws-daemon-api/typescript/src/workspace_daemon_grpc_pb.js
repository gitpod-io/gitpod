/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var workspace_daemon_pb = require('./workspace_daemon_pb.js');

function serialize_iws_EvacuateCGroupRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.EvacuateCGroupRequest)) {
    throw new Error('Expected argument of type iws.EvacuateCGroupRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_EvacuateCGroupRequest(buffer_arg) {
  return workspace_daemon_pb.EvacuateCGroupRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_EvacuateCGroupResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.EvacuateCGroupResponse)) {
    throw new Error('Expected argument of type iws.EvacuateCGroupResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_EvacuateCGroupResponse(buffer_arg) {
  return workspace_daemon_pb.EvacuateCGroupResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_MountNfsRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.MountNfsRequest)) {
    throw new Error('Expected argument of type iws.MountNfsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_MountNfsRequest(buffer_arg) {
  return workspace_daemon_pb.MountNfsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_MountNfsResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.MountNfsResponse)) {
    throw new Error('Expected argument of type iws.MountNfsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_MountNfsResponse(buffer_arg) {
  return workspace_daemon_pb.MountNfsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_MountProcRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.MountProcRequest)) {
    throw new Error('Expected argument of type iws.MountProcRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_MountProcRequest(buffer_arg) {
  return workspace_daemon_pb.MountProcRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_MountProcResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.MountProcResponse)) {
    throw new Error('Expected argument of type iws.MountProcResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_MountProcResponse(buffer_arg) {
  return workspace_daemon_pb.MountProcResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_PrepareForUserNSRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.PrepareForUserNSRequest)) {
    throw new Error('Expected argument of type iws.PrepareForUserNSRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_PrepareForUserNSRequest(buffer_arg) {
  return workspace_daemon_pb.PrepareForUserNSRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_PrepareForUserNSResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.PrepareForUserNSResponse)) {
    throw new Error('Expected argument of type iws.PrepareForUserNSResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_PrepareForUserNSResponse(buffer_arg) {
  return workspace_daemon_pb.PrepareForUserNSResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_SetupPairVethsRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.SetupPairVethsRequest)) {
    throw new Error('Expected argument of type iws.SetupPairVethsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_SetupPairVethsRequest(buffer_arg) {
  return workspace_daemon_pb.SetupPairVethsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_SetupPairVethsResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.SetupPairVethsResponse)) {
    throw new Error('Expected argument of type iws.SetupPairVethsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_SetupPairVethsResponse(buffer_arg) {
  return workspace_daemon_pb.SetupPairVethsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_TeardownRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.TeardownRequest)) {
    throw new Error('Expected argument of type iws.TeardownRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_TeardownRequest(buffer_arg) {
  return workspace_daemon_pb.TeardownRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_TeardownResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.TeardownResponse)) {
    throw new Error('Expected argument of type iws.TeardownResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_TeardownResponse(buffer_arg) {
  return workspace_daemon_pb.TeardownResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_UmountNfsRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.UmountNfsRequest)) {
    throw new Error('Expected argument of type iws.UmountNfsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_UmountNfsRequest(buffer_arg) {
  return workspace_daemon_pb.UmountNfsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_UmountNfsResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.UmountNfsResponse)) {
    throw new Error('Expected argument of type iws.UmountNfsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_UmountNfsResponse(buffer_arg) {
  return workspace_daemon_pb.UmountNfsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_UmountProcRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.UmountProcRequest)) {
    throw new Error('Expected argument of type iws.UmountProcRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_UmountProcRequest(buffer_arg) {
  return workspace_daemon_pb.UmountProcRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_UmountProcResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.UmountProcResponse)) {
    throw new Error('Expected argument of type iws.UmountProcResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_UmountProcResponse(buffer_arg) {
  return workspace_daemon_pb.UmountProcResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_WorkspaceInfoRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.WorkspaceInfoRequest)) {
    throw new Error('Expected argument of type iws.WorkspaceInfoRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_WorkspaceInfoRequest(buffer_arg) {
  return workspace_daemon_pb.WorkspaceInfoRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_WorkspaceInfoResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.WorkspaceInfoResponse)) {
    throw new Error('Expected argument of type iws.WorkspaceInfoResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_WorkspaceInfoResponse(buffer_arg) {
  return workspace_daemon_pb.WorkspaceInfoResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_WriteIDMappingRequest(arg) {
  if (!(arg instanceof workspace_daemon_pb.WriteIDMappingRequest)) {
    throw new Error('Expected argument of type iws.WriteIDMappingRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_WriteIDMappingRequest(buffer_arg) {
  return workspace_daemon_pb.WriteIDMappingRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iws_WriteIDMappingResponse(arg) {
  if (!(arg instanceof workspace_daemon_pb.WriteIDMappingResponse)) {
    throw new Error('Expected argument of type iws.WriteIDMappingResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iws_WriteIDMappingResponse(buffer_arg) {
  return workspace_daemon_pb.WriteIDMappingResponse.deserializeBinary(new Uint8Array(buffer_arg));
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
    requestType: workspace_daemon_pb.PrepareForUserNSRequest,
    responseType: workspace_daemon_pb.PrepareForUserNSResponse,
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
    requestType: workspace_daemon_pb.WriteIDMappingRequest,
    responseType: workspace_daemon_pb.WriteIDMappingResponse,
    requestSerialize: serialize_iws_WriteIDMappingRequest,
    requestDeserialize: deserialize_iws_WriteIDMappingRequest,
    responseSerialize: serialize_iws_WriteIDMappingResponse,
    responseDeserialize: deserialize_iws_WriteIDMappingResponse,
  },
  // EvacuateCGroup empties the workspace pod cgroup and produces a new substructure.
// In combincation with introducing a new cgroup namespace, we can create a situation
// where the subcontroller are enabled and the ring2-visible cgroup is of type "domain".
evacuateCGroup: {
    path: '/iws.InWorkspaceService/EvacuateCGroup',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.EvacuateCGroupRequest,
    responseType: workspace_daemon_pb.EvacuateCGroupResponse,
    requestSerialize: serialize_iws_EvacuateCGroupRequest,
    requestDeserialize: deserialize_iws_EvacuateCGroupRequest,
    responseSerialize: serialize_iws_EvacuateCGroupResponse,
    responseDeserialize: deserialize_iws_EvacuateCGroupResponse,
  },
  // MountProc mounts a masked proc in the container's rootfs.
// The PID must be in the PID namespace of the workspace container.
// The path is relative to the mount namespace of the PID.
mountProc: {
    path: '/iws.InWorkspaceService/MountProc',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.MountProcRequest,
    responseType: workspace_daemon_pb.MountProcResponse,
    requestSerialize: serialize_iws_MountProcRequest,
    requestDeserialize: deserialize_iws_MountProcRequest,
    responseSerialize: serialize_iws_MountProcResponse,
    responseDeserialize: deserialize_iws_MountProcResponse,
  },
  // UmountProc unmounts a masked proc from the container's rootfs.
// The PID must be in the PID namespace of the workspace container.
// The path is relative to the mount namespace of the PID.
umountProc: {
    path: '/iws.InWorkspaceService/UmountProc',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.UmountProcRequest,
    responseType: workspace_daemon_pb.UmountProcResponse,
    requestSerialize: serialize_iws_UmountProcRequest,
    requestDeserialize: deserialize_iws_UmountProcRequest,
    responseSerialize: serialize_iws_UmountProcResponse,
    responseDeserialize: deserialize_iws_UmountProcResponse,
  },
  // MountSysfs mounts a masked sysfs in the container's rootfs.
// The PID must be in the PID namespace of the workspace container.
// The path is relative to the mount namespace of the PID.
mountSysfs: {
    path: '/iws.InWorkspaceService/MountSysfs',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.MountProcRequest,
    responseType: workspace_daemon_pb.MountProcResponse,
    requestSerialize: serialize_iws_MountProcRequest,
    requestDeserialize: deserialize_iws_MountProcRequest,
    responseSerialize: serialize_iws_MountProcResponse,
    responseDeserialize: deserialize_iws_MountProcResponse,
  },
  // UmountSysfs unmounts a masked sysfs from the container's rootfs.
// The PID must be in the PID namespace of the workspace container.
// The path is relative to the mount namespace of the PID.
umountSysfs: {
    path: '/iws.InWorkspaceService/UmountSysfs',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.UmountProcRequest,
    responseType: workspace_daemon_pb.UmountProcResponse,
    requestSerialize: serialize_iws_UmountProcRequest,
    requestDeserialize: deserialize_iws_UmountProcRequest,
    responseSerialize: serialize_iws_UmountProcResponse,
    responseDeserialize: deserialize_iws_UmountProcResponse,
  },
  // MountNfs mounts a nfs share into the container's rootfs.
// The PID must be in the PID namespace of the workspace container.
// The path is relative to the mount namespace of the PID.
mountNfs: {
    path: '/iws.InWorkspaceService/MountNfs',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.MountNfsRequest,
    responseType: workspace_daemon_pb.MountNfsResponse,
    requestSerialize: serialize_iws_MountNfsRequest,
    requestDeserialize: deserialize_iws_MountNfsRequest,
    responseSerialize: serialize_iws_MountNfsResponse,
    responseDeserialize: deserialize_iws_MountNfsResponse,
  },
  // UmountNfs unmounts a nfs share from the container's rootfs.
// The PID must be in the PID namespace of the workspace container.
// The path is relative to the mount namespace of the PID.
umountNfs: {
    path: '/iws.InWorkspaceService/UmountNfs',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.UmountNfsRequest,
    responseType: workspace_daemon_pb.UmountNfsResponse,
    requestSerialize: serialize_iws_UmountNfsRequest,
    requestDeserialize: deserialize_iws_UmountNfsRequest,
    responseSerialize: serialize_iws_UmountNfsResponse,
    responseDeserialize: deserialize_iws_UmountNfsResponse,
  },
  // Teardown prepares workspace content backups and unmounts shiftfs mounts. The canary is supposed to be triggered
// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
teardown: {
    path: '/iws.InWorkspaceService/Teardown',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.TeardownRequest,
    responseType: workspace_daemon_pb.TeardownResponse,
    requestSerialize: serialize_iws_TeardownRequest,
    requestDeserialize: deserialize_iws_TeardownRequest,
    responseSerialize: serialize_iws_TeardownResponse,
    responseDeserialize: deserialize_iws_TeardownResponse,
  },
  // Set up a pair of veths that interconnect the specified PID and the workspace container's network namespace.
setupPairVeths: {
    path: '/iws.InWorkspaceService/SetupPairVeths',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.SetupPairVethsRequest,
    responseType: workspace_daemon_pb.SetupPairVethsResponse,
    requestSerialize: serialize_iws_SetupPairVethsRequest,
    requestDeserialize: deserialize_iws_SetupPairVethsRequest,
    responseSerialize: serialize_iws_SetupPairVethsResponse,
    responseDeserialize: deserialize_iws_SetupPairVethsResponse,
  },
  // Get information about the workspace
workspaceInfo: {
    path: '/iws.InWorkspaceService/WorkspaceInfo',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.WorkspaceInfoRequest,
    responseType: workspace_daemon_pb.WorkspaceInfoResponse,
    requestSerialize: serialize_iws_WorkspaceInfoRequest,
    requestDeserialize: deserialize_iws_WorkspaceInfoRequest,
    responseSerialize: serialize_iws_WorkspaceInfoResponse,
    responseDeserialize: deserialize_iws_WorkspaceInfoResponse,
  },
};

exports.InWorkspaceServiceClient = grpc.makeGenericClientConstructor(InWorkspaceServiceService);
var WorkspaceInfoServiceService = exports.WorkspaceInfoServiceService = {
  // Get information about the workspace
workspaceInfo: {
    path: '/iws.WorkspaceInfoService/WorkspaceInfo',
    requestStream: false,
    responseStream: false,
    requestType: workspace_daemon_pb.WorkspaceInfoRequest,
    responseType: workspace_daemon_pb.WorkspaceInfoResponse,
    requestSerialize: serialize_iws_WorkspaceInfoRequest,
    requestDeserialize: deserialize_iws_WorkspaceInfoRequest,
    responseSerialize: serialize_iws_WorkspaceInfoResponse,
    responseDeserialize: deserialize_iws_WorkspaceInfoResponse,
  },
};

exports.WorkspaceInfoServiceClient = grpc.makeGenericClientConstructor(WorkspaceInfoServiceService);
