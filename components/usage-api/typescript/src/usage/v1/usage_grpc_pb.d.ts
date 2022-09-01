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
    reconcileUsage: IUsageServiceService_IReconcileUsage;
    lastUsageReconcilationTime: IUsageServiceService_ILastUsageReconcilationTime;
    getCostCenter: IUsageServiceService_IGetCostCenter;
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
interface IUsageServiceService_IReconcileUsage extends grpc.MethodDefinition<usage_v1_usage_pb.ReconcileUsageRequest, usage_v1_usage_pb.ReconcileUsageResponse> {
    path: "/usage.v1.UsageService/ReconcileUsage";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.ReconcileUsageRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.ReconcileUsageRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.ReconcileUsageResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.ReconcileUsageResponse>;
}
interface IUsageServiceService_ILastUsageReconcilationTime extends grpc.MethodDefinition<usage_v1_usage_pb.LastUsageReconcilationTimeRequest, usage_v1_usage_pb.LastUsageReconcilationTimeResponse> {
    path: "/usage.v1.UsageService/LastUsageReconcilationTime";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.LastUsageReconcilationTimeRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.LastUsageReconcilationTimeRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.LastUsageReconcilationTimeResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.LastUsageReconcilationTimeResponse>;
}
interface IUsageServiceService_IGetCostCenter extends grpc.MethodDefinition<usage_v1_usage_pb.GetCostCenterRequest, usage_v1_usage_pb.GetCostCenterResponse> {
    path: "/usage.v1.UsageService/GetCostCenter";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.GetCostCenterRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.GetCostCenterRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.GetCostCenterResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.GetCostCenterResponse>;
}

export const UsageServiceService: IUsageServiceService;

export interface IUsageServiceServer extends grpc.UntypedServiceImplementation {
    listBilledUsage: grpc.handleUnaryCall<usage_v1_usage_pb.ListBilledUsageRequest, usage_v1_usage_pb.ListBilledUsageResponse>;
    reconcileUsage: grpc.handleUnaryCall<usage_v1_usage_pb.ReconcileUsageRequest, usage_v1_usage_pb.ReconcileUsageResponse>;
    lastUsageReconcilationTime: grpc.handleUnaryCall<usage_v1_usage_pb.LastUsageReconcilationTimeRequest, usage_v1_usage_pb.LastUsageReconcilationTimeResponse>;
    getCostCenter: grpc.handleUnaryCall<usage_v1_usage_pb.GetCostCenterRequest, usage_v1_usage_pb.GetCostCenterResponse>;
}

export interface IUsageServiceClient {
    listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    lastUsageReconcilationTime(request: usage_v1_usage_pb.LastUsageReconcilationTimeRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.LastUsageReconcilationTimeResponse) => void): grpc.ClientUnaryCall;
    lastUsageReconcilationTime(request: usage_v1_usage_pb.LastUsageReconcilationTimeRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.LastUsageReconcilationTimeResponse) => void): grpc.ClientUnaryCall;
    lastUsageReconcilationTime(request: usage_v1_usage_pb.LastUsageReconcilationTimeRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.LastUsageReconcilationTimeResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
}

export class UsageServiceClient extends grpc.Client implements IUsageServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    public listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    public listBilledUsage(request: usage_v1_usage_pb.ListBilledUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListBilledUsageResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    public lastUsageReconcilationTime(request: usage_v1_usage_pb.LastUsageReconcilationTimeRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.LastUsageReconcilationTimeResponse) => void): grpc.ClientUnaryCall;
    public lastUsageReconcilationTime(request: usage_v1_usage_pb.LastUsageReconcilationTimeRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.LastUsageReconcilationTimeResponse) => void): grpc.ClientUnaryCall;
    public lastUsageReconcilationTime(request: usage_v1_usage_pb.LastUsageReconcilationTimeRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.LastUsageReconcilationTimeResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
}
