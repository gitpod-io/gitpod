// package: contentservice
// file: streams.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as streams_pb from "./streams_pb";

interface ILogStreamServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    startStream: ILogStreamServiceService_IStartStream;
    commitStream: ILogStreamServiceService_ICommitStream;
    accessStream: ILogStreamServiceService_IAccessStream;
}

interface ILogStreamServiceService_IStartStream extends grpc.MethodDefinition<streams_pb.StartStreamRequest, streams_pb.StartStreamResponse> {
    path: "/contentservice.LogStreamService/StartStream";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<streams_pb.StartStreamRequest>;
    requestDeserialize: grpc.deserialize<streams_pb.StartStreamRequest>;
    responseSerialize: grpc.serialize<streams_pb.StartStreamResponse>;
    responseDeserialize: grpc.deserialize<streams_pb.StartStreamResponse>;
}
interface ILogStreamServiceService_ICommitStream extends grpc.MethodDefinition<streams_pb.CommitStreamRequest, streams_pb.CommitStreamResponse> {
    path: "/contentservice.LogStreamService/CommitStream";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<streams_pb.CommitStreamRequest>;
    requestDeserialize: grpc.deserialize<streams_pb.CommitStreamRequest>;
    responseSerialize: grpc.serialize<streams_pb.CommitStreamResponse>;
    responseDeserialize: grpc.deserialize<streams_pb.CommitStreamResponse>;
}
interface ILogStreamServiceService_IAccessStream extends grpc.MethodDefinition<streams_pb.AccessStreamRequest, streams_pb.AccessStreamResponse> {
    path: "/contentservice.LogStreamService/AccessStream";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<streams_pb.AccessStreamRequest>;
    requestDeserialize: grpc.deserialize<streams_pb.AccessStreamRequest>;
    responseSerialize: grpc.serialize<streams_pb.AccessStreamResponse>;
    responseDeserialize: grpc.deserialize<streams_pb.AccessStreamResponse>;
}

export const LogStreamServiceService: ILogStreamServiceService;

export interface ILogStreamServiceServer extends grpc.UntypedServiceImplementation {
    startStream: grpc.handleUnaryCall<streams_pb.StartStreamRequest, streams_pb.StartStreamResponse>;
    commitStream: grpc.handleUnaryCall<streams_pb.CommitStreamRequest, streams_pb.CommitStreamResponse>;
    accessStream: grpc.handleUnaryCall<streams_pb.AccessStreamRequest, streams_pb.AccessStreamResponse>;
}

export interface ILogStreamServiceClient {
    startStream(request: streams_pb.StartStreamRequest, callback: (error: grpc.ServiceError | null, response: streams_pb.StartStreamResponse) => void): grpc.ClientUnaryCall;
    startStream(request: streams_pb.StartStreamRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: streams_pb.StartStreamResponse) => void): grpc.ClientUnaryCall;
    startStream(request: streams_pb.StartStreamRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: streams_pb.StartStreamResponse) => void): grpc.ClientUnaryCall;
    commitStream(request: streams_pb.CommitStreamRequest, callback: (error: grpc.ServiceError | null, response: streams_pb.CommitStreamResponse) => void): grpc.ClientUnaryCall;
    commitStream(request: streams_pb.CommitStreamRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: streams_pb.CommitStreamResponse) => void): grpc.ClientUnaryCall;
    commitStream(request: streams_pb.CommitStreamRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: streams_pb.CommitStreamResponse) => void): grpc.ClientUnaryCall;
    accessStream(request: streams_pb.AccessStreamRequest, callback: (error: grpc.ServiceError | null, response: streams_pb.AccessStreamResponse) => void): grpc.ClientUnaryCall;
    accessStream(request: streams_pb.AccessStreamRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: streams_pb.AccessStreamResponse) => void): grpc.ClientUnaryCall;
    accessStream(request: streams_pb.AccessStreamRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: streams_pb.AccessStreamResponse) => void): grpc.ClientUnaryCall;
}

export class LogStreamServiceClient extends grpc.Client implements ILogStreamServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public startStream(request: streams_pb.StartStreamRequest, callback: (error: grpc.ServiceError | null, response: streams_pb.StartStreamResponse) => void): grpc.ClientUnaryCall;
    public startStream(request: streams_pb.StartStreamRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: streams_pb.StartStreamResponse) => void): grpc.ClientUnaryCall;
    public startStream(request: streams_pb.StartStreamRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: streams_pb.StartStreamResponse) => void): grpc.ClientUnaryCall;
    public commitStream(request: streams_pb.CommitStreamRequest, callback: (error: grpc.ServiceError | null, response: streams_pb.CommitStreamResponse) => void): grpc.ClientUnaryCall;
    public commitStream(request: streams_pb.CommitStreamRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: streams_pb.CommitStreamResponse) => void): grpc.ClientUnaryCall;
    public commitStream(request: streams_pb.CommitStreamRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: streams_pb.CommitStreamResponse) => void): grpc.ClientUnaryCall;
    public accessStream(request: streams_pb.AccessStreamRequest, callback: (error: grpc.ServiceError | null, response: streams_pb.AccessStreamResponse) => void): grpc.ClientUnaryCall;
    public accessStream(request: streams_pb.AccessStreamRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: streams_pb.AccessStreamResponse) => void): grpc.ClientUnaryCall;
    public accessStream(request: streams_pb.AccessStreamRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: streams_pb.AccessStreamResponse) => void): grpc.ClientUnaryCall;
}
