/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: usage.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as usage_pb from "./usage_pb";

interface IUsageReportServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    uploadURL: IUsageReportServiceService_IUploadURL;
    downloadURL: IUsageReportServiceService_IDownloadURL;
}

interface IUsageReportServiceService_IUploadURL extends grpc.MethodDefinition<usage_pb.UsageReportUploadURLRequest, usage_pb.UsageReportUploadURLResponse> {
    path: "/contentservice.UsageReportService/UploadURL";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_pb.UsageReportUploadURLRequest>;
    requestDeserialize: grpc.deserialize<usage_pb.UsageReportUploadURLRequest>;
    responseSerialize: grpc.serialize<usage_pb.UsageReportUploadURLResponse>;
    responseDeserialize: grpc.deserialize<usage_pb.UsageReportUploadURLResponse>;
}
interface IUsageReportServiceService_IDownloadURL extends grpc.MethodDefinition<usage_pb.UsageReportDownloadURLRequest, usage_pb.UsageReportDownloadURLResponse> {
    path: "/contentservice.UsageReportService/DownloadURL";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_pb.UsageReportDownloadURLRequest>;
    requestDeserialize: grpc.deserialize<usage_pb.UsageReportDownloadURLRequest>;
    responseSerialize: grpc.serialize<usage_pb.UsageReportDownloadURLResponse>;
    responseDeserialize: grpc.deserialize<usage_pb.UsageReportDownloadURLResponse>;
}

export const UsageReportServiceService: IUsageReportServiceService;

export interface IUsageReportServiceServer extends grpc.UntypedServiceImplementation {
    uploadURL: grpc.handleUnaryCall<usage_pb.UsageReportUploadURLRequest, usage_pb.UsageReportUploadURLResponse>;
    downloadURL: grpc.handleUnaryCall<usage_pb.UsageReportDownloadURLRequest, usage_pb.UsageReportDownloadURLResponse>;
}

export interface IUsageReportServiceClient {
    uploadURL(request: usage_pb.UsageReportUploadURLRequest, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportUploadURLResponse) => void): grpc.ClientUnaryCall;
    uploadURL(request: usage_pb.UsageReportUploadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportUploadURLResponse) => void): grpc.ClientUnaryCall;
    uploadURL(request: usage_pb.UsageReportUploadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportUploadURLResponse) => void): grpc.ClientUnaryCall;
    downloadURL(request: usage_pb.UsageReportDownloadURLRequest, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportDownloadURLResponse) => void): grpc.ClientUnaryCall;
    downloadURL(request: usage_pb.UsageReportDownloadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportDownloadURLResponse) => void): grpc.ClientUnaryCall;
    downloadURL(request: usage_pb.UsageReportDownloadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportDownloadURLResponse) => void): grpc.ClientUnaryCall;
}

export class UsageReportServiceClient extends grpc.Client implements IUsageReportServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public uploadURL(request: usage_pb.UsageReportUploadURLRequest, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportUploadURLResponse) => void): grpc.ClientUnaryCall;
    public uploadURL(request: usage_pb.UsageReportUploadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportUploadURLResponse) => void): grpc.ClientUnaryCall;
    public uploadURL(request: usage_pb.UsageReportUploadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportUploadURLResponse) => void): grpc.ClientUnaryCall;
    public downloadURL(request: usage_pb.UsageReportDownloadURLRequest, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public downloadURL(request: usage_pb.UsageReportDownloadURLRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportDownloadURLResponse) => void): grpc.ClientUnaryCall;
    public downloadURL(request: usage_pb.UsageReportDownloadURLRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_pb.UsageReportDownloadURLResponse) => void): grpc.ClientUnaryCall;
}
