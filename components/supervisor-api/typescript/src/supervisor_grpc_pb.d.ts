/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: supervisor
// file: supervisor.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as supervisor_pb from "./supervisor_pb";

interface IBackupServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    prepare: IBackupServiceService_IPrepare;
    status: IBackupServiceService_IStatus;
    debugPauseTheia: IBackupServiceService_IDebugPauseTheia;
    contentStatus: IBackupServiceService_IContentStatus;
}

interface IBackupServiceService_IPrepare extends grpc.MethodDefinition<supervisor_pb.PrepareBackupRequest, supervisor_pb.PrepareBackupResponse> {
    path: string; // "/supervisor.BackupService/Prepare"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.PrepareBackupRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.PrepareBackupRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.PrepareBackupResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.PrepareBackupResponse>;
}
interface IBackupServiceService_IStatus extends grpc.MethodDefinition<supervisor_pb.StatusRequest, supervisor_pb.StatusResponse> {
    path: string; // "/supervisor.BackupService/Status"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.StatusRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.StatusRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.StatusResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.StatusResponse>;
}
interface IBackupServiceService_IDebugPauseTheia extends grpc.MethodDefinition<supervisor_pb.DebugPauseTheiaRequest, supervisor_pb.DebugPauseTheiaResponse> {
    path: string; // "/supervisor.BackupService/DebugPauseTheia"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.DebugPauseTheiaRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.DebugPauseTheiaRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.DebugPauseTheiaResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.DebugPauseTheiaResponse>;
}
interface IBackupServiceService_IContentStatus extends grpc.MethodDefinition<supervisor_pb.ContentStatusRequest, supervisor_pb.ContentStatusResponse> {
    path: string; // "/supervisor.BackupService/ContentStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.ContentStatusRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.ContentStatusRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.ContentStatusResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.ContentStatusResponse>;
}

export const BackupServiceService: IBackupServiceService;

export interface IBackupServiceServer {
    prepare: grpc.handleUnaryCall<supervisor_pb.PrepareBackupRequest, supervisor_pb.PrepareBackupResponse>;
    status: grpc.handleUnaryCall<supervisor_pb.StatusRequest, supervisor_pb.StatusResponse>;
    debugPauseTheia: grpc.handleUnaryCall<supervisor_pb.DebugPauseTheiaRequest, supervisor_pb.DebugPauseTheiaResponse>;
    contentStatus: grpc.handleUnaryCall<supervisor_pb.ContentStatusRequest, supervisor_pb.ContentStatusResponse>;
}

export interface IBackupServiceClient {
    prepare(request: supervisor_pb.PrepareBackupRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    status(request: supervisor_pb.StatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.StatusResponse) => void): grpc.ClientUnaryCall;
    status(request: supervisor_pb.StatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.StatusResponse) => void): grpc.ClientUnaryCall;
    status(request: supervisor_pb.StatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.StatusResponse) => void): grpc.ClientUnaryCall;
    debugPauseTheia(request: supervisor_pb.DebugPauseTheiaRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.DebugPauseTheiaResponse) => void): grpc.ClientUnaryCall;
    debugPauseTheia(request: supervisor_pb.DebugPauseTheiaRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.DebugPauseTheiaResponse) => void): grpc.ClientUnaryCall;
    debugPauseTheia(request: supervisor_pb.DebugPauseTheiaRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.DebugPauseTheiaResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: supervisor_pb.ContentStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
}

export class BackupServiceClient extends grpc.Client implements IBackupServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public prepare(request: supervisor_pb.PrepareBackupRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    public prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    public prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    public status(request: supervisor_pb.StatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.StatusResponse) => void): grpc.ClientUnaryCall;
    public status(request: supervisor_pb.StatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.StatusResponse) => void): grpc.ClientUnaryCall;
    public status(request: supervisor_pb.StatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.StatusResponse) => void): grpc.ClientUnaryCall;
    public debugPauseTheia(request: supervisor_pb.DebugPauseTheiaRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.DebugPauseTheiaResponse) => void): grpc.ClientUnaryCall;
    public debugPauseTheia(request: supervisor_pb.DebugPauseTheiaRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.DebugPauseTheiaResponse) => void): grpc.ClientUnaryCall;
    public debugPauseTheia(request: supervisor_pb.DebugPauseTheiaRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.DebugPauseTheiaResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: supervisor_pb.ContentStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
}
