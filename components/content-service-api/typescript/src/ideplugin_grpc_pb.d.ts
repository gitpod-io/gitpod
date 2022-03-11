/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: ideplugin
// file: ideplugin.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as ideplugin_pb from "./ideplugin_pb";

interface IIDEPluginServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    uploadURL: IIDEPluginServiceService_IUploadURL;
    downloadURL: IIDEPluginServiceService_IDownloadURL;
    pluginHash: IIDEPluginServiceService_IPluginHash;
}

interface IIDEPluginServiceService_IUploadURL extends grpc.MethodDefinition<ideplugin_pb.PluginUploadURLRequest, ideplugin_pb.PluginUploadURLResponse> {
    path: "/ideplugin.IDEPluginService/UploadURL";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<ideplugin_pb.PluginUploadURLRequest>;
    requestDeserialize: grpc.deserialize<ideplugin_pb.PluginUploadURLRequest>;
    responseSerialize: grpc.serialize<ideplugin_pb.PluginUploadURLResponse>;
    responseDeserialize: grpc.deserialize<ideplugin_pb.PluginUploadURLResponse>;
}
interface IIDEPluginServiceService_IDownloadURL extends grpc.MethodDefinition<ideplugin_pb.PluginDownloadURLRequest, ideplugin_pb.PluginDownloadURLResponse> {
    path: "/ideplugin.IDEPluginService/DownloadURL";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<ideplugin_pb.PluginDownloadURLRequest>;
    requestDeserialize: grpc.deserialize<ideplugin_pb.PluginDownloadURLRequest>;
    responseSerialize: grpc.serialize<ideplugin_pb.PluginDownloadURLResponse>;
    responseDeserialize: grpc.deserialize<ideplugin_pb.PluginDownloadURLResponse>;
}
interface IIDEPluginServiceService_IPluginHash extends grpc.MethodDefinition<ideplugin_pb.PluginHashRequest, ideplugin_pb.PluginHashResponse> {
    path: "/ideplugin.IDEPluginService/PluginHash";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<ideplugin_pb.PluginHashRequest>;
    requestDeserialize: grpc.deserialize<ideplugin_pb.PluginHashRequest>;
    responseSerialize: grpc.serialize<ideplugin_pb.PluginHashResponse>;
    responseDeserialize: grpc.deserialize<ideplugin_pb.PluginHashResponse>;
}

export const IDEPluginServiceService: IIDEPluginServiceService;

export interface IIDEPluginServiceServer extends grpc.UntypedServiceImplementation {
    uploadURL: grpc.handleUnaryCall<ideplugin_pb.PluginUploadURLRequest, ideplugin_pb.PluginUploadURLResponse>;
    downloadURL: grpc.handleUnaryCall<ideplugin_pb.PluginDownloadURLRequest, ideplugin_pb.PluginDownloadURLResponse>;
    pluginHash: grpc.handleUnaryCall<ideplugin_pb.PluginHashRequest, ideplugin_pb.PluginHashResponse>;
}

export interface IIDEPluginServiceClient {
    uploadURL(request: ideplugin_pb.PluginUploadURLRequest, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginUploadURLResponse) => void): grpc.ClientUnaryCall;
    uploadURL(request: ideplugin_pb.PluginUploadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginUploadURLResponse) => void): grpc.ClientUnaryCall;
    uploadURL(request: ideplugin_pb.PluginUploadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginUploadURLResponse) => void): grpc.ClientUnaryCall;
    downloadURL(request: ideplugin_pb.PluginDownloadURLRequest, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginDownloadURLResponse) => void): grpc.ClientUnaryCall;
    downloadURL(request: ideplugin_pb.PluginDownloadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginDownloadURLResponse) => void): grpc.ClientUnaryCall;
    downloadURL(request: ideplugin_pb.PluginDownloadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginDownloadURLResponse) => void): grpc.ClientUnaryCall;
    pluginHash(request: ideplugin_pb.PluginHashRequest, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginHashResponse) => void): grpc.ClientUnaryCall;
    pluginHash(request: ideplugin_pb.PluginHashRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginHashResponse) => void): grpc.ClientUnaryCall;
    pluginHash(request: ideplugin_pb.PluginHashRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginHashResponse) => void): grpc.ClientUnaryCall;
}

export class IDEPluginServiceClient extends grpc.Client implements IIDEPluginServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public uploadURL(request: ideplugin_pb.PluginUploadURLRequest, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginUploadURLResponse) => void): grpc.ClientUnaryCall;
    public uploadURL(request: ideplugin_pb.PluginUploadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginUploadURLResponse) => void): grpc.ClientUnaryCall;
    public uploadURL(request: ideplugin_pb.PluginUploadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginUploadURLResponse) => void): grpc.ClientUnaryCall;
    public downloadURL(request: ideplugin_pb.PluginDownloadURLRequest, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public downloadURL(request: ideplugin_pb.PluginDownloadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public downloadURL(request: ideplugin_pb.PluginDownloadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public pluginHash(request: ideplugin_pb.PluginHashRequest, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginHashResponse) => void): grpc.ClientUnaryCall;
    public pluginHash(request: ideplugin_pb.PluginHashRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginHashResponse) => void): grpc.ClientUnaryCall;
    public pluginHash(request: ideplugin_pb.PluginHashRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: ideplugin_pb.PluginHashResponse) => void): grpc.ClientUnaryCall;
}
