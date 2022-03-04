/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: wsdaemon
// file: daemon.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as daemon_pb from "./daemon_pb";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";

interface IWorkspaceContentServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    initWorkspace: IWorkspaceContentServiceService_IInitWorkspace;
    waitForInit: IWorkspaceContentServiceService_IWaitForInit;
    takeSnapshot: IWorkspaceContentServiceService_ITakeSnapshot;
    disposeWorkspace: IWorkspaceContentServiceService_IDisposeWorkspace;
    backupWorkspace: IWorkspaceContentServiceService_IBackupWorkspace;
}

interface IWorkspaceContentServiceService_IInitWorkspace extends grpc.MethodDefinition<daemon_pb.InitWorkspaceRequest, daemon_pb.InitWorkspaceResponse> {
    path: "/wsdaemon.WorkspaceContentService/InitWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<daemon_pb.InitWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<daemon_pb.InitWorkspaceRequest>;
    responseSerialize: grpc.serialize<daemon_pb.InitWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<daemon_pb.InitWorkspaceResponse>;
}
interface IWorkspaceContentServiceService_IWaitForInit extends grpc.MethodDefinition<daemon_pb.WaitForInitRequest, daemon_pb.WaitForInitResponse> {
    path: "/wsdaemon.WorkspaceContentService/WaitForInit";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<daemon_pb.WaitForInitRequest>;
    requestDeserialize: grpc.deserialize<daemon_pb.WaitForInitRequest>;
    responseSerialize: grpc.serialize<daemon_pb.WaitForInitResponse>;
    responseDeserialize: grpc.deserialize<daemon_pb.WaitForInitResponse>;
}
interface IWorkspaceContentServiceService_ITakeSnapshot extends grpc.MethodDefinition<daemon_pb.TakeSnapshotRequest, daemon_pb.TakeSnapshotResponse> {
    path: "/wsdaemon.WorkspaceContentService/TakeSnapshot";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<daemon_pb.TakeSnapshotRequest>;
    requestDeserialize: grpc.deserialize<daemon_pb.TakeSnapshotRequest>;
    responseSerialize: grpc.serialize<daemon_pb.TakeSnapshotResponse>;
    responseDeserialize: grpc.deserialize<daemon_pb.TakeSnapshotResponse>;
}
interface IWorkspaceContentServiceService_IDisposeWorkspace extends grpc.MethodDefinition<daemon_pb.DisposeWorkspaceRequest, daemon_pb.DisposeWorkspaceResponse> {
    path: "/wsdaemon.WorkspaceContentService/DisposeWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<daemon_pb.DisposeWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<daemon_pb.DisposeWorkspaceRequest>;
    responseSerialize: grpc.serialize<daemon_pb.DisposeWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<daemon_pb.DisposeWorkspaceResponse>;
}
interface IWorkspaceContentServiceService_IBackupWorkspace extends grpc.MethodDefinition<daemon_pb.BackupWorkspaceRequest, daemon_pb.BackupWorkspaceResponse> {
    path: "/wsdaemon.WorkspaceContentService/BackupWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<daemon_pb.BackupWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<daemon_pb.BackupWorkspaceRequest>;
    responseSerialize: grpc.serialize<daemon_pb.BackupWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<daemon_pb.BackupWorkspaceResponse>;
}

export const WorkspaceContentServiceService: IWorkspaceContentServiceService;

export interface IWorkspaceContentServiceServer extends grpc.UntypedServiceImplementation {
    initWorkspace: grpc.handleUnaryCall<daemon_pb.InitWorkspaceRequest, daemon_pb.InitWorkspaceResponse>;
    waitForInit: grpc.handleUnaryCall<daemon_pb.WaitForInitRequest, daemon_pb.WaitForInitResponse>;
    takeSnapshot: grpc.handleUnaryCall<daemon_pb.TakeSnapshotRequest, daemon_pb.TakeSnapshotResponse>;
    disposeWorkspace: grpc.handleUnaryCall<daemon_pb.DisposeWorkspaceRequest, daemon_pb.DisposeWorkspaceResponse>;
    backupWorkspace: grpc.handleUnaryCall<daemon_pb.BackupWorkspaceRequest, daemon_pb.BackupWorkspaceResponse>;
}

export interface IWorkspaceContentServiceClient {
    initWorkspace(request: daemon_pb.InitWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    initWorkspace(request: daemon_pb.InitWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    initWorkspace(request: daemon_pb.InitWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    waitForInit(request: daemon_pb.WaitForInitRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    waitForInit(request: daemon_pb.WaitForInitRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    waitForInit(request: daemon_pb.WaitForInitRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    takeSnapshot(request: daemon_pb.TakeSnapshotRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    takeSnapshot(request: daemon_pb.TakeSnapshotRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    takeSnapshot(request: daemon_pb.TakeSnapshotRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    disposeWorkspace(request: daemon_pb.DisposeWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    disposeWorkspace(request: daemon_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    disposeWorkspace(request: daemon_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    backupWorkspace(request: daemon_pb.BackupWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.BackupWorkspaceResponse) => void): grpc.ClientUnaryCall;
    backupWorkspace(request: daemon_pb.BackupWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.BackupWorkspaceResponse) => void): grpc.ClientUnaryCall;
    backupWorkspace(request: daemon_pb.BackupWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.BackupWorkspaceResponse) => void): grpc.ClientUnaryCall;
}

export class WorkspaceContentServiceClient extends grpc.Client implements IWorkspaceContentServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public initWorkspace(request: daemon_pb.InitWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public initWorkspace(request: daemon_pb.InitWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public initWorkspace(request: daemon_pb.InitWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.InitWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public waitForInit(request: daemon_pb.WaitForInitRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    public waitForInit(request: daemon_pb.WaitForInitRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    public waitForInit(request: daemon_pb.WaitForInitRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.WaitForInitResponse) => void): grpc.ClientUnaryCall;
    public takeSnapshot(request: daemon_pb.TakeSnapshotRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    public takeSnapshot(request: daemon_pb.TakeSnapshotRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    public takeSnapshot(request: daemon_pb.TakeSnapshotRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.TakeSnapshotResponse) => void): grpc.ClientUnaryCall;
    public disposeWorkspace(request: daemon_pb.DisposeWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public disposeWorkspace(request: daemon_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public disposeWorkspace(request: daemon_pb.DisposeWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.DisposeWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public backupWorkspace(request: daemon_pb.BackupWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: daemon_pb.BackupWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public backupWorkspace(request: daemon_pb.BackupWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: daemon_pb.BackupWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public backupWorkspace(request: daemon_pb.BackupWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: daemon_pb.BackupWorkspaceResponse) => void): grpc.ClientUnaryCall;
}
