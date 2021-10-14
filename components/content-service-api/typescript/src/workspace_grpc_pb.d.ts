// package: contentservice
// file: workspace.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as workspace_pb from "./workspace_pb";

interface IWorkspaceServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    workspaceDownloadURL: IWorkspaceServiceService_IWorkspaceDownloadURL;
    deleteWorkspace: IWorkspaceServiceService_IDeleteWorkspace;
}

interface IWorkspaceServiceService_IWorkspaceDownloadURL extends grpc.MethodDefinition<workspace_pb.WorkspaceDownloadURLRequest, workspace_pb.WorkspaceDownloadURLResponse> {
    path: "/contentservice.WorkspaceService/WorkspaceDownloadURL";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.WorkspaceDownloadURLRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.WorkspaceDownloadURLRequest>;
    responseSerialize: grpc.serialize<workspace_pb.WorkspaceDownloadURLResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.WorkspaceDownloadURLResponse>;
}
interface IWorkspaceServiceService_IDeleteWorkspace extends grpc.MethodDefinition<workspace_pb.DeleteWorkspaceRequest, workspace_pb.DeleteWorkspaceResponse> {
    path: "/contentservice.WorkspaceService/DeleteWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.DeleteWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.DeleteWorkspaceRequest>;
    responseSerialize: grpc.serialize<workspace_pb.DeleteWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.DeleteWorkspaceResponse>;
}

export const WorkspaceServiceService: IWorkspaceServiceService;

export interface IWorkspaceServiceServer extends grpc.UntypedServiceImplementation {
    workspaceDownloadURL: grpc.handleUnaryCall<workspace_pb.WorkspaceDownloadURLRequest, workspace_pb.WorkspaceDownloadURLResponse>;
    deleteWorkspace: grpc.handleUnaryCall<workspace_pb.DeleteWorkspaceRequest, workspace_pb.DeleteWorkspaceResponse>;
}

export interface IWorkspaceServiceClient {
    workspaceDownloadURL(request: workspace_pb.WorkspaceDownloadURLRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceDownloadURLResponse) => void): grpc.ClientUnaryCall;
    workspaceDownloadURL(request: workspace_pb.WorkspaceDownloadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceDownloadURLResponse) => void): grpc.ClientUnaryCall;
    workspaceDownloadURL(request: workspace_pb.WorkspaceDownloadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceDownloadURLResponse) => void): grpc.ClientUnaryCall;
    deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
}

export class WorkspaceServiceClient extends grpc.Client implements IWorkspaceServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public workspaceDownloadURL(request: workspace_pb.WorkspaceDownloadURLRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public workspaceDownloadURL(request: workspace_pb.WorkspaceDownloadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public workspaceDownloadURL(request: workspace_pb.WorkspaceDownloadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.WorkspaceDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
    public deleteWorkspace(request: workspace_pb.DeleteWorkspaceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.DeleteWorkspaceResponse) => void): grpc.ClientUnaryCall;
}
