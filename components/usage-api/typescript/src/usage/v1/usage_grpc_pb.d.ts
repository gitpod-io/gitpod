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
    getCostCenter: IUsageServiceService_IGetCostCenter;
    setCostCenter: IUsageServiceService_ISetCostCenter;
    reconcileUsageWithLedger: IUsageServiceService_IReconcileUsageWithLedger;
    listUsage: IUsageServiceService_IListUsage;
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
interface IUsageServiceService_ISetCostCenter extends grpc.MethodDefinition<usage_v1_usage_pb.SetCostCenterRequest, usage_v1_usage_pb.SetCostCenterResponse> {
    path: "/usage.v1.UsageService/SetCostCenter";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_usage_pb.SetCostCenterRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_usage_pb.SetCostCenterRequest>;
    responseSerialize: grpc.serialize<usage_v1_usage_pb.SetCostCenterResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_usage_pb.SetCostCenterResponse>;
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
    getCostCenter: grpc.handleUnaryCall<usage_v1_usage_pb.GetCostCenterRequest, usage_v1_usage_pb.GetCostCenterResponse>;
    setCostCenter: grpc.handleUnaryCall<usage_v1_usage_pb.SetCostCenterRequest, usage_v1_usage_pb.SetCostCenterResponse>;
    reconcileUsageWithLedger: grpc.handleUnaryCall<usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, usage_v1_usage_pb.ReconcileUsageWithLedgerResponse>;
    listUsage: grpc.handleUnaryCall<usage_v1_usage_pb.ListUsageRequest, usage_v1_usage_pb.ListUsageResponse>;
}

export interface IUsageServiceClient {
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    setCostCenter(request: usage_v1_usage_pb.SetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.SetCostCenterResponse) => void): grpc.ClientUnaryCall;
    setCostCenter(request: usage_v1_usage_pb.SetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.SetCostCenterResponse) => void): grpc.ClientUnaryCall;
    setCostCenter(request: usage_v1_usage_pb.SetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.SetCostCenterResponse) => void): grpc.ClientUnaryCall;
    reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    listUsage(request: usage_v1_usage_pb.ListUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
}

export class UsageServiceClient extends grpc.Client implements IUsageServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public getCostCenter(request: usage_v1_usage_pb.GetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.GetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public setCostCenter(request: usage_v1_usage_pb.SetCostCenterRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.SetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public setCostCenter(request: usage_v1_usage_pb.SetCostCenterRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.SetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public setCostCenter(request: usage_v1_usage_pb.SetCostCenterRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.SetCostCenterResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    public reconcileUsageWithLedger(request: usage_v1_usage_pb.ReconcileUsageWithLedgerRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ReconcileUsageWithLedgerResponse) => void): grpc.ClientUnaryCall;
    public listUsage(request: usage_v1_usage_pb.ListUsageRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    public listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
    public listUsage(request: usage_v1_usage_pb.ListUsageRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_usage_pb.ListUsageResponse) => void): grpc.ClientUnaryCall;
}
