/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: builder
// file: imgbuilder.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as imgbuilder_pb from "./imgbuilder_pb";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";

interface IImageBuilderService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    resolveBaseImage: IImageBuilderService_IResolveBaseImage;
    resolveWorkspaceImage: IImageBuilderService_IResolveWorkspaceImage;
    build: IImageBuilderService_IBuild;
    logs: IImageBuilderService_ILogs;
    listBuilds: IImageBuilderService_IListBuilds;
}

interface IImageBuilderService_IResolveBaseImage extends grpc.MethodDefinition<imgbuilder_pb.ResolveBaseImageRequest, imgbuilder_pb.ResolveBaseImageResponse> {
    path: "/builder.ImageBuilder/ResolveBaseImage";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<imgbuilder_pb.ResolveBaseImageRequest>;
    requestDeserialize: grpc.deserialize<imgbuilder_pb.ResolveBaseImageRequest>;
    responseSerialize: grpc.serialize<imgbuilder_pb.ResolveBaseImageResponse>;
    responseDeserialize: grpc.deserialize<imgbuilder_pb.ResolveBaseImageResponse>;
}
interface IImageBuilderService_IResolveWorkspaceImage extends grpc.MethodDefinition<imgbuilder_pb.ResolveWorkspaceImageRequest, imgbuilder_pb.ResolveWorkspaceImageResponse> {
    path: "/builder.ImageBuilder/ResolveWorkspaceImage";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<imgbuilder_pb.ResolveWorkspaceImageRequest>;
    requestDeserialize: grpc.deserialize<imgbuilder_pb.ResolveWorkspaceImageRequest>;
    responseSerialize: grpc.serialize<imgbuilder_pb.ResolveWorkspaceImageResponse>;
    responseDeserialize: grpc.deserialize<imgbuilder_pb.ResolveWorkspaceImageResponse>;
}
interface IImageBuilderService_IBuild extends grpc.MethodDefinition<imgbuilder_pb.BuildRequest, imgbuilder_pb.BuildResponse> {
    path: "/builder.ImageBuilder/Build";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<imgbuilder_pb.BuildRequest>;
    requestDeserialize: grpc.deserialize<imgbuilder_pb.BuildRequest>;
    responseSerialize: grpc.serialize<imgbuilder_pb.BuildResponse>;
    responseDeserialize: grpc.deserialize<imgbuilder_pb.BuildResponse>;
}
interface IImageBuilderService_ILogs extends grpc.MethodDefinition<imgbuilder_pb.LogsRequest, imgbuilder_pb.LogsResponse> {
    path: "/builder.ImageBuilder/Logs";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<imgbuilder_pb.LogsRequest>;
    requestDeserialize: grpc.deserialize<imgbuilder_pb.LogsRequest>;
    responseSerialize: grpc.serialize<imgbuilder_pb.LogsResponse>;
    responseDeserialize: grpc.deserialize<imgbuilder_pb.LogsResponse>;
}
interface IImageBuilderService_IListBuilds extends grpc.MethodDefinition<imgbuilder_pb.ListBuildsRequest, imgbuilder_pb.ListBuildsResponse> {
    path: "/builder.ImageBuilder/ListBuilds";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<imgbuilder_pb.ListBuildsRequest>;
    requestDeserialize: grpc.deserialize<imgbuilder_pb.ListBuildsRequest>;
    responseSerialize: grpc.serialize<imgbuilder_pb.ListBuildsResponse>;
    responseDeserialize: grpc.deserialize<imgbuilder_pb.ListBuildsResponse>;
}

export const ImageBuilderService: IImageBuilderService;

export interface IImageBuilderServer extends grpc.UntypedServiceImplementation {
    resolveBaseImage: grpc.handleUnaryCall<imgbuilder_pb.ResolveBaseImageRequest, imgbuilder_pb.ResolveBaseImageResponse>;
    resolveWorkspaceImage: grpc.handleUnaryCall<imgbuilder_pb.ResolveWorkspaceImageRequest, imgbuilder_pb.ResolveWorkspaceImageResponse>;
    build: grpc.handleServerStreamingCall<imgbuilder_pb.BuildRequest, imgbuilder_pb.BuildResponse>;
    logs: grpc.handleServerStreamingCall<imgbuilder_pb.LogsRequest, imgbuilder_pb.LogsResponse>;
    listBuilds: grpc.handleUnaryCall<imgbuilder_pb.ListBuildsRequest, imgbuilder_pb.ListBuildsResponse>;
}

export interface IImageBuilderClient {
    resolveBaseImage(request: imgbuilder_pb.ResolveBaseImageRequest, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveBaseImageResponse) => void): grpc.ClientUnaryCall;
    resolveBaseImage(request: imgbuilder_pb.ResolveBaseImageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveBaseImageResponse) => void): grpc.ClientUnaryCall;
    resolveBaseImage(request: imgbuilder_pb.ResolveBaseImageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveBaseImageResponse) => void): grpc.ClientUnaryCall;
    resolveWorkspaceImage(request: imgbuilder_pb.ResolveWorkspaceImageRequest, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveWorkspaceImageResponse) => void): grpc.ClientUnaryCall;
    resolveWorkspaceImage(request: imgbuilder_pb.ResolveWorkspaceImageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveWorkspaceImageResponse) => void): grpc.ClientUnaryCall;
    resolveWorkspaceImage(request: imgbuilder_pb.ResolveWorkspaceImageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveWorkspaceImageResponse) => void): grpc.ClientUnaryCall;
    build(request: imgbuilder_pb.BuildRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.BuildResponse>;
    build(request: imgbuilder_pb.BuildRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.BuildResponse>;
    logs(request: imgbuilder_pb.LogsRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.LogsResponse>;
    logs(request: imgbuilder_pb.LogsRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.LogsResponse>;
    listBuilds(request: imgbuilder_pb.ListBuildsRequest, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ListBuildsResponse) => void): grpc.ClientUnaryCall;
    listBuilds(request: imgbuilder_pb.ListBuildsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ListBuildsResponse) => void): grpc.ClientUnaryCall;
    listBuilds(request: imgbuilder_pb.ListBuildsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ListBuildsResponse) => void): grpc.ClientUnaryCall;
}

export class ImageBuilderClient extends grpc.Client implements IImageBuilderClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public resolveBaseImage(request: imgbuilder_pb.ResolveBaseImageRequest, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveBaseImageResponse) => void): grpc.ClientUnaryCall;
    public resolveBaseImage(request: imgbuilder_pb.ResolveBaseImageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveBaseImageResponse) => void): grpc.ClientUnaryCall;
    public resolveBaseImage(request: imgbuilder_pb.ResolveBaseImageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveBaseImageResponse) => void): grpc.ClientUnaryCall;
    public resolveWorkspaceImage(request: imgbuilder_pb.ResolveWorkspaceImageRequest, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveWorkspaceImageResponse) => void): grpc.ClientUnaryCall;
    public resolveWorkspaceImage(request: imgbuilder_pb.ResolveWorkspaceImageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveWorkspaceImageResponse) => void): grpc.ClientUnaryCall;
    public resolveWorkspaceImage(request: imgbuilder_pb.ResolveWorkspaceImageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ResolveWorkspaceImageResponse) => void): grpc.ClientUnaryCall;
    public build(request: imgbuilder_pb.BuildRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.BuildResponse>;
    public build(request: imgbuilder_pb.BuildRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.BuildResponse>;
    public logs(request: imgbuilder_pb.LogsRequest, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.LogsResponse>;
    public logs(request: imgbuilder_pb.LogsRequest, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<imgbuilder_pb.LogsResponse>;
    public listBuilds(request: imgbuilder_pb.ListBuildsRequest, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ListBuildsResponse) => void): grpc.ClientUnaryCall;
    public listBuilds(request: imgbuilder_pb.ListBuildsRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ListBuildsResponse) => void): grpc.ClientUnaryCall;
    public listBuilds(request: imgbuilder_pb.ListBuildsRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: imgbuilder_pb.ListBuildsResponse) => void): grpc.ClientUnaryCall;
}
