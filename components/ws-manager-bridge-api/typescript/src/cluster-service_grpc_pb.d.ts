/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: workspacemanagerbridge
// file: cluster-service.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from '@grpc/grpc-js';
import * as cluster_service_pb from './cluster-service_pb';

interface IClusterServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    register: IClusterServiceService_IRegister;
    update: IClusterServiceService_IUpdate;
    deregister: IClusterServiceService_IDeregister;
    list: IClusterServiceService_IList;
}

interface IClusterServiceService_IRegister
    extends grpc.MethodDefinition<cluster_service_pb.RegisterRequest, cluster_service_pb.RegisterResponse> {
    path: '/workspacemanagerbridge.ClusterService/Register';
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<cluster_service_pb.RegisterRequest>;
    requestDeserialize: grpc.deserialize<cluster_service_pb.RegisterRequest>;
    responseSerialize: grpc.serialize<cluster_service_pb.RegisterResponse>;
    responseDeserialize: grpc.deserialize<cluster_service_pb.RegisterResponse>;
}
interface IClusterServiceService_IUpdate
    extends grpc.MethodDefinition<cluster_service_pb.UpdateRequest, cluster_service_pb.UpdateResponse> {
    path: '/workspacemanagerbridge.ClusterService/Update';
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<cluster_service_pb.UpdateRequest>;
    requestDeserialize: grpc.deserialize<cluster_service_pb.UpdateRequest>;
    responseSerialize: grpc.serialize<cluster_service_pb.UpdateResponse>;
    responseDeserialize: grpc.deserialize<cluster_service_pb.UpdateResponse>;
}
interface IClusterServiceService_IDeregister
    extends grpc.MethodDefinition<cluster_service_pb.DeregisterRequest, cluster_service_pb.DeregisterResponse> {
    path: '/workspacemanagerbridge.ClusterService/Deregister';
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<cluster_service_pb.DeregisterRequest>;
    requestDeserialize: grpc.deserialize<cluster_service_pb.DeregisterRequest>;
    responseSerialize: grpc.serialize<cluster_service_pb.DeregisterResponse>;
    responseDeserialize: grpc.deserialize<cluster_service_pb.DeregisterResponse>;
}
interface IClusterServiceService_IList
    extends grpc.MethodDefinition<cluster_service_pb.ListRequest, cluster_service_pb.ListResponse> {
    path: '/workspacemanagerbridge.ClusterService/List';
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<cluster_service_pb.ListRequest>;
    requestDeserialize: grpc.deserialize<cluster_service_pb.ListRequest>;
    responseSerialize: grpc.serialize<cluster_service_pb.ListResponse>;
    responseDeserialize: grpc.deserialize<cluster_service_pb.ListResponse>;
}

export const ClusterServiceService: IClusterServiceService;

export interface IClusterServiceServer extends grpc.UntypedServiceImplementation {
    register: grpc.handleUnaryCall<cluster_service_pb.RegisterRequest, cluster_service_pb.RegisterResponse>;
    update: grpc.handleUnaryCall<cluster_service_pb.UpdateRequest, cluster_service_pb.UpdateResponse>;
    deregister: grpc.handleUnaryCall<cluster_service_pb.DeregisterRequest, cluster_service_pb.DeregisterResponse>;
    list: grpc.handleUnaryCall<cluster_service_pb.ListRequest, cluster_service_pb.ListResponse>;
}

export interface IClusterServiceClient {
    register(
        request: cluster_service_pb.RegisterRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.RegisterResponse) => void,
    ): grpc.ClientUnaryCall;
    register(
        request: cluster_service_pb.RegisterRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.RegisterResponse) => void,
    ): grpc.ClientUnaryCall;
    register(
        request: cluster_service_pb.RegisterRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.RegisterResponse) => void,
    ): grpc.ClientUnaryCall;
    update(
        request: cluster_service_pb.UpdateRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.UpdateResponse) => void,
    ): grpc.ClientUnaryCall;
    update(
        request: cluster_service_pb.UpdateRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.UpdateResponse) => void,
    ): grpc.ClientUnaryCall;
    update(
        request: cluster_service_pb.UpdateRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.UpdateResponse) => void,
    ): grpc.ClientUnaryCall;
    deregister(
        request: cluster_service_pb.DeregisterRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.DeregisterResponse) => void,
    ): grpc.ClientUnaryCall;
    deregister(
        request: cluster_service_pb.DeregisterRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.DeregisterResponse) => void,
    ): grpc.ClientUnaryCall;
    deregister(
        request: cluster_service_pb.DeregisterRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.DeregisterResponse) => void,
    ): grpc.ClientUnaryCall;
    list(
        request: cluster_service_pb.ListRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.ListResponse) => void,
    ): grpc.ClientUnaryCall;
    list(
        request: cluster_service_pb.ListRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.ListResponse) => void,
    ): grpc.ClientUnaryCall;
    list(
        request: cluster_service_pb.ListRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.ListResponse) => void,
    ): grpc.ClientUnaryCall;
}

export class ClusterServiceClient extends grpc.Client implements IClusterServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public register(
        request: cluster_service_pb.RegisterRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.RegisterResponse) => void,
    ): grpc.ClientUnaryCall;
    public register(
        request: cluster_service_pb.RegisterRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.RegisterResponse) => void,
    ): grpc.ClientUnaryCall;
    public register(
        request: cluster_service_pb.RegisterRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.RegisterResponse) => void,
    ): grpc.ClientUnaryCall;
    public update(
        request: cluster_service_pb.UpdateRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.UpdateResponse) => void,
    ): grpc.ClientUnaryCall;
    public update(
        request: cluster_service_pb.UpdateRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.UpdateResponse) => void,
    ): grpc.ClientUnaryCall;
    public update(
        request: cluster_service_pb.UpdateRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.UpdateResponse) => void,
    ): grpc.ClientUnaryCall;
    public deregister(
        request: cluster_service_pb.DeregisterRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.DeregisterResponse) => void,
    ): grpc.ClientUnaryCall;
    public deregister(
        request: cluster_service_pb.DeregisterRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.DeregisterResponse) => void,
    ): grpc.ClientUnaryCall;
    public deregister(
        request: cluster_service_pb.DeregisterRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.DeregisterResponse) => void,
    ): grpc.ClientUnaryCall;
    public list(
        request: cluster_service_pb.ListRequest,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.ListResponse) => void,
    ): grpc.ClientUnaryCall;
    public list(
        request: cluster_service_pb.ListRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.ListResponse) => void,
    ): grpc.ClientUnaryCall;
    public list(
        request: cluster_service_pb.ListRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: cluster_service_pb.ListResponse) => void,
    ): grpc.ClientUnaryCall;
}
