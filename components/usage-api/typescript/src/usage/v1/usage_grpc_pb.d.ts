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
    reconcileUsage: IUsageServiceService_IReconcileUsage;
    getCostCenter: IUsageServiceService_IGetCostCenter;
    reconcileUsageWithLedger: IUsageServiceService_IReconcileUsageWithLedger;
    listUsage: IUsageServiceService_IListUsage;
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
interface IUsageServiceService_IGetCostCenter extends grpc.MethodDefinition<usage_v1_usage_pb.GetCostCenterRequest, usage_v1_usage_pb.GetCostCenterResponse> {
    path: "/usage.v1.UsageService/GetCostCenter";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.GetCostCenterRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.GetCostCenterRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.GetCostCenterResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.GetCostCenterResponse>;
}
interface IUsageServiceService_IReconcileUsageWithLedger extends grpc.MethodDefinition<usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, usage_v1_usage_pb.ReconcileUsageWithLedgerResponse> {
    path: "/usage.v1.UsageService/ReconcileUsageWithLedger";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.ReconcileUsageWithLedgerRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.ReconcileUsageWithLedgerRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.ReconcileUsageWithLedgerResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.ReconcileUsageWithLedgerResponse>;
}
interface IUsageServiceService_IListUsage extends grpc.MethodDefinition<usage_v1_usage_pb.ListUsageRequest, usage_v1_usage_pb.ListUsageResponse> {
    path: "/usage.v1.UsageService/ListUsage";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.ListUsageRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.ListUsageRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.ListUsageResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.ListUsageResponse>;
}

export const UsageServiceService: IUsageServiceService;

export interface IUsageServiceServer extends grpc.UntypedServiceImplementation {
    reconcileUsage: grpc.handleUnaryCall<usage_v1_usage_pb.ReconcileUsageRequest, usage_v1_usage_pb.ReconcileUsageResponse>;
    getCostCenter: grpc.handleUnaryCall<usage_v1_usage_pb.GetCostCenterRequest, usage_v1_usage_pb.GetCostCenterResponse>;
    reconcileUsageWithLedger: grpc.handleUnaryCall<usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, usage_v1_usage_pb.ReconcileUsageWithLedgerResponse>;
    listUsage: grpc.handleUnaryCall<usage_v1_usage_pb.ListUsageRequest, usage_v1_usage_pb.ListUsageResponse>;
}

export interface IUsageServiceClient {
    reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    listUsage(request: usage_v1_usage_pb.ListUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
}

export class UsageServiceClient extends grpc.Client implements IUsageServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsage(request: usage_v1_usage_pb.ReconcileUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    public listUsage(request: usage_v1_usage_pb.ListUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    public listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    public listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
}
