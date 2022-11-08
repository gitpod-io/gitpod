/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: workspace.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as workspace_pb from "./workspace_pb";

interface IWorkspaceServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    deleteWorkspace: IWorkspaceServiceService_IDeleteWorkspace;
    workspaceSnapshotExists: IWorkspaceServiceService_IWorkspaceSnapshotExists;
}

interface IWorkspaceServiceService_IDeleteWorkspace extends grpc.MethodDefinition<workspace_pb.DeleteWorkspaceRequest, workspace_pb.DeleteWorkspaceResponse> {
    path: "/contentservice.WorkspaceService/DeleteWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.DeleteWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.DeleteWorkspaceRequest>;
    responseSerialize: grpc.serialize<workspace_pb.DeleteWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.DeleteWorkspaceResponse>;
}
interface IWorkspaceServiceService_IWorkspaceSnapshotExists extends grpc.MethodDefinition<workspace_pb.WorkspaceSnapshotExistsRequest, workspace_pb.WorkspaceSnapshotExistsResponse> {
    path: "/contentservice.WorkspaceService/WorkspaceSnapshotExists";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.WorkspaceSnapshotExistsRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.WorkspaceSnapshotExistsRequest>;
    responseSerialize: grpc.serialize<workspace_pb.WorkspaceSnapshotExistsResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.WorkspaceSnapshotExistsResponse>;
}

export const WorkspaceServiceService: IWorkspaceServiceService;

export interface IWorkspaceServiceServer extends grpc.UntypedServiceImplementation {
    deleteWorkspace: grpc.handleUnaryCall<workspace_pb.DeleteWorkspaceRequest, workspace_pb.DeleteWorkspaceResponse>;
    workspaceSnapshotExists: grpc.handleUnaryCall<workspace_pb.WorkspaceSnapshotExistsRequest, workspace_pb.WorkspaceSnapshotExistsResponse>;
}

export interface IWorkspaceServiceClient {
    deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    workspaceSnapshotExists(request: workspace_pb.WorkspaceSnapshotExistsRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceSnapshotExistsResponse) => void): grpc.ClientUnaryCall;
    workspaceSnapshotExists(request: workspace_pb.WorkspaceSnapshotExistsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceSnapshotExistsResponse) => void): grpc.ClientUnaryCall;
    workspaceSnapshotExists(request: workspace_pb.WorkspaceSnapshotExistsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceSnapshotExistsResponse) => void): grpc.ClientUnaryCall;
}

export class WorkspaceServiceClient extends grpc.Client implements IWorkspaceServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public workspaceSnapshotExists(request: workspace_pb.WorkspaceSnapshotExistsRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceSnapshotExistsResponse) => void): grpc.ClientUnaryCall;
    public workspaceSnapshotExists(request: workspace_pb.WorkspaceSnapshotExistsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceSnapshotExistsResponse) => void): grpc.ClientUnaryCall;
    public workspaceSnapshotExists(request: workspace_pb.WorkspaceSnapshotExistsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceSnapshotExistsResponse) => void): grpc.ClientUnaryCall;
}
