// package: supervisor
// file: terminal.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as terminal_pb from "./terminal_pb";

interface ITerminalServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    open: ITerminalServiceService_IOpen;
    list: ITerminalServiceService_IList;
    listen: ITerminalServiceService_IListen;
    write: ITerminalServiceService_IWrite;
    setSize: ITerminalServiceService_ISetSize;
}

interface ITerminalServiceService_IOpen extends grpc.MethodDefinition<terminal_pb.OpenTerminalRequest, terminal_pb.OpenTerminalResponse> {
    path: string; // "/supervisor.TerminalService/Open"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<terminal_pb.OpenTerminalRequest>;
    requestDeserialize: grpc.deserialize<terminal_pb.OpenTerminalRequest>;
    responseSerialize: grpc.serialize<terminal_pb.OpenTerminalResponse>;
    responseDeserialize: grpc.deserialize<terminal_pb.OpenTerminalResponse>;
}
interface ITerminalServiceService_IList extends grpc.MethodDefinition<terminal_pb.ListTerminalsRequest, terminal_pb.ListTerminalsResponse> {
    path: string; // "/supervisor.TerminalService/List"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<terminal_pb.ListTerminalsRequest>;
    requestDeserialize: grpc.deserialize<terminal_pb.ListTerminalsRequest>;
    responseSerialize: grpc.serialize<terminal_pb.ListTerminalsResponse>;
    responseDeserialize: grpc.deserialize<terminal_pb.ListTerminalsResponse>;
}
interface ITerminalServiceService_IListen extends grpc.MethodDefinition<terminal_pb.ListenTerminalRequest, terminal_pb.ListenTerminalResponse> {
    path: string; // "/supervisor.TerminalService/Listen"
    requestStream: boolean; // false
    responseStream: boolean; // true
    requestSerialize: grpc.serialize<terminal_pb.ListenTerminalRequest>;
    requestDeserialize: grpc.deserialize<terminal_pb.ListenTerminalRequest>;
    responseSerialize: grpc.serialize<terminal_pb.ListenTerminalResponse>;
    responseDeserialize: grpc.deserialize<terminal_pb.ListenTerminalResponse>;
}
interface ITerminalServiceService_IWrite extends grpc.MethodDefinition<terminal_pb.WriteTerminalRequest, terminal_pb.WriteTerminalResponse> {
    path: string; // "/supervisor.TerminalService/Write"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<terminal_pb.WriteTerminalRequest>;
    requestDeserialize: grpc.deserialize<terminal_pb.WriteTerminalRequest>;
    responseSerialize: grpc.serialize<terminal_pb.WriteTerminalResponse>;
    responseDeserialize: grpc.deserialize<terminal_pb.WriteTerminalResponse>;
}
interface ITerminalServiceService_ISetSize extends grpc.MethodDefinition<terminal_pb.SetTerminalSizeRequest, terminal_pb.SetTerminalSizeResponse> {
    path: string; // "/supervisor.TerminalService/SetSize"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<terminal_pb.SetTerminalSizeRequest>;
    requestDeserialize: grpc.deserialize<terminal_pb.SetTerminalSizeRequest>;
    responseSerialize: grpc.serialize<terminal_pb.SetTerminalSizeResponse>;
    responseDeserialize: grpc.deserialize<terminal_pb.SetTerminalSizeResponse>;
}

export const TerminalServiceService: ITerminalServiceService;

export interface ITerminalServiceServer {
    open: grpc.handleUnaryCall<terminal_pb.OpenTerminalRequest, terminal_pb.OpenTerminalResponse>;
    list: grpc.handleUnaryCall<terminal_pb.ListTerminalsRequest, terminal_pb.ListTerminalsResponse>;
    listen: grpc.handleServerStreamingCall<terminal_pb.ListenTerminalRequest, terminal_pb.ListenTerminalResponse>;
    write: grpc.handleUnaryCall<terminal_pb.WriteTerminalRequest, terminal_pb.WriteTerminalResponse>;
    setSize: grpc.handleUnaryCall<terminal_pb.SetTerminalSizeRequest, terminal_pb.SetTerminalSizeResponse>;
}

export interface ITerminalServiceClient {
    open(request: terminal_pb.OpenTerminalRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.OpenTerminalResponse) => void): grpc.ClientUnaryCall;
    open(request: terminal_pb.OpenTerminalRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.OpenTerminalResponse) => void): grpc.ClientUnaryCall;
    open(request: terminal_pb.OpenTerminalRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.OpenTerminalResponse) => void): grpc.ClientUnaryCall;
    list(request: terminal_pb.ListTerminalsRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.ListTerminalsResponse) => void): grpc.ClientUnaryCall;
    list(request: terminal_pb.ListTerminalsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.ListTerminalsResponse) => void): grpc.ClientUnaryCall;
    list(request: terminal_pb.ListTerminalsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.ListTerminalsResponse) => void): grpc.ClientUnaryCall;
    listen(request: terminal_pb.ListenTerminalRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<terminal_pb.ListenTerminalResponse>;
    listen(request: terminal_pb.ListenTerminalRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<terminal_pb.ListenTerminalResponse>;
    write(request: terminal_pb.WriteTerminalRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.WriteTerminalResponse) => void): grpc.ClientUnaryCall;
    write(request: terminal_pb.WriteTerminalRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.WriteTerminalResponse) => void): grpc.ClientUnaryCall;
    write(request: terminal_pb.WriteTerminalRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.WriteTerminalResponse) => void): grpc.ClientUnaryCall;
    setSize(request: terminal_pb.SetTerminalSizeRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.SetTerminalSizeResponse) => void): grpc.ClientUnaryCall;
    setSize(request: terminal_pb.SetTerminalSizeRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.SetTerminalSizeResponse) => void): grpc.ClientUnaryCall;
    setSize(request: terminal_pb.SetTerminalSizeRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.SetTerminalSizeResponse) => void): grpc.ClientUnaryCall;
}

export class TerminalServiceClient extends grpc.Client implements ITerminalServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public open(request: terminal_pb.OpenTerminalRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.OpenTerminalResponse) => void): grpc.ClientUnaryCall;
    public open(request: terminal_pb.OpenTerminalRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.OpenTerminalResponse) => void): grpc.ClientUnaryCall;
    public open(request: terminal_pb.OpenTerminalRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.OpenTerminalResponse) => void): grpc.ClientUnaryCall;
    public list(request: terminal_pb.ListTerminalsRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.ListTerminalsResponse) => void): grpc.ClientUnaryCall;
    public list(request: terminal_pb.ListTerminalsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.ListTerminalsResponse) => void): grpc.ClientUnaryCall;
    public list(request: terminal_pb.ListTerminalsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.ListTerminalsResponse) => void): grpc.ClientUnaryCall;
    public listen(request: terminal_pb.ListenTerminalRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<terminal_pb.ListenTerminalResponse>;
    public listen(request: terminal_pb.ListenTerminalRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<terminal_pb.ListenTerminalResponse>;
    public write(request: terminal_pb.WriteTerminalRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.WriteTerminalResponse) => void): grpc.ClientUnaryCall;
    public write(request: terminal_pb.WriteTerminalRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.WriteTerminalResponse) => void): grpc.ClientUnaryCall;
    public write(request: terminal_pb.WriteTerminalRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.WriteTerminalResponse) => void): grpc.ClientUnaryCall;
    public setSize(request: terminal_pb.SetTerminalSizeRequest, callback: (error: grpc.ServiceError | null, response: terminal_pb.SetTerminalSizeResponse) => void): grpc.ClientUnaryCall;
    public setSize(request: terminal_pb.SetTerminalSizeRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: terminal_pb.SetTerminalSizeResponse) => void): grpc.ClientUnaryCall;
    public setSize(request: terminal_pb.SetTerminalSizeRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: terminal_pb.SetTerminalSizeResponse) => void): grpc.ClientUnaryCall;
}
