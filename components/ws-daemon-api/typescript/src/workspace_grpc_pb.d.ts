/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: iws
// file: workspace.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "grpc";
import * as workspace_pb from "./workspace_pb";

interface IInWorkspaceServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    prepareForUserNS: IInWorkspaceServiceService_IPrepareForUserNS;
    writeIDMapping: IInWorkspaceServiceService_IWriteIDMapping;
    mountProc: IInWorkspaceServiceService_IMountProc;
    umountProc: IInWorkspaceServiceService_IUmountProc;
    teardown: IInWorkspaceServiceService_ITeardown;
}

interface IInWorkspaceServiceService_IPrepareForUserNS extends grpc.MethodDefinition<workspace_pb.PrepareForUserNSRequest, workspace_pb.PrepareForUserNSResponse> {
    path: "/iws.InWorkspaceService/PrepareForUserNS";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.PrepareForUserNSRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.PrepareForUserNSRequest>;
    responseSerialize: grpc.serialize<workspace_pb.PrepareForUserNSResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.PrepareForUserNSResponse>;
}
interface IInWorkspaceServiceService_IWriteIDMapping extends grpc.MethodDefinition<workspace_pb.WriteIDMappingRequest, workspace_pb.WriteIDMappingResponse> {
    path: "/iws.InWorkspaceService/WriteIDMapping";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.WriteIDMappingRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.WriteIDMappingRequest>;
    responseSerialize: grpc.serialize<workspace_pb.WriteIDMappingResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.WriteIDMappingResponse>;
}
interface IInWorkspaceServiceService_IMountProc extends grpc.MethodDefinition<workspace_pb.MountProcRequest, workspace_pb.MountProcResponse> {
    path: "/iws.InWorkspaceService/MountProc";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.MountProcRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.MountProcRequest>;
    responseSerialize: grpc.serialize<workspace_pb.MountProcResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.MountProcResponse>;
}
interface IInWorkspaceServiceService_IUmountProc extends grpc.MethodDefinition<workspace_pb.UmountProcRequest, workspace_pb.UmountProcResponse> {
    path: "/iws.InWorkspaceService/UmountProc";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.UmountProcRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.UmountProcRequest>;
    responseSerialize: grpc.serialize<workspace_pb.UmountProcResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.UmountProcResponse>;
}
interface IInWorkspaceServiceService_ITeardown extends grpc.MethodDefinition<workspace_pb.TeardownRequest, workspace_pb.TeardownResponse> {
    path: "/iws.InWorkspaceService/Teardown";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_pb.TeardownRequest>;
    requestDeserialize: grpc.deserialize<workspace_pb.TeardownRequest>;
    responseSerialize: grpc.serialize<workspace_pb.TeardownResponse>;
    responseDeserialize: grpc.deserialize<workspace_pb.TeardownResponse>;
}

export const InWorkspaceServiceService: IInWorkspaceServiceService;

export interface IInWorkspaceServiceServer {
    prepareForUserNS: grpc.handleUnaryCall<workspace_pb.PrepareForUserNSRequest, workspace_pb.PrepareForUserNSResponse>;
    writeIDMapping: grpc.handleUnaryCall<workspace_pb.WriteIDMappingRequest, workspace_pb.WriteIDMappingResponse>;
    mountProc: grpc.handleUnaryCall<workspace_pb.MountProcRequest, workspace_pb.MountProcResponse>;
    umountProc: grpc.handleUnaryCall<workspace_pb.UmountProcRequest, workspace_pb.UmountProcResponse>;
    teardown: grpc.handleUnaryCall<workspace_pb.TeardownRequest, workspace_pb.TeardownResponse>;
}

export interface IInWorkspaceServiceClient {
    prepareForUserNS(request: workspace_pb.PrepareForUserNSRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    prepareForUserNS(request: workspace_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    prepareForUserNS(request: workspace_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    writeIDMapping(request: workspace_pb.WriteIDMappingRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    writeIDMapping(request: workspace_pb.WriteIDMappingRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    writeIDMapping(request: workspace_pb.WriteIDMappingRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    mountProc(request: workspace_pb.MountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    mountProc(request: workspace_pb.MountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    mountProc(request: workspace_pb.MountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    umountProc(request: workspace_pb.UmountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    umountProc(request: workspace_pb.UmountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    umountProc(request: workspace_pb.UmountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    teardown(request: workspace_pb.TeardownRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    teardown(request: workspace_pb.TeardownRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    teardown(request: workspace_pb.TeardownRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
}

export class InWorkspaceServiceClient extends grpc.Client implements IInWorkspaceServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public prepareForUserNS(request: workspace_pb.PrepareForUserNSRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    public prepareForUserNS(request: workspace_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    public prepareForUserNS(request: workspace_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    public writeIDMapping(request: workspace_pb.WriteIDMappingRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    public writeIDMapping(request: workspace_pb.WriteIDMappingRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    public writeIDMapping(request: workspace_pb.WriteIDMappingRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    public mountProc(request: workspace_pb.MountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public mountProc(request: workspace_pb.MountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public mountProc(request: workspace_pb.MountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public umountProc(request: workspace_pb.UmountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public umountProc(request: workspace_pb.UmountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public umountProc(request: workspace_pb.UmountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public teardown(request: workspace_pb.TeardownRequest, callback: (error: grpc.ServiceError | null, response: workspace_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    public teardown(request: workspace_pb.TeardownRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    public teardown(request: workspace_pb.TeardownRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
}
