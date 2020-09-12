// package: supervisor
// file: editor.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as editor_pb from "./editor_pb";

interface IEditorServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    list: IEditorServiceService_IList;
    open: IEditorServiceService_IOpen;
    close: IEditorServiceService_IClose;
    getActive: IEditorServiceService_IGetActive;
    setActive: IEditorServiceService_ISetActive;
    write: IEditorServiceService_IWrite;
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
interface IEditorServiceService_IGetActive extends grpc.MethodDefinition<editor_pb.GetActiveEditorRequest, editor_pb.GetActiveEditorResponse> {
    path: string; // "/supervisor.EditorService/GetActive"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<editor_pb.GetActiveEditorRequest>;
    requestDeserialize: grpc.deserialize<editor_pb.GetActiveEditorRequest>;
    responseSerialize: grpc.serialize<editor_pb.GetActiveEditorResponse>;
    responseDeserialize: grpc.deserialize<editor_pb.GetActiveEditorResponse>;
}
interface IEditorServiceService_ISetActive extends grpc.MethodDefinition<editor_pb.SetActiveEditorRequest, editor_pb.SetActiveEditorResponse> {
    path: string; // "/supervisor.EditorService/SetActive"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<editor_pb.SetActiveEditorRequest>;
    requestDeserialize: grpc.deserialize<editor_pb.SetActiveEditorRequest>;
    responseSerialize: grpc.serialize<editor_pb.SetActiveEditorResponse>;
    responseDeserialize: grpc.deserialize<editor_pb.SetActiveEditorResponse>;
}
interface IEditorServiceService_IWrite extends grpc.MethodDefinition<editor_pb.WriteEditorRequest, editor_pb.WriteEditorResponse> {
    path: string; // "/supervisor.EditorService/Write"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<editor_pb.WriteEditorRequest>;
    requestDeserialize: grpc.deserialize<editor_pb.WriteEditorRequest>;
    responseSerialize: grpc.serialize<editor_pb.WriteEditorResponse>;
    responseDeserialize: grpc.deserialize<editor_pb.WriteEditorResponse>;
}

export const EditorServiceService: IEditorServiceService;

export interface IEditorServiceServer {
    list: grpc.handleUnaryCall<editor_pb.ListEditorsRequest, editor_pb.ListEditorsResponse>;
    open: grpc.handleUnaryCall<editor_pb.OpenEditorRequest, editor_pb.OpenEditorResponse>;
    close: grpc.handleUnaryCall<editor_pb.CloseEditorRequest, editor_pb.CloseEditorResponse>;
    getActive: grpc.handleUnaryCall<editor_pb.GetActiveEditorRequest, editor_pb.GetActiveEditorResponse>;
    setActive: grpc.handleUnaryCall<editor_pb.SetActiveEditorRequest, editor_pb.SetActiveEditorResponse>;
    write: grpc.handleUnaryCall<editor_pb.WriteEditorRequest, editor_pb.WriteEditorResponse>;
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
    getActive(request: editor_pb.GetActiveEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.GetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    getActive(request: editor_pb.GetActiveEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.GetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    getActive(request: editor_pb.GetActiveEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.GetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    setActive(request: editor_pb.SetActiveEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.SetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    setActive(request: editor_pb.SetActiveEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.SetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    setActive(request: editor_pb.SetActiveEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.SetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    write(request: editor_pb.WriteEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.WriteEditorResponse) => void): grpc.ClientUnaryCall;
    write(request: editor_pb.WriteEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.WriteEditorResponse) => void): grpc.ClientUnaryCall;
    write(request: editor_pb.WriteEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.WriteEditorResponse) => void): grpc.ClientUnaryCall;
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
    public getActive(request: editor_pb.GetActiveEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.GetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    public getActive(request: editor_pb.GetActiveEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.GetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    public getActive(request: editor_pb.GetActiveEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.GetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    public setActive(request: editor_pb.SetActiveEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.SetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    public setActive(request: editor_pb.SetActiveEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.SetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    public setActive(request: editor_pb.SetActiveEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.SetActiveEditorResponse) => void): grpc.ClientUnaryCall;
    public write(request: editor_pb.WriteEditorRequest, callback: (error: grpc.ServiceError | null, response: editor_pb.WriteEditorResponse) => void): grpc.ClientUnaryCall;
    public write(request: editor_pb.WriteEditorRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: editor_pb.WriteEditorResponse) => void): grpc.ClientUnaryCall;
    public write(request: editor_pb.WriteEditorRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: editor_pb.WriteEditorResponse) => void): grpc.ClientUnaryCall;
}
