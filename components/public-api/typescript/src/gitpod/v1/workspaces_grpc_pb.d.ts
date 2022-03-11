// package: gitpod.v1
// file: gitpod/v1/workspaces.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as gitpod_v1_workspaces_pb from "../../gitpod/v1/workspaces_pb";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";
import * as google_protobuf_field_mask_pb from "google-protobuf/google/protobuf/field_mask_pb";
import * as google_rpc_status_pb from "../../google/rpc/status_pb";
import * as gitpod_v1_pagination_pb from "../../gitpod/v1/pagination_pb";

interface IWorkspacesServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    listWorkspaces: IWorkspacesServiceService_IListWorkspaces;
    getWorkspace: IWorkspacesServiceService_IGetWorkspace;
    createAndStartWorkspace: IWorkspacesServiceService_ICreateAndStartWorkspace;
    startWorkspace: IWorkspacesServiceService_IStartWorkspace;
    getActiveWorkspaceInstance: IWorkspacesServiceService_IGetActiveWorkspaceInstance;
    getWorkspaceInstanceOwnerToken: IWorkspacesServiceService_IGetWorkspaceInstanceOwnerToken;
    listenToWorkspaceInstance: IWorkspacesServiceService_IListenToWorkspaceInstance;
    listenToImageBuildLogs: IWorkspacesServiceService_IListenToImageBuildLogs;
    stopWorkspace: IWorkspacesServiceService_IStopWorkspace;
}

interface IWorkspacesServiceService_IListWorkspaces extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.ListWorkspacesRequest, gitpod_v1_workspaces_pb.ListWorkspacesResponse> {
    path: "/gitpod.v1.WorkspacesService/ListWorkspaces";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.ListWorkspacesRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.ListWorkspacesRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.ListWorkspacesResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.ListWorkspacesResponse>;
}
interface IWorkspacesServiceService_IGetWorkspace extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.GetWorkspaceRequest, gitpod_v1_workspaces_pb.GetWorkspaceResponse> {
    path: "/gitpod.v1.WorkspacesService/GetWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.GetWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.GetWorkspaceRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.GetWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.GetWorkspaceResponse>;
}
interface IWorkspacesServiceService_ICreateAndStartWorkspace extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse> {
    path: "/gitpod.v1.WorkspacesService/CreateAndStartWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse>;
}
interface IWorkspacesServiceService_IStartWorkspace extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.StartWorkspaceRequest, gitpod_v1_workspaces_pb.StartWorkspaceResponse> {
    path: "/gitpod.v1.WorkspacesService/StartWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.StartWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.StartWorkspaceRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.StartWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.StartWorkspaceResponse>;
}
interface IWorkspacesServiceService_IGetActiveWorkspaceInstance extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse> {
    path: "/gitpod.v1.WorkspacesService/GetActiveWorkspaceInstance";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse>;
}
interface IWorkspacesServiceService_IGetWorkspaceInstanceOwnerToken extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse> {
    path: "/gitpod.v1.WorkspacesService/GetWorkspaceInstanceOwnerToken";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse>;
}
interface IWorkspacesServiceService_IListenToWorkspaceInstance extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest, gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse> {
    path: "/gitpod.v1.WorkspacesService/ListenToWorkspaceInstance";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
}
interface IWorkspacesServiceService_IListenToImageBuildLogs extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest, gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse> {
    path: "/gitpod.v1.WorkspacesService/ListenToImageBuildLogs";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
}
interface IWorkspacesServiceService_IStopWorkspace extends grpc.MethodDefinition<gitpod_v1_workspaces_pb.StopWorkspaceRequest, gitpod_v1_workspaces_pb.StopWorkspaceResponse> {
    path: "/gitpod.v1.WorkspacesService/StopWorkspace";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<gitpod_v1_workspaces_pb.StopWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.StopWorkspaceRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_workspaces_pb.StopWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_workspaces_pb.StopWorkspaceResponse>;
}

export const WorkspacesServiceService: IWorkspacesServiceService;

export interface IWorkspacesServiceServer extends grpc.UntypedServiceImplementation {
    listWorkspaces: grpc.handleUnaryCall<gitpod_v1_workspaces_pb.ListWorkspacesRequest, gitpod_v1_workspaces_pb.ListWorkspacesResponse>;
    getWorkspace: grpc.handleUnaryCall<gitpod_v1_workspaces_pb.GetWorkspaceRequest, gitpod_v1_workspaces_pb.GetWorkspaceResponse>;
    createAndStartWorkspace: grpc.handleUnaryCall<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse>;
    startWorkspace: grpc.handleUnaryCall<gitpod_v1_workspaces_pb.StartWorkspaceRequest, gitpod_v1_workspaces_pb.StartWorkspaceResponse>;
    getActiveWorkspaceInstance: grpc.handleUnaryCall<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse>;
    getWorkspaceInstanceOwnerToken: grpc.handleUnaryCall<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse>;
    listenToWorkspaceInstance: grpc.handleServerStreamingCall<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest, gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
    listenToImageBuildLogs: grpc.handleServerStreamingCall<gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest, gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
    stopWorkspace: grpc.handleServerStreamingCall<gitpod_v1_workspaces_pb.StopWorkspaceRequest, gitpod_v1_workspaces_pb.StopWorkspaceResponse>;
}

export interface IWorkspacesServiceClient {
    listWorkspaces(request: gitpod_v1_workspaces_pb.ListWorkspacesRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    listWorkspaces(request: gitpod_v1_workspaces_pb.ListWorkspacesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    listWorkspaces(request: gitpod_v1_workspaces_pb.ListWorkspacesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    getWorkspace(request: gitpod_v1_workspaces_pb.GetWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    getWorkspace(request: gitpod_v1_workspaces_pb.GetWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    getWorkspace(request: gitpod_v1_workspaces_pb.GetWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    createAndStartWorkspace(request: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    createAndStartWorkspace(request: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    createAndStartWorkspace(request: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    startWorkspace(request: gitpod_v1_workspaces_pb.StartWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    startWorkspace(request: gitpod_v1_workspaces_pb.StartWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    startWorkspace(request: gitpod_v1_workspaces_pb.StartWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    getActiveWorkspaceInstance(request: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    getActiveWorkspaceInstance(request: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    getActiveWorkspaceInstance(request: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    getWorkspaceInstanceOwnerToken(request: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse) => void): grpc.ClientUnaryCall;
    getWorkspaceInstanceOwnerToken(request: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse) => void): grpc.ClientUnaryCall;
    getWorkspaceInstanceOwnerToken(request: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse) => void): grpc.ClientUnaryCall;
    listenToWorkspaceInstance(request: gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
    listenToWorkspaceInstance(request: gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
    listenToImageBuildLogs(request: gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
    listenToImageBuildLogs(request: gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
    stopWorkspace(request: gitpod_v1_workspaces_pb.StopWorkspaceRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.StopWorkspaceResponse>;
    stopWorkspace(request: gitpod_v1_workspaces_pb.StopWorkspaceRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.StopWorkspaceResponse>;
}

export class WorkspacesServiceClient extends grpc.Client implements IWorkspacesServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public listWorkspaces(request: gitpod_v1_workspaces_pb.ListWorkspacesRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaces(request: gitpod_v1_workspaces_pb.ListWorkspacesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    public listWorkspaces(request: gitpod_v1_workspaces_pb.ListWorkspacesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.ListWorkspacesResponse) => void): grpc.ClientUnaryCall;
    public getWorkspace(request: gitpod_v1_workspaces_pb.GetWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public getWorkspace(request: gitpod_v1_workspaces_pb.GetWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public getWorkspace(request: gitpod_v1_workspaces_pb.GetWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public createAndStartWorkspace(request: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public createAndStartWorkspace(request: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public createAndStartWorkspace(request: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public startWorkspace(request: gitpod_v1_workspaces_pb.StartWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public startWorkspace(request: gitpod_v1_workspaces_pb.StartWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public startWorkspace(request: gitpod_v1_workspaces_pb.StartWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.StartWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public getActiveWorkspaceInstance(request: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public getActiveWorkspaceInstance(request: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public getActiveWorkspaceInstance(request: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse) => void): grpc.ClientUnaryCall;
    public getWorkspaceInstanceOwnerToken(request: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse) => void): grpc.ClientUnaryCall;
    public getWorkspaceInstanceOwnerToken(request: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse) => void): grpc.ClientUnaryCall;
    public getWorkspaceInstanceOwnerToken(request: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse) => void): grpc.ClientUnaryCall;
    public listenToWorkspaceInstance(request: gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
    public listenToWorkspaceInstance(request: gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
    public listenToImageBuildLogs(request: gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
    public listenToImageBuildLogs(request: gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
    public stopWorkspace(request: gitpod_v1_workspaces_pb.StopWorkspaceRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.StopWorkspaceResponse>;
    public stopWorkspace(request: gitpod_v1_workspaces_pb.StopWorkspaceRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_workspaces_pb.StopWorkspaceResponse>;
}
