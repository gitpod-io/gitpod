/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: supervisor
// file: info.proto

/* tslint:disable */

import * as grpc from '@grpc/grpc-js';
import * as info_pb from './info_pb';

interface IInfoServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    workspaceInfo: IInfoServiceService_IWorkspaceInfo;
}

interface IInfoServiceService_IWorkspaceInfo
    extends grpc.MethodDefinition<info_pb.WorkspaceInfoRequest, info_pb.WorkspaceInfoResponse> {
    path: string; // "/supervisor.InfoService/WorkspaceInfo"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<info_pb.WorkspaceInfoRequest>;
    requestDeserialize: grpc.deserialize<info_pb.WorkspaceInfoRequest>;
    responseSerialize: grpc.serialize<info_pb.WorkspaceInfoResponse>;
    responseDeserialize: grpc.deserialize<info_pb.WorkspaceInfoResponse>;
}

export const InfoServiceService: IInfoServiceService;

export interface IInfoServiceServer {
    workspaceInfo: grpc.handleUnaryCall<info_pb.WorkspaceInfoRequest, info_pb.WorkspaceInfoResponse>;
}

export interface IInfoServiceClient {
    workspaceInfo(
        request: info_pb.WorkspaceInfoRequest,
        callback: (error: grpc.ServiceError | null, response: info_pb.WorkspaceInfoResponse) => void,
    ): grpc.ClientUnaryCall;
    workspaceInfo(
        request: info_pb.WorkspaceInfoRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: info_pb.WorkspaceInfoResponse) => void,
    ): grpc.ClientUnaryCall;
    workspaceInfo(
        request: info_pb.WorkspaceInfoRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: info_pb.WorkspaceInfoResponse) => void,
    ): grpc.ClientUnaryCall;
}

export class InfoServiceClient extends grpc.Client implements IInfoServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public workspaceInfo(
        request: info_pb.WorkspaceInfoRequest,
        callback: (error: grpc.ServiceError | null, response: info_pb.WorkspaceInfoResponse) => void,
    ): grpc.ClientUnaryCall;
    public workspaceInfo(
        request: info_pb.WorkspaceInfoRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: info_pb.WorkspaceInfoResponse) => void,
    ): grpc.ClientUnaryCall;
    public workspaceInfo(
        request: info_pb.WorkspaceInfoRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: info_pb.WorkspaceInfoResponse) => void,
    ): grpc.ClientUnaryCall;
}
