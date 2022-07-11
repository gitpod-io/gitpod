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
    getBilledUsage: IUsageServiceService_IGetBilledUsage;
}

interface IUsageServiceService_IGetBilledUsage extends grpc.MethodDefinition<usage_v1_usage_pb.GetBilledUsageRequest, usage_v1_usage_pb.GetBilledUsageResponse> {
    path: "/usage.v1.UsageService/GetBilledUsage";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.GetBilledUsageRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.GetBilledUsageRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.GetBilledUsageResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.GetBilledUsageResponse>;
}

export const UsageServiceService: IUsageServiceService;

export interface IUsageServiceServer extends grpc.UntypedServiceImplementation {
    getBilledUsage: grpc.handleUnaryCall<usage_v1_usage_pb.GetBilledUsageRequest, usage_v1_usage_pb.GetBilledUsageResponse>;
}

export interface IUsageServiceClient {
    getBilledUsage(request: usage_v1_usage_pb.GetBilledUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetBilledUsageResponse) => void): grpc.ClientUnaryCall;
    getBilledUsage(request: usage_v1_usage_pb.GetBilledUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetBilledUsageResponse) => void): grpc.ClientUnaryCall;
    getBilledUsage(request: usage_v1_usage_pb.GetBilledUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetBilledUsageResponse) => void): grpc.ClientUnaryCall;
}

export class UsageServiceClient extends grpc.Client implements IUsageServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getBilledUsage(request: usage_v1_usage_pb.GetBilledUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetBilledUsageResponse) => void): grpc.ClientUnaryCall;
    public getBilledUsage(request: usage_v1_usage_pb.GetBilledUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetBilledUsageResponse) => void): grpc.ClientUnaryCall;
    public getBilledUsage(request: usage_v1_usage_pb.GetBilledUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetBilledUsageResponse) => void): grpc.ClientUnaryCall;
}
