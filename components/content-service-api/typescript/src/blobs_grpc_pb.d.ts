// package: contentservice
// file: blobs.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as blobs_pb from "./blobs_pb";

interface IBlobServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    uploadUrl: IBlobServiceService_IUploadUrl;
    downloadUrl: IBlobServiceService_IDownloadUrl;
    delete: IBlobServiceService_IDelete;
}

interface IBlobServiceService_IUploadUrl extends grpc.MethodDefinition<blobs_pb.UploadUrlRequest, blobs_pb.UploadUrlResponse> {
    path: "/contentservice.BlobService/UploadUrl";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<blobs_pb.UploadUrlRequest>;
    requestDeserialize: grpc.deserialize<blobs_pb.UploadUrlRequest>;
    responseSerialize: grpc.serialize<blobs_pb.UploadUrlResponse>;
    responseDeserialize: grpc.deserialize<blobs_pb.UploadUrlResponse>;
}
interface IBlobServiceService_IDownloadUrl extends grpc.MethodDefinition<blobs_pb.DownloadUrlRequest, blobs_pb.DownloadUrlResponse> {
    path: "/contentservice.BlobService/DownloadUrl";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<blobs_pb.DownloadUrlRequest>;
    requestDeserialize: grpc.deserialize<blobs_pb.DownloadUrlRequest>;
    responseSerialize: grpc.serialize<blobs_pb.DownloadUrlResponse>;
    responseDeserialize: grpc.deserialize<blobs_pb.DownloadUrlResponse>;
}
interface IBlobServiceService_IDelete extends grpc.MethodDefinition<blobs_pb.DeleteRequest, blobs_pb.DeleteResponse> {
    path: "/contentservice.BlobService/Delete";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<blobs_pb.DeleteRequest>;
    requestDeserialize: grpc.deserialize<blobs_pb.DeleteRequest>;
    responseSerialize: grpc.serialize<blobs_pb.DeleteResponse>;
    responseDeserialize: grpc.deserialize<blobs_pb.DeleteResponse>;
}

export const BlobServiceService: IBlobServiceService;

export interface IBlobServiceServer extends grpc.UntypedServiceImplementation {
    uploadUrl: grpc.handleUnaryCall<blobs_pb.UploadUrlRequest, blobs_pb.UploadUrlResponse>;
    downloadUrl: grpc.handleUnaryCall<blobs_pb.DownloadUrlRequest, blobs_pb.DownloadUrlResponse>;
    delete: grpc.handleUnaryCall<blobs_pb.DeleteRequest, blobs_pb.DeleteResponse>;
}

export interface IBlobServiceClient {
    uploadUrl(request: blobs_pb.UploadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    downloadUrl(request: blobs_pb.DownloadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    delete(request: blobs_pb.DeleteRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.DeleteResponse) => void): grpc.ClientUnaryCall;
    delete(request: blobs_pb.DeleteRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.DeleteResponse) => void): grpc.ClientUnaryCall;
    delete(request: blobs_pb.DeleteRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.DeleteResponse) => void): grpc.ClientUnaryCall;
}

export class BlobServiceClient extends grpc.Client implements IBlobServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public uploadUrl(request: blobs_pb.UploadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    public uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    public uploadUrl(request: blobs_pb.UploadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.UploadUrlResponse) => void): grpc.ClientUnaryCall;
    public downloadUrl(request: blobs_pb.DownloadUrlRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    public downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    public downloadUrl(request: blobs_pb.DownloadUrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.DownloadUrlResponse) => void): grpc.ClientUnaryCall;
    public delete(request: blobs_pb.DeleteRequest, callback: (error: grpc.ServiceError | null, response: blobs_pb.DeleteResponse) => void): grpc.ClientUnaryCall;
    public delete(request: blobs_pb.DeleteRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: blobs_pb.DeleteResponse) => void): grpc.ClientUnaryCall;
    public delete(request: blobs_pb.DeleteRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: blobs_pb.DeleteResponse) => void): grpc.ClientUnaryCall;
}
