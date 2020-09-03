// package: supervisor
// file: supervisor.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as supervisor_pb from "./supervisor_pb";

interface IBackupServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    prepare: IBackupServiceService_IPrepare;
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

export const BackupServiceService: IBackupServiceService;

export interface IBackupServiceServer {
    prepare: grpc.handleUnaryCall<supervisor_pb.PrepareBackupRequest, supervisor_pb.PrepareBackupResponse>;
}

export interface IBackupServiceClient {
    prepare(request: supervisor_pb.PrepareBackupRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
}

export class BackupServiceClient extends grpc.Client implements IBackupServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public prepare(request: supervisor_pb.PrepareBackupRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    public prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
    public prepare(request: supervisor_pb.PrepareBackupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.PrepareBackupResponse) => void): grpc.ClientUnaryCall;
}

interface IStatusServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    supervisorStatus: IStatusServiceService_ISupervisorStatus;
    iDEStatus: IStatusServiceService_IIDEStatus;
    backupStatus: IStatusServiceService_IBackupStatus;
    contentStatus: IStatusServiceService_IContentStatus;
}

interface IStatusServiceService_ISupervisorStatus extends grpc.MethodDefinition<supervisor_pb.SupervisorStatusRequest, supervisor_pb.SupervisorStatusResponse> {
    path: string; // "/supervisor.StatusService/SupervisorStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.SupervisorStatusRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.SupervisorStatusRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.SupervisorStatusResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.SupervisorStatusResponse>;
}
interface IStatusServiceService_IIDEStatus extends grpc.MethodDefinition<supervisor_pb.IDEStatusRequest, supervisor_pb.IDEStatusResponse> {
    path: string; // "/supervisor.StatusService/IDEStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.IDEStatusRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.IDEStatusRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.IDEStatusResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.IDEStatusResponse>;
}
interface IStatusServiceService_IBackupStatus extends grpc.MethodDefinition<supervisor_pb.BackupStatusRequest, supervisor_pb.BackupStatusResponse> {
    path: string; // "/supervisor.StatusService/BackupStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.BackupStatusRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.BackupStatusRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.BackupStatusResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.BackupStatusResponse>;
}
interface IStatusServiceService_IContentStatus extends grpc.MethodDefinition<supervisor_pb.ContentStatusRequest, supervisor_pb.ContentStatusResponse> {
    path: string; // "/supervisor.StatusService/ContentStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<supervisor_pb.ContentStatusRequest>;
    requestDeserialize: grpc.deserialize<supervisor_pb.ContentStatusRequest>;
    responseSerialize: grpc.serialize<supervisor_pb.ContentStatusResponse>;
    responseDeserialize: grpc.deserialize<supervisor_pb.ContentStatusResponse>;
}

export const StatusServiceService: IStatusServiceService;

export interface IStatusServiceServer {
    supervisorStatus: grpc.handleUnaryCall<supervisor_pb.SupervisorStatusRequest, supervisor_pb.SupervisorStatusResponse>;
    iDEStatus: grpc.handleUnaryCall<supervisor_pb.IDEStatusRequest, supervisor_pb.IDEStatusResponse>;
    backupStatus: grpc.handleUnaryCall<supervisor_pb.BackupStatusRequest, supervisor_pb.BackupStatusResponse>;
    contentStatus: grpc.handleUnaryCall<supervisor_pb.ContentStatusRequest, supervisor_pb.ContentStatusResponse>;
}

export interface IStatusServiceClient {
    supervisorStatus(request: supervisor_pb.SupervisorStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    supervisorStatus(request: supervisor_pb.SupervisorStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    supervisorStatus(request: supervisor_pb.SupervisorStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    iDEStatus(request: supervisor_pb.IDEStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    iDEStatus(request: supervisor_pb.IDEStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    iDEStatus(request: supervisor_pb.IDEStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    backupStatus(request: supervisor_pb.BackupStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    backupStatus(request: supervisor_pb.BackupStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    backupStatus(request: supervisor_pb.BackupStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: supervisor_pb.ContentStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
}

export class StatusServiceClient extends grpc.Client implements IStatusServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public supervisorStatus(request: supervisor_pb.SupervisorStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    public supervisorStatus(request: supervisor_pb.SupervisorStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    public supervisorStatus(request: supervisor_pb.SupervisorStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    public iDEStatus(request: supervisor_pb.IDEStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    public iDEStatus(request: supervisor_pb.IDEStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    public iDEStatus(request: supervisor_pb.IDEStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    public backupStatus(request: supervisor_pb.BackupStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    public backupStatus(request: supervisor_pb.BackupStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    public backupStatus(request: supervisor_pb.BackupStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: supervisor_pb.ContentStatusRequest, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: supervisor_pb.ContentStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: supervisor_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
}
