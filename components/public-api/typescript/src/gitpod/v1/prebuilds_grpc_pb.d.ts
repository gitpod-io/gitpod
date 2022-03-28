// package: gitpod.v1
// file: gitpod/v1/prebuilds.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as gitpod_v1_prebuilds_pb from "../../gitpod/v1/prebuilds_pb";
import * as gitpod_v1_workspaces_pb from "../../gitpod/v1/workspaces_pb";
import * as google_rpc_status_pb from "../../google/rpc/status_pb";

interface IPrebuildsServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    getPrebuild: IPrebuildsServiceService_IGetPrebuild;
    getRunningPrebuild: IPrebuildsServiceService_IGetRunningPrebuild;
    listenToPrebuildStatus: IPrebuildsServiceService_IListenToPrebuildStatus;
    listenToPrebuildLogs: IPrebuildsServiceService_IListenToPrebuildLogs;
}

interface IPrebuildsServiceService_IGetPrebuild extends grpc.MethodDefinition<gitpod_v1_prebuilds_pb.GetPrebuildRequest, gitpod_v1_prebuilds_pb.GetPrebuildResponse> {
    path: "/gitpod.v1.PrebuildsService/GetPrebuild";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.GetPrebuildRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.GetPrebuildRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.GetPrebuildResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.GetPrebuildResponse>;
}
interface IPrebuildsServiceService_IGetRunningPrebuild extends grpc.MethodDefinition<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse> {
    path: "/gitpod.v1.PrebuildsService/GetRunningPrebuild";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse>;
}
interface IPrebuildsServiceService_IListenToPrebuildStatus extends grpc.MethodDefinition<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest, gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse> {
    path: "/gitpod.v1.PrebuildsService/ListenToPrebuildStatus";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse>;
}
interface IPrebuildsServiceService_IListenToPrebuildLogs extends grpc.MethodDefinition<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest, gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse> {
    path: "/gitpod.v1.PrebuildsService/ListenToPrebuildLogs";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest>;
    requestDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest>;
    responseSerialize: grpc.serialize<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse>;
    responseDeserialize: grpc.deserialize<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse>;
}

export const PrebuildsServiceService: IPrebuildsServiceService;

export interface IPrebuildsServiceServer extends grpc.UntypedServiceImplementation {
    getPrebuild: grpc.handleUnaryCall<gitpod_v1_prebuilds_pb.GetPrebuildRequest, gitpod_v1_prebuilds_pb.GetPrebuildResponse>;
    getRunningPrebuild: grpc.handleUnaryCall<gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse>;
    listenToPrebuildStatus: grpc.handleServerStreamingCall<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest, gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse>;
    listenToPrebuildLogs: grpc.handleServerStreamingCall<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest, gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse>;
}

export interface IPrebuildsServiceClient {
    getPrebuild(request: gitpod_v1_prebuilds_pb.GetPrebuildRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetPrebuildResponse) => void): grpc.ClientUnaryCall;
    getPrebuild(request: gitpod_v1_prebuilds_pb.GetPrebuildRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetPrebuildResponse) => void): grpc.ClientUnaryCall;
    getPrebuild(request: gitpod_v1_prebuilds_pb.GetPrebuildRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetPrebuildResponse) => void): grpc.ClientUnaryCall;
    getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    listenToPrebuildStatus(request: gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse>;
    listenToPrebuildStatus(request: gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse>;
    listenToPrebuildLogs(request: gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse>;
    listenToPrebuildLogs(request: gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse>;
}

export class PrebuildsServiceClient extends grpc.Client implements IPrebuildsServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getPrebuild(request: gitpod_v1_prebuilds_pb.GetPrebuildRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetPrebuildResponse) => void): grpc.ClientUnaryCall;
    public getPrebuild(request: gitpod_v1_prebuilds_pb.GetPrebuildRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetPrebuildResponse) => void): grpc.ClientUnaryCall;
    public getPrebuild(request: gitpod_v1_prebuilds_pb.GetPrebuildRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetPrebuildResponse) => void): grpc.ClientUnaryCall;
    public getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    public getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    public getRunningPrebuild(request: gitpod_v1_prebuilds_pb.GetRunningPrebuildRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: gitpod_v1_prebuilds_pb.GetRunningPrebuildResponse) => void): grpc.ClientUnaryCall;
    public listenToPrebuildStatus(request: gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse>;
    public listenToPrebuildStatus(request: gitpod_v1_prebuilds_pb.ListenToPrebuildStatusRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildStatusResponse>;
    public listenToPrebuildLogs(request: gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse>;
    public listenToPrebuildLogs(request: gitpod_v1_prebuilds_pb.ListenToPrebuildLogsRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<gitpod_v1_prebuilds_pb.ListenToPrebuildLogsResponse>;
}
