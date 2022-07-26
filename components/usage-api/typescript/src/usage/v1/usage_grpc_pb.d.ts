/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: usage.v1
// file: usage/v1/usage.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as usage_v1_usage_pb from "../../usage/v1/usage_pb";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";

interface IUsageServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    listBilledUsage: IUsageServiceService_IListBilledUsage;
}

interface IUsageServiceService_IListBilledUsage extends grpc.MethodDefinition<usage_v1_usage_pb.ListBilledUsageRequest, usage_v1_usage_pb.ListBilledUsageResponse> {
    path: "/usage.v1.UsageService/ListBilledUsage";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.ListBilledUsageRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.ListBilledUsageRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.ListBilledUsageResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.ListBilledUsageResponse>;
}

export const UsageServiceService: IUsageServiceService;

export interface IUsageServiceServer extends grpc.UntypedServiceImplementation {
    listBilledUsage: grpc.handleUnaryCall<usage_v1_usage_pb.ListBilledUsageRequest, usage_v1_usage_pb.ListBilledUsageResponse>;
}

export interface IUsageServiceClient {
    listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
}

export class UsageServiceClient extends grpc.Client implements IUsageServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    public listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    public listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
}
