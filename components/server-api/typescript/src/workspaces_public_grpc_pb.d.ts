// package: server
// file: workspaces_public.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as workspaces_public_pb from "./workspaces_public_pb";

interface IWorkspacesService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    getWorkspace: IWorkspacesService_IGetWorkspace;
    listWorkspaces: IWorkspacesService_IListWorkspaces;
    createWorkspace: IWorkspacesService_ICreateWorkspace;
    startWorkspace: IWorkspacesService_IStartWorkspace;
    stopWorkspace: IWorkspacesService_IStopWorkspace;
    watchWorkspaces: IWorkspacesService_IWatchWorkspaces;
    getWorkspaceInstance: IWorkspacesService_IGetWorkspaceInstance;
    listWorkspaceInstances: IWorkspacesService_IListWorkspaceInstances;
    getRunningWorkspaceInstance: IWorkspacesService_IGetRunningWorkspaceInstance;
}

interface IWorkspacesService_IGetWorkspace extends grpc.MethodDefinition<workspaces_public_pb.GetWorkspaceRequest, workspaces_public_pb.GetWorkspaceResponse> {
    path: "/server.Workspaces/GetWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.GetWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.GetWorkspaceRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.GetWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.GetWorkspaceResponse>;
}
interface IWorkspacesService_IListWorkspaces extends grpc.MethodDefinition<workspaces_public_pb.ListWorkspacesRequest, workspaces_public_pb.ListWorkspacesResponse> {
    path: "/server.Workspaces/ListWorkspaces";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.ListWorkspacesRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.ListWorkspacesRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.ListWorkspacesResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.ListWorkspacesResponse>;
}
interface IWorkspacesService_ICreateWorkspace extends grpc.MethodDefinition<workspaces_public_pb.CreateWorkspaceRequest, workspaces_public_pb.CreateWorkspaceResponse> {
    path: "/server.Workspaces/CreateWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.CreateWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.CreateWorkspaceRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.CreateWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.CreateWorkspaceResponse>;
}
interface IWorkspacesService_IStartWorkspace extends grpc.MethodDefinition<workspaces_public_pb.StartWorkspaceRequest, workspaces_public_pb.StartWorkspaceResponse> {
    path: "/server.Workspaces/StartWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.StartWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.StartWorkspaceRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.StartWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.StartWorkspaceResponse>;
}
interface IWorkspacesService_IStopWorkspace extends grpc.MethodDefinition<workspaces_public_pb.StopWorkspaceRequest, workspaces_public_pb.StopWorkspaceResponse> {
    path: "/server.Workspaces/StopWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.StopWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.StopWorkspaceRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.StopWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.StopWorkspaceResponse>;
}
interface IWorkspacesService_IWatchWorkspaces extends grpc.MethodDefinition<workspaces_public_pb.WatchWorkspacesRequest, workspaces_public_pb.WatchWorkspacesResponse> {
    path: "/server.Workspaces/WatchWorkspaces";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<workspaces_public_pb.WatchWorkspacesRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.WatchWorkspacesRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.WatchWorkspacesResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.WatchWorkspacesResponse>;
}
interface IWorkspacesService_IGetWorkspaceInstance extends grpc.MethodDefinition<workspaces_public_pb.GetWorkspaceInstanceRequest, workspaces_public_pb.GetWorkspaceInstanceResponse> {
    path: "/server.Workspaces/GetWorkspaceInstance";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.GetWorkspaceInstanceRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.GetWorkspaceInstanceRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.GetWorkspaceInstanceResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.GetWorkspaceInstanceResponse>;
}
interface IWorkspacesService_IListWorkspaceInstances extends grpc.MethodDefinition<workspaces_public_pb.ListWorkspaceInstancesRequest, workspaces_public_pb.ListWorkspaceInstancesResponse> {
    path: "/server.Workspaces/ListWorkspaceInstances";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.ListWorkspaceInstancesRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.ListWorkspaceInstancesRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.ListWorkspaceInstancesResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.ListWorkspaceInstancesResponse>;
}
interface IWorkspacesService_IGetRunningWorkspaceInstance extends grpc.MethodDefinition<workspaces_public_pb.GetRunningWorkspaceInstanceRequest, workspaces_public_pb.GetRunningWorkspaceInstanceResponse> {
    path: "/server.Workspaces/GetRunningWorkspaceInstance";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspaces_public_pb.GetRunningWorkspaceInstanceRequest>;
    requestDeserialize: grpc.deserialize<workspaces_public_pb.GetRunningWorkspaceInstanceRequest>;
    responseSerialize: grpc.serialize<workspaces_public_pb.GetRunningWorkspaceInstanceResponse>;
    responseDeserialize: grpc.deserialize<workspaces_public_pb.GetRunningWorkspaceInstanceResponse>;
}

export const WorkspacesService: IWorkspacesService;

export interface IWorkspacesServer extends grpc.UntypedServiceImplementation {
    getWorkspace: grpc.handleUnaryCall<workspaces_public_pb.GetWorkspaceRequest, workspaces_public_pb.GetWorkspaceResponse>;
    listWorkspaces: grpc.handleUnaryCall<workspaces_public_pb.ListWorkspacesRequest, workspaces_public_pb.ListWorkspacesResponse>;
    createWorkspace: grpc.handleUnaryCall<workspaces_public_pb.CreateWorkspaceRequest, workspaces_public_pb.CreateWorkspaceResponse>;
    startWorkspace: grpc.handleUnaryCall<workspaces_public_pb.StartWorkspaceRequest, workspaces_public_pb.StartWorkspaceResponse>;
    stopWorkspace: grpc.handleUnaryCall<workspaces_public_pb.StopWorkspaceRequest, workspaces_public_pb.StopWorkspaceResponse>;
    watchWorkspaces: grpc.handleServerStreamingCall<workspaces_public_pb.WatchWorkspacesRequest, workspaces_public_pb.WatchWorkspacesResponse>;
    getWorkspaceInstance: grpc.handleUnaryCall<workspaces_public_pb.GetWorkspaceInstanceRequest, workspaces_public_pb.GetWorkspaceInstanceResponse>;
    listWorkspaceInstances: grpc.handleUnaryCall<workspaces_public_pb.ListWorkspaceInstancesRequest, workspaces_public_pb.ListWorkspaceInstancesResponse>;
    getRunningWorkspaceInstance: grpc.handleUnaryCall<workspaces_public_pb.GetRunningWorkspaceInstanceRequest, workspaces_public_pb.GetRunningWorkspaceInstanceResponse>;
}

export interface IWorkspacesClient {
    getWorkspace(request: workspaces_public_pb.GetWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    getWorkspace(request: workspaces_public_pb.GetWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    getWorkspace(request: workspaces_public_pb.GetWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    listWorkspaces(request: workspaces_public_pb.ListWorkspacesRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    listWorkspaces(request: workspaces_public_pb.ListWorkspacesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    listWorkspaces(request: workspaces_public_pb.ListWorkspacesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    createWorkspace(request: workspaces_public_pb.CreateWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.CreateWorkspaceResponse) => void): grpc.ClientUnaryCall;
    createWorkspace(request: workspaces_public_pb.CreateWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.CreateWorkspaceResponse) => void): grpc.ClientUnaryCall;
    createWorkspace(request: workspaces_public_pb.CreateWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.CreateWorkspaceResponse) => void): grpc.ClientUnaryCall;
    startWorkspace(request: workspaces_public_pb.StartWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    startWorkspace(request: workspaces_public_pb.StartWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    startWorkspace(request: workspaces_public_pb.StartWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    stopWorkspace(request: workspaces_public_pb.StopWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StopWorkspaceResponse) => void): grpc.ClientUnaryCall;
    stopWorkspace(request: workspaces_public_pb.StopWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StopWorkspaceResponse) => void): grpc.ClientUnaryCall;
    stopWorkspace(request: workspaces_public_pb.StopWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StopWorkspaceResponse) => void): grpc.ClientUnaryCall;
    watchWorkspaces(request: workspaces_public_pb.WatchWorkspacesRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<workspaces_public_pb.WatchWorkspacesResponse>;
    watchWorkspaces(request: workspaces_public_pb.WatchWorkspacesRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<workspaces_public_pb.WatchWorkspacesResponse>;
    getWorkspaceInstance(request: workspaces_public_pb.GetWorkspaceInstanceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    getWorkspaceInstance(request: workspaces_public_pb.GetWorkspaceInstanceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    getWorkspaceInstance(request: workspaces_public_pb.GetWorkspaceInstanceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    listWorkspaceInstances(request: workspaces_public_pb.ListWorkspaceInstancesRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspaceInstancesResponse) => void): grpc.ClientUnaryCall;
    listWorkspaceInstances(request: workspaces_public_pb.ListWorkspaceInstancesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspaceInstancesResponse) => void): grpc.ClientUnaryCall;
    listWorkspaceInstances(request: workspaces_public_pb.ListWorkspaceInstancesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspaceInstancesResponse) => void): grpc.ClientUnaryCall;
    getRunningWorkspaceInstance(request: workspaces_public_pb.GetRunningWorkspaceInstanceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetRunningWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    getRunningWorkspaceInstance(request: workspaces_public_pb.GetRunningWorkspaceInstanceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetRunningWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    getRunningWorkspaceInstance(request: workspaces_public_pb.GetRunningWorkspaceInstanceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetRunningWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
}

export class WorkspacesClient extends grpc.Client implements IWorkspacesClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getWorkspace(request: workspaces_public_pb.GetWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public getWorkspace(request: workspaces_public_pb.GetWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public getWorkspace(request: workspaces_public_pb.GetWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaces(request: workspaces_public_pb.ListWorkspacesRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaces(request: workspaces_public_pb.ListWorkspacesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaces(request: workspaces_public_pb.ListWorkspacesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    public createWorkspace(request: workspaces_public_pb.CreateWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.CreateWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public createWorkspace(request: workspaces_public_pb.CreateWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.CreateWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public createWorkspace(request: workspaces_public_pb.CreateWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.CreateWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public startWorkspace(request: workspaces_public_pb.StartWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public startWorkspace(request: workspaces_public_pb.StartWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public startWorkspace(request: workspaces_public_pb.StartWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public stopWorkspace(request: workspaces_public_pb.StopWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StopWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public stopWorkspace(request: workspaces_public_pb.StopWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StopWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public stopWorkspace(request: workspaces_public_pb.StopWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.StopWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public watchWorkspaces(request: workspaces_public_pb.WatchWorkspacesRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<workspaces_public_pb.WatchWorkspacesResponse>;
    public watchWorkspaces(request: workspaces_public_pb.WatchWorkspacesRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<workspaces_public_pb.WatchWorkspacesResponse>;
    public getWorkspaceInstance(request: workspaces_public_pb.GetWorkspaceInstanceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public getWorkspaceInstance(request: workspaces_public_pb.GetWorkspaceInstanceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public getWorkspaceInstance(request: workspaces_public_pb.GetWorkspaceInstanceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaceInstances(request: workspaces_public_pb.ListWorkspaceInstancesRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspaceInstancesResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaceInstances(request: workspaces_public_pb.ListWorkspaceInstancesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspaceInstancesResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaceInstances(request: workspaces_public_pb.ListWorkspaceInstancesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.ListWorkspaceInstancesResponse) => void): grpc.ClientUnaryCall;
    public getRunningWorkspaceInstance(request: workspaces_public_pb.GetRunningWorkspaceInstanceRequest, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetRunningWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public getRunningWorkspaceInstance(request: workspaces_public_pb.GetRunningWorkspaceInstanceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetRunningWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public getRunningWorkspaceInstance(request: workspaces_public_pb.GetRunningWorkspaceInstanceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspaces_public_pb.GetRunningWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
}
