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

export const BillingServiceService: IBillingServiceService;

export interface IBillingServiceServer extends grpc.UntypedServiceImplementation {
    updateInvoices: grpc.handleUnaryCall<usage_v1_billing_pb.UpdateInvoicesRequest, usage_v1_billing_pb.UpdateInvoicesResponse>;
}

export interface IBillingServiceClient {
    updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
}

export class BillingServiceClient extends grpc.Client implements IBillingServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    public updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
    public updateInvoices(request: usage_v1_billing_pb.UpdateInvoicesRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: usage_v1_billing_pb.UpdateInvoicesResponse) => void): grpc.ClientUnaryCall;
}
