/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// package: builder
// file: subassembly.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as subassembly_pb from "./subassembly_pb";

interface ISubassemblyServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    createSubassembly: ISubassemblyServiceService_ICreateSubassembly;
    getSubassembly: ISubassemblyServiceService_IGetSubassembly;
}

interface ISubassemblyServiceService_ICreateSubassembly extends grpc.MethodDefinition<subassembly_pb.CreateSubassemblyRequest, subassembly_pb.CreateSubassemblyResponse> {
    path: "/builder.SubassemblyService/CreateSubassembly";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<subassembly_pb.CreateSubassemblyRequest>;
    requestDeserialize: grpc.deserialize<subassembly_pb.CreateSubassemblyRequest>;
    responseSerialize: grpc.serialize<subassembly_pb.CreateSubassemblyResponse>;
    responseDeserialize: grpc.deserialize<subassembly_pb.CreateSubassemblyResponse>;
}
interface ISubassemblyServiceService_IGetSubassembly extends grpc.MethodDefinition<subassembly_pb.GetSubassemblyRequest, subassembly_pb.GetSubassemblyResponse> {
    path: "/builder.SubassemblyService/GetSubassembly";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<subassembly_pb.GetSubassemblyRequest>;
    requestDeserialize: grpc.deserialize<subassembly_pb.GetSubassemblyRequest>;
    responseSerialize: grpc.serialize<subassembly_pb.GetSubassemblyResponse>;
    responseDeserialize: grpc.deserialize<subassembly_pb.GetSubassemblyResponse>;
}

export const SubassemblyServiceService: ISubassemblyServiceService;

export interface ISubassemblyServiceServer extends grpc.UntypedServiceImplementation {
    createSubassembly: grpc.handleUnaryCall<subassembly_pb.CreateSubassemblyRequest, subassembly_pb.CreateSubassemblyResponse>;
    getSubassembly: grpc.handleUnaryCall<subassembly_pb.GetSubassemblyRequest, subassembly_pb.GetSubassemblyResponse>;
}

export interface ISubassemblyServiceClient {
    createSubassembly(request: subassembly_pb.CreateSubassemblyRequest, callback: (error: grpc.ServiceError | null, response: subassembly_pb.CreateSubassemblyResponse) => void): grpc.ClientUnaryCall;
    createSubassembly(request: subassembly_pb.CreateSubassemblyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: subassembly_pb.CreateSubassemblyResponse) => void): grpc.ClientUnaryCall;
    createSubassembly(request: subassembly_pb.CreateSubassemblyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: subassembly_pb.CreateSubassemblyResponse) => void): grpc.ClientUnaryCall;
    getSubassembly(request: subassembly_pb.GetSubassemblyRequest, callback: (error: grpc.ServiceError | null, response: subassembly_pb.GetSubassemblyResponse) => void): grpc.ClientUnaryCall;
    getSubassembly(request: subassembly_pb.GetSubassemblyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: subassembly_pb.GetSubassemblyResponse) => void): grpc.ClientUnaryCall;
    getSubassembly(request: subassembly_pb.GetSubassemblyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: subassembly_pb.GetSubassemblyResponse) => void): grpc.ClientUnaryCall;
}

export class SubassemblyServiceClient extends grpc.Client implements ISubassemblyServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public createSubassembly(request: subassembly_pb.CreateSubassemblyRequest, callback: (error: grpc.ServiceError | null, response: subassembly_pb.CreateSubassemblyResponse) => void): grpc.ClientUnaryCall;
    public createSubassembly(request: subassembly_pb.CreateSubassemblyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: subassembly_pb.CreateSubassemblyResponse) => void): grpc.ClientUnaryCall;
    public createSubassembly(request: subassembly_pb.CreateSubassemblyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: subassembly_pb.CreateSubassemblyResponse) => void): grpc.ClientUnaryCall;
    public getSubassembly(request: subassembly_pb.GetSubassemblyRequest, callback: (error: grpc.ServiceError | null, response: subassembly_pb.GetSubassemblyResponse) => void): grpc.ClientUnaryCall;
    public getSubassembly(request: subassembly_pb.GetSubassemblyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: subassembly_pb.GetSubassemblyResponse) => void): grpc.ClientUnaryCall;
    public getSubassembly(request: subassembly_pb.GetSubassemblyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: subassembly_pb.GetSubassemblyResponse) => void): grpc.ClientUnaryCall;
}
