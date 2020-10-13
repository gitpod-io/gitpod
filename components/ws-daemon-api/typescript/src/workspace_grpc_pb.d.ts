/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: wsbs
// file: workspace.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as workspace_pb from "./workspace_pb";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";

interface IInWorkspaceHelperService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    backupCanary: IInWorkspaceHelperService_IBackupCanary;
    pauseTheia: IInWorkspaceHelperService_IPauseTheia;
    gitStatus: IInWorkspaceHelperService_IGitStatus;
}

interface IInWorkspaceHelperService_IBackupCanary extends grpc.MethodDefinition<workspace_pb.BackupCanaryResponse, workspace_pb.BackupCanaryRequest> {
    path: string; // "/wsbs.InWorkspaceHelper/BackupCanary"
    requestStream: boolean; // true
    responseStream: boolean; // true
    requestSerialize: grpc.serialize<workspace_pb.BackupCanaryResponse>;
    requestDeserialize: grpc.deserialize<workspace_pb.BackupCanaryResponse>;
    responseSerialize: grpc.serialize<workspace_pb.BackupCanaryRequest>;
    responseDeserialize: grpc.deserialize<workspace_pb.BackupCanaryRequest>;
}
interface IInWorkspaceHelperService_IPauseTheia extends grpc.MethodDefinition<workspace_pb.PauseTheiaRequest, workspace_pb.PauseTheiaResponse> {
    path: string; // "/wsbs.InWorkspaceHelper/PauseTheia"
    requestStream: boolean; // true
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<workspace_pb.PauseTheiaRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.PauseTheiaRequest>;
    responseSerialize: grpc.serialize<workspace_pb.PauseTheiaResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.PauseTheiaResponse>;
}
interface IInWorkspaceHelperService_IGitStatus extends grpc.MethodDefinition<workspace_pb.GitStatusRequest, workspace_pb.GitStatusResponse> {
    path: string; // "/wsbs.InWorkspaceHelper/GitStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<workspace_pb.GitStatusRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.GitStatusRequest>;
    responseSerialize: grpc.serialize<workspace_pb.GitStatusResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.GitStatusResponse>;
}

export const InWorkspaceHelperService: IInWorkspaceHelperService;

export interface IInWorkspaceHelperServer {
    backupCanary: grpc.handleBidiStreamingCall<workspace_pb.BackupCanaryResponse, workspace_pb.BackupCanaryRequest>;
    pauseTheia: grpc.handleClientStreamingCall<workspace_pb.PauseTheiaRequest, workspace_pb.PauseTheiaResponse>;
    gitStatus: grpc.handleUnaryCall<workspace_pb.GitStatusRequest, workspace_pb.GitStatusResponse>;
}

export interface IInWorkspaceHelperClient {
    backupCanary(): grpc.ClientDuplexStream<workspace_pb.BackupCanaryResponse, workspace_pb.BackupCanaryRequest>;
    backupCanary(options: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<workspace_pb.BackupCanaryResponse, workspace_pb.BackupCanaryRequest>;
    backupCanary(metadata: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<workspace_pb.BackupCanaryResponse, workspace_pb.BackupCanaryRequest>;
    pauseTheia(callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    pauseTheia(metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    pauseTheia(options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    pauseTheia(metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    gitStatus(request: workspace_pb.GitStatusRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.GitStatusResponse) => void): grpc.ClientUnaryCall;
    gitStatus(request: workspace_pb.GitStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.GitStatusResponse) => void): grpc.ClientUnaryCall;
    gitStatus(request: workspace_pb.GitStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.GitStatusResponse) => void): grpc.ClientUnaryCall;
}

export class InWorkspaceHelperClient extends grpc.Client implements IInWorkspaceHelperClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public backupCanary(options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<workspace_pb.BackupCanaryResponse, workspace_pb.BackupCanaryRequest>;
    public backupCanary(metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<workspace_pb.BackupCanaryResponse, workspace_pb.BackupCanaryRequest>;
    public pauseTheia(callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    public pauseTheia(metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    public pauseTheia(options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    public pauseTheia(metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.PauseTheiaResponse) => void): grpc.ClientWritableStream<workspace_pb.PauseTheiaRequest>;
    public gitStatus(request: workspace_pb.GitStatusRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.GitStatusResponse) => void): grpc.ClientUnaryCall;
    public gitStatus(request: workspace_pb.GitStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.GitStatusResponse) => void): grpc.ClientUnaryCall;
    public gitStatus(request: workspace_pb.GitStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.GitStatusResponse) => void): grpc.ClientUnaryCall;
}
