/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: usage.v1
// file: usage/v1/billing.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as usage_v1_billing_pb from "../../usage/v1/billing_pb";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";
import * as usage_v1_usage_pb from "../../usage/v1/usage_pb";

interface IBillingServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    updateInvoices: IBillingServiceService_IUpdateInvoices;
    reconcileInvoices: IBillingServiceService_IReconcileInvoices;
    getUpcomingInvoice: IBillingServiceService_IGetUpcomingInvoice;
    finalizeInvoice: IBillingServiceService_IFinalizeInvoice;
    setBilledSession: IBillingServiceService_ISetBilledSession;
}

interface IBillingServiceService_IUpdateInvoices extends grpc.MethodDefinition<usage_v1_billing_pb.UpdateInvoicesRequest, usage_v1_billing_pb.UpdateInvoicesResponse> {
    path: "/usage.v1.BillingService/UpdateInvoices";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_billing_pb.UpdateInvoicesRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_billing_pb.UpdateInvoicesRequest>;
    responseSerialize: grpc.serialize<usage_v1_billing_pb.UpdateInvoicesResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_billing_pb.UpdateInvoicesResponse>;
}
interface IBillingServiceService_IReconcileInvoices extends grpc.MethodDefinition<usage_v1_billing_pb.ReconcileInvoicesRequest, usage_v1_billing_pb.ReconcileInvoicesResponse> {
    path: "/usage.v1.BillingService/ReconcileInvoices";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_billing_pb.ReconcileInvoicesRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_billing_pb.ReconcileInvoicesRequest>;
    responseSerialize: grpc.serialize<usage_v1_billing_pb.ReconcileInvoicesResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_billing_pb.ReconcileInvoicesResponse>;
}
interface IBillingServiceService_IGetUpcomingInvoice extends grpc.MethodDefinition<usage_v1_billing_pb.GetUpcomingInvoiceRequest, usage_v1_billing_pb.GetUpcomingInvoiceResponse> {
    path: "/usage.v1.BillingService/GetUpcomingInvoice";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_billing_pb.GetUpcomingInvoiceRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_billing_pb.GetUpcomingInvoiceRequest>;
    responseSerialize: grpc.serialize<usage_v1_billing_pb.GetUpcomingInvoiceResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_billing_pb.GetUpcomingInvoiceResponse>;
}
interface IBillingServiceService_IFinalizeInvoice extends grpc.MethodDefinition<usage_v1_billing_pb.FinalizeInvoiceRequest, usage_v1_billing_pb.FinalizeInvoiceResponse> {
    path: "/usage.v1.BillingService/FinalizeInvoice";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_billing_pb.FinalizeInvoiceRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_billing_pb.FinalizeInvoiceRequest>;
    responseSerialize: grpc.serialize<usage_v1_billing_pb.FinalizeInvoiceResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_billing_pb.FinalizeInvoiceResponse>;
}
interface IBillingServiceService_ISetBilledSession extends grpc.MethodDefinition<usage_v1_billing_pb.SetBilledSessionRequest, usage_v1_billing_pb.SetBilledSessionResponse> {
    path: "/usage.v1.BillingService/SetBilledSession";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<usage_v1_billing_pb.SetBilledSessionRequest>;
    requestDeserialize: grpc.deserialize<usage_v1_billing_pb.SetBilledSessionRequest>;
    responseSerialize: grpc.serialize<usage_v1_billing_pb.SetBilledSessionResponse>;
    responseDeserialize: grpc.deserialize<usage_v1_billing_pb.SetBilledSessionResponse>;
}

export const BillingServiceService: IBillingServiceService;

export interface IBillingServiceServer extends grpc.UntypedServiceImplementation {
    updateInvoices: grpc.handleUnaryCall<usage_v1_billing_pb.UpdateInvoicesRequest, usage_v1_billing_pb.UpdateInvoicesResponse>;
    reconcileInvoices: grpc.handleUnaryCall<usage_v1_billing_pb.ReconcileInvoicesRequest, usage_v1_billing_pb.ReconcileInvoicesResponse>;
    getUpcomingInvoice: grpc.handleUnaryCall<usage_v1_billing_pb.GetUpcomingInvoiceRequest, usage_v1_billing_pb.GetUpcomingInvoiceResponse>;
    finalizeInvoice: grpc.handleUnaryCall<usage_v1_billing_pb.FinalizeInvoiceRequest, usage_v1_billing_pb.FinalizeInvoiceResponse>;
    setBilledSession: grpc.handleUnaryCall<usage_v1_billing_pb.SetBilledSessionRequest, usage_v1_billing_pb.SetBilledSessionResponse>;
}

export interface IBillingServiceClient {
    updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    reconcileInvoices(request: usage_v1_billing_pb.ReconcileInvoicesRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.ReconcileInvoicesResponse) => void): grpc.ClientUnaryCall;
    reconcileInvoices(request: usage_v1_billing_pb.ReconcileInvoicesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.ReconcileInvoicesResponse) => void): grpc.ClientUnaryCall;
    reconcileInvoices(request: usage_v1_billing_pb.ReconcileInvoicesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.ReconcileInvoicesResponse) => void): grpc.ClientUnaryCall;
    getUpcomingInvoice(request: usage_v1_billing_pb.GetUpcomingInvoiceRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.GetUpcomingInvoiceResponse) => void): grpc.ClientUnaryCall;
    getUpcomingInvoice(request: usage_v1_billing_pb.GetUpcomingInvoiceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.GetUpcomingInvoiceResponse) => void): grpc.ClientUnaryCall;
    getUpcomingInvoice(request: usage_v1_billing_pb.GetUpcomingInvoiceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.GetUpcomingInvoiceResponse) => void): grpc.ClientUnaryCall;
    finalizeInvoice(request: usage_v1_billing_pb.FinalizeInvoiceRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.FinalizeInvoiceResponse) => void): grpc.ClientUnaryCall;
    finalizeInvoice(request: usage_v1_billing_pb.FinalizeInvoiceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.FinalizeInvoiceResponse) => void): grpc.ClientUnaryCall;
    finalizeInvoice(request: usage_v1_billing_pb.FinalizeInvoiceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.FinalizeInvoiceResponse) => void): grpc.ClientUnaryCall;
    setBilledSession(request: usage_v1_billing_pb.SetBilledSessionRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.SetBilledSessionResponse) => void): grpc.ClientUnaryCall;
    setBilledSession(request: usage_v1_billing_pb.SetBilledSessionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.SetBilledSessionResponse) => void): grpc.ClientUnaryCall;
    setBilledSession(request: usage_v1_billing_pb.SetBilledSessionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.SetBilledSessionResponse) => void): grpc.ClientUnaryCall;
}

export class BillingServiceClient extends grpc.Client implements IBillingServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    public updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    public updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    public reconcileInvoices(request: usage_v1_billing_pb.ReconcileInvoicesRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.ReconcileInvoicesResponse) => void): grpc.ClientUnaryCall;
    public reconcileInvoices(request: usage_v1_billing_pb.ReconcileInvoicesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.ReconcileInvoicesResponse) => void): grpc.ClientUnaryCall;
    public reconcileInvoices(request: usage_v1_billing_pb.ReconcileInvoicesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.ReconcileInvoicesResponse) => void): grpc.ClientUnaryCall;
    public getUpcomingInvoice(request: usage_v1_billing_pb.GetUpcomingInvoiceRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.GetUpcomingInvoiceResponse) => void): grpc.ClientUnaryCall;
    public getUpcomingInvoice(request: usage_v1_billing_pb.GetUpcomingInvoiceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.GetUpcomingInvoiceResponse) => void): grpc.ClientUnaryCall;
    public getUpcomingInvoice(request: usage_v1_billing_pb.GetUpcomingInvoiceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.GetUpcomingInvoiceResponse) => void): grpc.ClientUnaryCall;
    public finalizeInvoice(request: usage_v1_billing_pb.FinalizeInvoiceRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.FinalizeInvoiceResponse) => void): grpc.ClientUnaryCall;
    public finalizeInvoice(request: usage_v1_billing_pb.FinalizeInvoiceRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.FinalizeInvoiceResponse) => void): grpc.ClientUnaryCall;
    public finalizeInvoice(request: usage_v1_billing_pb.FinalizeInvoiceRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.FinalizeInvoiceResponse) => void): grpc.ClientUnaryCall;
    public setBilledSession(request: usage_v1_billing_pb.SetBilledSessionRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.SetBilledSessionResponse) => void): grpc.ClientUnaryCall;
    public setBilledSession(request: usage_v1_billing_pb.SetBilledSessionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.SetBilledSessionResponse) => void): grpc.ClientUnaryCall;
    public setBilledSession(request: usage_v1_billing_pb.SetBilledSessionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.SetBilledSessionResponse) => void): grpc.ClientUnaryCall;
}
