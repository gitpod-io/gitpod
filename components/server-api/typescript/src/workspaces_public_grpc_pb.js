// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var workspaces_public_pb = require('./workspaces_public_pb.js');

function serialize_server_CreateWorkspaceRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.CreateWorkspaceRequest)) {
    throw new Error('Expected argument of type server.CreateWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_CreateWorkspaceRequest(buffer_arg) {
  return workspaces_public_pb.CreateWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_CreateWorkspaceResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.CreateWorkspaceResponse)) {
    throw new Error('Expected argument of type server.CreateWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_CreateWorkspaceResponse(buffer_arg) {
  return workspaces_public_pb.CreateWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_GetRunningWorkspaceInstanceRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.GetRunningWorkspaceInstanceRequest)) {
    throw new Error('Expected argument of type server.GetRunningWorkspaceInstanceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_GetRunningWorkspaceInstanceRequest(buffer_arg) {
  return workspaces_public_pb.GetRunningWorkspaceInstanceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_GetRunningWorkspaceInstanceResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.GetRunningWorkspaceInstanceResponse)) {
    throw new Error('Expected argument of type server.GetRunningWorkspaceInstanceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_GetRunningWorkspaceInstanceResponse(buffer_arg) {
  return workspaces_public_pb.GetRunningWorkspaceInstanceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_GetWorkspaceInstanceRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.GetWorkspaceInstanceRequest)) {
    throw new Error('Expected argument of type server.GetWorkspaceInstanceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_GetWorkspaceInstanceRequest(buffer_arg) {
  return workspaces_public_pb.GetWorkspaceInstanceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_GetWorkspaceInstanceResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.GetWorkspaceInstanceResponse)) {
    throw new Error('Expected argument of type server.GetWorkspaceInstanceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_GetWorkspaceInstanceResponse(buffer_arg) {
  return workspaces_public_pb.GetWorkspaceInstanceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_GetWorkspaceRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.GetWorkspaceRequest)) {
    throw new Error('Expected argument of type server.GetWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_GetWorkspaceRequest(buffer_arg) {
  return workspaces_public_pb.GetWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_GetWorkspaceResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.GetWorkspaceResponse)) {
    throw new Error('Expected argument of type server.GetWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_GetWorkspaceResponse(buffer_arg) {
  return workspaces_public_pb.GetWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_ListWorkspaceInstancesRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.ListWorkspaceInstancesRequest)) {
    throw new Error('Expected argument of type server.ListWorkspaceInstancesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_ListWorkspaceInstancesRequest(buffer_arg) {
  return workspaces_public_pb.ListWorkspaceInstancesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_ListWorkspaceInstancesResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.ListWorkspaceInstancesResponse)) {
    throw new Error('Expected argument of type server.ListWorkspaceInstancesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_ListWorkspaceInstancesResponse(buffer_arg) {
  return workspaces_public_pb.ListWorkspaceInstancesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_ListWorkspacesRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.ListWorkspacesRequest)) {
    throw new Error('Expected argument of type server.ListWorkspacesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_ListWorkspacesRequest(buffer_arg) {
  return workspaces_public_pb.ListWorkspacesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_ListWorkspacesResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.ListWorkspacesResponse)) {
    throw new Error('Expected argument of type server.ListWorkspacesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_ListWorkspacesResponse(buffer_arg) {
  return workspaces_public_pb.ListWorkspacesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_StartWorkspaceRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.StartWorkspaceRequest)) {
    throw new Error('Expected argument of type server.StartWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_StartWorkspaceRequest(buffer_arg) {
  return workspaces_public_pb.StartWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_StartWorkspaceResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.StartWorkspaceResponse)) {
    throw new Error('Expected argument of type server.StartWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_StartWorkspaceResponse(buffer_arg) {
  return workspaces_public_pb.StartWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_StopWorkspaceRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.StopWorkspaceRequest)) {
    throw new Error('Expected argument of type server.StopWorkspaceRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_StopWorkspaceRequest(buffer_arg) {
  return workspaces_public_pb.StopWorkspaceRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_StopWorkspaceResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.StopWorkspaceResponse)) {
    throw new Error('Expected argument of type server.StopWorkspaceResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_StopWorkspaceResponse(buffer_arg) {
  return workspaces_public_pb.StopWorkspaceResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_WatchWorkspacesRequest(arg) {
  if (!(arg instanceof workspaces_public_pb.WatchWorkspacesRequest)) {
    throw new Error('Expected argument of type server.WatchWorkspacesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_WatchWorkspacesRequest(buffer_arg) {
  return workspaces_public_pb.WatchWorkspacesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_server_WatchWorkspacesResponse(arg) {
  if (!(arg instanceof workspaces_public_pb.WatchWorkspacesResponse)) {
    throw new Error('Expected argument of type server.WatchWorkspacesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_server_WatchWorkspacesResponse(buffer_arg) {
  return workspaces_public_pb.WatchWorkspacesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WorkspacesService = exports.WorkspacesService = {
  getWorkspace: {
    path: '/server.Workspaces/GetWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.GetWorkspaceRequest,
    responseType: workspaces_public_pb.GetWorkspaceResponse,
    requestSerialize: serialize_server_GetWorkspaceRequest,
    requestDeserialize: deserialize_server_GetWorkspaceRequest,
    responseSerialize: serialize_server_GetWorkspaceResponse,
    responseDeserialize: deserialize_server_GetWorkspaceResponse,
  },
  listWorkspaces: {
    path: '/server.Workspaces/ListWorkspaces',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.ListWorkspacesRequest,
    responseType: workspaces_public_pb.ListWorkspacesResponse,
    requestSerialize: serialize_server_ListWorkspacesRequest,
    requestDeserialize: deserialize_server_ListWorkspacesRequest,
    responseSerialize: serialize_server_ListWorkspacesResponse,
    responseDeserialize: deserialize_server_ListWorkspacesResponse,
  },
  createWorkspace: {
    path: '/server.Workspaces/CreateWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.CreateWorkspaceRequest,
    responseType: workspaces_public_pb.CreateWorkspaceResponse,
    requestSerialize: serialize_server_CreateWorkspaceRequest,
    requestDeserialize: deserialize_server_CreateWorkspaceRequest,
    responseSerialize: serialize_server_CreateWorkspaceResponse,
    responseDeserialize: deserialize_server_CreateWorkspaceResponse,
  },
  startWorkspace: {
    path: '/server.Workspaces/StartWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.StartWorkspaceRequest,
    responseType: workspaces_public_pb.StartWorkspaceResponse,
    requestSerialize: serialize_server_StartWorkspaceRequest,
    requestDeserialize: deserialize_server_StartWorkspaceRequest,
    responseSerialize: serialize_server_StartWorkspaceResponse,
    responseDeserialize: deserialize_server_StartWorkspaceResponse,
  },
  stopWorkspace: {
    path: '/server.Workspaces/StopWorkspace',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.StopWorkspaceRequest,
    responseType: workspaces_public_pb.StopWorkspaceResponse,
    requestSerialize: serialize_server_StopWorkspaceRequest,
    requestDeserialize: deserialize_server_StopWorkspaceRequest,
    responseSerialize: serialize_server_StopWorkspaceResponse,
    responseDeserialize: deserialize_server_StopWorkspaceResponse,
  },
  watchWorkspaces: {
    path: '/server.Workspaces/WatchWorkspaces',
    requestStream: false,
    responseStream: true,
    requestType: workspaces_public_pb.WatchWorkspacesRequest,
    responseType: workspaces_public_pb.WatchWorkspacesResponse,
    requestSerialize: serialize_server_WatchWorkspacesRequest,
    requestDeserialize: deserialize_server_WatchWorkspacesRequest,
    responseSerialize: serialize_server_WatchWorkspacesResponse,
    responseDeserialize: deserialize_server_WatchWorkspacesResponse,
  },
  getWorkspaceInstance: {
    path: '/server.Workspaces/GetWorkspaceInstance',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.GetWorkspaceInstanceRequest,
    responseType: workspaces_public_pb.GetWorkspaceInstanceResponse,
    requestSerialize: serialize_server_GetWorkspaceInstanceRequest,
    requestDeserialize: deserialize_server_GetWorkspaceInstanceRequest,
    responseSerialize: serialize_server_GetWorkspaceInstanceResponse,
    responseDeserialize: deserialize_server_GetWorkspaceInstanceResponse,
  },
  listWorkspaceInstances: {
    path: '/server.Workspaces/ListWorkspaceInstances',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.ListWorkspaceInstancesRequest,
    responseType: workspaces_public_pb.ListWorkspaceInstancesResponse,
    requestSerialize: serialize_server_ListWorkspaceInstancesRequest,
    requestDeserialize: deserialize_server_ListWorkspaceInstancesRequest,
    responseSerialize: serialize_server_ListWorkspaceInstancesResponse,
    responseDeserialize: deserialize_server_ListWorkspaceInstancesResponse,
  },
  getRunningWorkspaceInstance: {
    path: '/server.Workspaces/GetRunningWorkspaceInstance',
    requestStream: false,
    responseStream: false,
    requestType: workspaces_public_pb.GetRunningWorkspaceInstanceRequest,
    responseType: workspaces_public_pb.GetRunningWorkspaceInstanceResponse,
    requestSerialize: serialize_server_GetRunningWorkspaceInstanceRequest,
    requestDeserialize: deserialize_server_GetRunningWorkspaceInstanceRequest,
    responseSerialize: serialize_server_GetRunningWorkspaceInstanceResponse,
    responseDeserialize: deserialize_server_GetRunningWorkspaceInstanceResponse,
  },
};

exports.WorkspacesClient = grpc.makeGenericClientConstructor(WorkspacesService);
