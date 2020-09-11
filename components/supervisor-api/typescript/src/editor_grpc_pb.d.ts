// package: supervisor
// file: editor.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as editor_pb from "./editor_pb";

interface IEditorServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    list: IEditorServiceService_IList;
    open: IEditorServiceService_IOpen;
    close: IEditorServiceService_IClose;
}

interface IEditorServiceService_IList extends grpc.MethodDefinition<editor_pb.ListEditorsRequest, editor_pb.ListEditorsResponse> {
    path: string; // "/supervisor.EditorService/List"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<editor_pb.ListEditorsRequest>;
    requestDeserialize: grpc.deserialize<editor_pb.ListEditorsRequest>;
    responseSerialize: grpc.serialize<editor_pb.ListEditorsResponse>;
    responseDeserialize: grpc.deserialize<editor_pb.ListEditorsResponse>;
}
interface IEditorServiceService_IOpen extends grpc.MethodDefinition<editor_pb.OpenEditorRequest, editor_pb.OpenEditorResponse> {
    path: string; // "/supervisor.EditorService/Open"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<editor_pb.OpenEditorRequest>;
    requestDeserialize: grpc.deserialize<editor_pb.OpenEditorRequest>;
    responseSerialize: grpc.serialize<editor_pb.OpenEditorResponse>;
    responseDeserialize: grpc.deserialize<editor_pb.OpenEditorResponse>;
}
interface IEditorServiceService_IClose extends grpc.MethodDefinition<editor_pb.CloseEditorRequest, editor_pb.CloseEditorResponse> {
    path: string; // "/supervisor.EditorService/Close"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<editor_pb.CloseEditorRequest>;
    requestDeserialize: grpc.deserialize<editor_pb.CloseEditorRequest>;
    responseSerialize: grpc.serialize<editor_pb.CloseEditorResponse>;
    responseDeserialize: grpc.deserialize<editor_pb.CloseEditorResponse>;
}

export const EditorServiceService: IEditorServiceService;

export interface IEditorServiceServer {
    list: grpc.handleUnaryCall<editor_pb.ListEditorsRequest, editor_pb.ListEditorsResponse>;
    open: grpc.handleUnaryCall<editor_pb.OpenEditorRequest, editor_pb.OpenEditorResponse>;
    close: grpc.handleUnaryCall<editor_pb.CloseEditorRequest, editor_pb.CloseEditorResponse>;
}

export interface IEditorServiceClient {
    list(request: editor_pb.ListEditorsRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.ListEditorsResponse) => void): grpc.ClientUnaryCall;
    list(request: editor_pb.ListEditorsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.ListEditorsResponse) => void): grpc.ClientUnaryCall;
    list(request: editor_pb.ListEditorsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.ListEditorsResponse) => void): grpc.ClientUnaryCall;
    open(request: editor_pb.OpenEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.OpenEditorResponse) => void): grpc.ClientUnaryCall;
    open(request: editor_pb.OpenEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.OpenEditorResponse) => void): grpc.ClientUnaryCall;
    open(request: editor_pb.OpenEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.OpenEditorResponse) => void): grpc.ClientUnaryCall;
    close(request: editor_pb.CloseEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.CloseEditorResponse) => void): grpc.ClientUnaryCall;
    close(request: editor_pb.CloseEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.CloseEditorResponse) => void): grpc.ClientUnaryCall;
    close(request: editor_pb.CloseEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.CloseEditorResponse) => void): grpc.ClientUnaryCall;
}

export class EditorServiceClient extends grpc.Client implements IEditorServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public list(request: editor_pb.ListEditorsRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.ListEditorsResponse) => void): grpc.ClientUnaryCall;
    public list(request: editor_pb.ListEditorsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.ListEditorsResponse) => void): grpc.ClientUnaryCall;
    public list(request: editor_pb.ListEditorsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.ListEditorsResponse) => void): grpc.ClientUnaryCall;
    public open(request: editor_pb.OpenEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.OpenEditorResponse) => void): grpc.ClientUnaryCall;
    public open(request: editor_pb.OpenEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.OpenEditorResponse) => void): grpc.ClientUnaryCall;
    public open(request: editor_pb.OpenEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.OpenEditorResponse) => void): grpc.ClientUnaryCall;
    public close(request: editor_pb.CloseEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.CloseEditorResponse) => void): grpc.ClientUnaryCall;
    public close(request: editor_pb.CloseEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.CloseEditorResponse) => void): grpc.ClientUnaryCall;
    public close(request: editor_pb.CloseEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.CloseEditorResponse) => void): grpc.ClientUnaryCall;
}
