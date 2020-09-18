/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: supervisor
// file: backup.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as backup_pb from "./backup_pb";

interface IBackupServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    prepare: IBackupServiceService_IPrepare;
}

interface IBackupServiceService_IPrepare extends grpc.MethodDefinition<backup_pb.PrepareBackupRequest, backup_pb.PrepareBackupResponse> {
    path: string; // "/supervisor.BackupService/Prepare"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<backup_pb.PrepareBackupRequest>;
    requestDeserialize: grpc.deserialize<backup_pb.PrepareBackupRequest>;
    responseSerialize: grpc.serialize<backup_pb.PrepareBackupResponse>;
    responseDeserialize: grpc.deserialize<backup_pb.PrepareBackupResponse>;
}

export const BackupServiceService: IBackupServiceService;

export interface IBackupServiceServer {
    prepare: grpc.handleUnaryCall<backup_pb.PrepareBackupRequest, backup_pb.PrepareBackupResponse>;
}

export interface IBackupServiceClient {
    prepare(request: backup_pb.PrepareBackupRequest, callback: (error: grpc.ServiceError | null, response: backup_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    prepare(request: backup_pb.PrepareBackupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: backup_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    prepare(request: backup_pb.PrepareBackupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: backup_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
}

export class BackupServiceClient extends grpc.Client implements IBackupServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public prepare(request: backup_pb.PrepareBackupRequest, callback: (error: grpc.ServiceError | null, response: backup_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    public prepare(request: backup_pb.PrepareBackupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: backup_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    public prepare(request: backup_pb.PrepareBackupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: backup_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
}
