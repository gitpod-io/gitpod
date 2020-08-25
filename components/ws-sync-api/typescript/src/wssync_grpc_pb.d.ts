/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: wssync
// file: wssync.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as wssync_pb from "./wssync_pb";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";

interface IWorkspaceContentServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    initWorkspace: IWorkspaceContentServiceService_IInitWorkspace;
    waitForInit: IWorkspaceContentServiceService_IWaitForInit;
    takeSnapshot: IWorkspaceContentServiceService_ITakeSnapshot;
    disposeWorkspace: IWorkspaceContentServiceService_IDisposeWorkspace;
}

interface IWorkspaceContentServiceService_IInitWorkspace extends grpc.MethodDefinition<wssync_pb.InitWorkspaceRequest, wssync_pb.InitWorkspaceResponse> {
    path: string; // "/wssync.WorkspaceContentService/InitWorkspace"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<wssync_pb.InitWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<wssync_pb.InitWorkspaceRequest>;
    responseSerialize: grpc.serialize<wssync_pb.InitWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<wssync_pb.InitWorkspaceResponse>;
}
interface IWorkspaceContentServiceService_IWaitForInit extends grpc.MethodDefinition<wssync_pb.WaitForInitRequest, wssync_pb.WaitForInitResponse> {
    path: string; // "/wssync.WorkspaceContentService/WaitForInit"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<wssync_pb.WaitForInitRequest>;
    requestDeserialize: grpc.deserialize<wssync_pb.WaitForInitRequest>;
    responseSerialize: grpc.serialize<wssync_pb.WaitForInitResponse>;
    responseDeserialize: grpc.deserialize<wssync_pb.WaitForInitResponse>;
}
interface IWorkspaceContentServiceService_ITakeSnapshot extends grpc.MethodDefinition<wssync_pb.TakeSnapshotRequest, wssync_pb.TakeSnapshotResponse> {
    path: string; // "/wssync.WorkspaceContentService/TakeSnapshot"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<wssync_pb.TakeSnapshotRequest>;
    requestDeserialize: grpc.deserialize<wssync_pb.TakeSnapshotRequest>;
    responseSerialize: grpc.serialize<wssync_pb.TakeSnapshotResponse>;
    responseDeserialize: grpc.deserialize<wssync_pb.TakeSnapshotResponse>;
}
interface IWorkspaceContentServiceService_IDisposeWorkspace extends grpc.MethodDefinition<wssync_pb.DisposeWorkspaceRequest, wssync_pb.DisposeWorkspaceResponse> {
    path: string; // "/wssync.WorkspaceContentService/DisposeWorkspace"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<wssync_pb.DisposeWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<wssync_pb.DisposeWorkspaceRequest>;
    responseSerialize: grpc.serialize<wssync_pb.DisposeWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<wssync_pb.DisposeWorkspaceResponse>;
}

export const WorkspaceContentServiceService: IWorkspaceContentServiceService;

export interface IWorkspaceContentServiceServer {
    initWorkspace: grpc.handleUnaryCall<wssync_pb.InitWorkspaceRequest, wssync_pb.InitWorkspaceResponse>;
    waitForInit: grpc.handleUnaryCall<wssync_pb.WaitForInitRequest, wssync_pb.WaitForInitResponse>;
    takeSnapshot: grpc.handleUnaryCall<wssync_pb.TakeSnapshotRequest, wssync_pb.TakeSnapshotResponse>;
    disposeWorkspace: grpc.handleUnaryCall<wssync_pb.DisposeWorkspaceRequest, wssync_pb.DisposeWorkspaceResponse>;
}

export interface IWorkspaceContentServiceClient {
    initWorkspace(request: wssync_pb.InitWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    initWorkspace(request: wssync_pb.InitWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    initWorkspace(request: wssync_pb.InitWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    waitForInit(request: wssync_pb.WaitForInitRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    waitForInit(request: wssync_pb.WaitForInitRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    waitForInit(request: wssync_pb.WaitForInitRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    takeSnapshot(request: wssync_pb.TakeSnapshotRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    takeSnapshot(request: wssync_pb.TakeSnapshotRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    takeSnapshot(request: wssync_pb.TakeSnapshotRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    disposeWorkspace(request: wssync_pb.DisposeWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    disposeWorkspace(request: wssync_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    disposeWorkspace(request: wssync_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
}

export class WorkspaceContentServiceClient extends grpc.Client implements IWorkspaceContentServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public initWorkspace(request: wssync_pb.InitWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public initWorkspace(request: wssync_pb.InitWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public initWorkspace(request: wssync_pb.InitWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public waitForInit(request: wssync_pb.WaitForInitRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    public waitForInit(request: wssync_pb.WaitForInitRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    public waitForInit(request: wssync_pb.WaitForInitRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    public takeSnapshot(request: wssync_pb.TakeSnapshotRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    public takeSnapshot(request: wssync_pb.TakeSnapshotRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    public takeSnapshot(request: wssync_pb.TakeSnapshotRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    public disposeWorkspace(request: wssync_pb.DisposeWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: wssync_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public disposeWorkspace(request: wssync_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: wssync_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public disposeWorkspace(request: wssync_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: wssync_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
}
