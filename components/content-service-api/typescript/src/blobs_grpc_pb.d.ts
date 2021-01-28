/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: blobs.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as blobs_pb from "./blobs_pb";

interface IBlobServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    uploadUrl: IBlobServiceService_IUploadUrl;
    downloadUrl: IBlobServiceService_IDownloadUrl;
}

interface IBlobServiceService_IUploadUrl extends grpc.MethodDefinition<blobs_pb.UploadUrlRequest, blobs_pb.UploadUrlResponse> {
    path: string; // "/contentservice.BlobService/UploadUrl"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<blobs_pb.UploadUrlRequest>;
    requestDeserialize: grpc.deserialize<blobs_pb.UploadUrlRequest>;
    responseSerialize: grpc.serialize<blobs_pb.UploadUrlResponse>;
    responseDeserialize: grpc.deserialize<blobs_pb.UploadUrlResponse>;
}
interface IBlobServiceService_IDownloadUrl extends grpc.MethodDefinition<blobs_pb.DownloadUrlRequest, blobs_pb.DownloadUrlResponse> {
    path: string; // "/contentservice.BlobService/DownloadUrl"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<blobs_pb.DownloadUrlRequest>;
    requestDeserialize: grpc.deserialize<blobs_pb.DownloadUrlRequest>;
    responseSerialize: grpc.serialize<blobs_pb.DownloadUrlResponse>;
    responseDeserialize: grpc.deserialize<blobs_pb.DownloadUrlResponse>;
}

export const BlobServiceService: IBlobServiceService;

export interface IBlobServiceServer {
    uploadUrl: grpc.handleUnaryCall<blobs_pb.UploadUrlRequest, blobs_pb.UploadUrlResponse>;
    downloadUrl: grpc.handleUnaryCall<blobs_pb.DownloadUrlRequest, blobs_pb.DownloadUrlResponse>;
}

export interface IBlobServiceClient {
    uploadUrl(request: blobs_pb.UploadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    downloadUrl(request: blobs_pb.DownloadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
}

export class BlobServiceClient extends grpc.Client implements IBlobServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public uploadUrl(request: blobs_pb.UploadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    public uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    public uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    public downloadUrl(request: blobs_pb.DownloadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    public downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    public downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
}
