// package: supervisor
// file: status.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as status_pb from "./status_pb";

interface IStatusServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    supervisorStatus: IStatusServiceService_ISupervisorStatus;
    iDEStatus: IStatusServiceService_IIDEStatus;
    contentStatus: IStatusServiceService_IContentStatus;
    backupStatus: IStatusServiceService_IBackupStatus;
    portsStatus: IStatusServiceService_IPortsStatus;
}

interface IStatusServiceService_ISupervisorStatus extends grpc.MethodDefinition<status_pb.SupervisorStatusRequest, status_pb.SupervisorStatusResponse> {
    path: string; // "/supervisor.StatusService/SupervisorStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<status_pb.SupervisorStatusRequest>;
    requestDeserialize: grpc.deserialize<status_pb.SupervisorStatusRequest>;
    responseSerialize: grpc.serialize<status_pb.SupervisorStatusResponse>;
    responseDeserialize: grpc.deserialize<status_pb.SupervisorStatusResponse>;
}
interface IStatusServiceService_IIDEStatus extends grpc.MethodDefinition<status_pb.IDEStatusRequest, status_pb.IDEStatusResponse> {
    path: string; // "/supervisor.StatusService/IDEStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<status_pb.IDEStatusRequest>;
    requestDeserialize: grpc.deserialize<status_pb.IDEStatusRequest>;
    responseSerialize: grpc.serialize<status_pb.IDEStatusResponse>;
    responseDeserialize: grpc.deserialize<status_pb.IDEStatusResponse>;
}
interface IStatusServiceService_IContentStatus extends grpc.MethodDefinition<status_pb.ContentStatusRequest, status_pb.ContentStatusResponse> {
    path: string; // "/supervisor.StatusService/ContentStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<status_pb.ContentStatusRequest>;
    requestDeserialize: grpc.deserialize<status_pb.ContentStatusRequest>;
    responseSerialize: grpc.serialize<status_pb.ContentStatusResponse>;
    responseDeserialize: grpc.deserialize<status_pb.ContentStatusResponse>;
}
interface IStatusServiceService_IBackupStatus extends grpc.MethodDefinition<status_pb.BackupStatusRequest, status_pb.BackupStatusResponse> {
    path: string; // "/supervisor.StatusService/BackupStatus"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<status_pb.BackupStatusRequest>;
    requestDeserialize: grpc.deserialize<status_pb.BackupStatusRequest>;
    responseSerialize: grpc.serialize<status_pb.BackupStatusResponse>;
    responseDeserialize: grpc.deserialize<status_pb.BackupStatusResponse>;
}
interface IStatusServiceService_IPortsStatus extends grpc.MethodDefinition<status_pb.PortsStatusRequest, status_pb.PortsStatusResponse> {
    path: string; // "/supervisor.StatusService/PortsStatus"
    requestStream: boolean; // false
    responseStream: boolean; // true
    requestSerialize: grpc.serialize<status_pb.PortsStatusRequest>;
    requestDeserialize: grpc.deserialize<status_pb.PortsStatusRequest>;
    responseSerialize: grpc.serialize<status_pb.PortsStatusResponse>;
    responseDeserialize: grpc.deserialize<status_pb.PortsStatusResponse>;
}

export const StatusServiceService: IStatusServiceService;

export interface IStatusServiceServer {
    supervisorStatus: grpc.handleUnaryCall<status_pb.SupervisorStatusRequest, status_pb.SupervisorStatusResponse>;
    iDEStatus: grpc.handleUnaryCall<status_pb.IDEStatusRequest, status_pb.IDEStatusResponse>;
    contentStatus: grpc.handleUnaryCall<status_pb.ContentStatusRequest, status_pb.ContentStatusResponse>;
    backupStatus: grpc.handleUnaryCall<status_pb.BackupStatusRequest, status_pb.BackupStatusResponse>;
    portsStatus: grpc.handleServerStreamingCall<status_pb.PortsStatusRequest, status_pb.PortsStatusResponse>;
}

export interface IStatusServiceClient {
    supervisorStatus(request: status_pb.SupervisorStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    supervisorStatus(request: status_pb.SupervisorStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    supervisorStatus(request: status_pb.SupervisorStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    iDEStatus(request: status_pb.IDEStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    iDEStatus(request: status_pb.IDEStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    iDEStatus(request: status_pb.IDEStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: status_pb.ContentStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: status_pb.ContentStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    contentStatus(request: status_pb.ContentStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    backupStatus(request: status_pb.BackupStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    backupStatus(request: status_pb.BackupStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    backupStatus(request: status_pb.BackupStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    portsStatus(request: status_pb.PortsStatusRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<status_pb.PortsStatusResponse>;
    portsStatus(request: status_pb.PortsStatusRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<status_pb.PortsStatusResponse>;
}

export class StatusServiceClient extends grpc.Client implements IStatusServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public supervisorStatus(request: status_pb.SupervisorStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    public supervisorStatus(request: status_pb.SupervisorStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    public supervisorStatus(request: status_pb.SupervisorStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.SupervisorStatusResponse) => void): grpc.ClientUnaryCall;
    public iDEStatus(request: status_pb.IDEStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    public iDEStatus(request: status_pb.IDEStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    public iDEStatus(request: status_pb.IDEStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.IDEStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: status_pb.ContentStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: status_pb.ContentStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    public contentStatus(request: status_pb.ContentStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.ContentStatusResponse) => void): grpc.ClientUnaryCall;
    public backupStatus(request: status_pb.BackupStatusRequest, callback: (error: grpc.ServiceError | null, response: status_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    public backupStatus(request: status_pb.BackupStatusRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: status_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    public backupStatus(request: status_pb.BackupStatusRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: status_pb.BackupStatusResponse) => void): grpc.ClientUnaryCall;
    public portsStatus(request: status_pb.PortsStatusRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<status_pb.PortsStatusResponse>;
    public portsStatus(request: status_pb.PortsStatusRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<status_pb.PortsStatusResponse>;
}
