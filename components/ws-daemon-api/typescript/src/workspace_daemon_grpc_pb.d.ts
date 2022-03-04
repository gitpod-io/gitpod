/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: iws
// file: workspace_daemon.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as workspace_daemon_pb from "./workspace_daemon_pb";

interface IInWorkspaceServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    prepareForUserNS: IInWorkspaceServiceService_IPrepareForUserNS;
    writeIDMapping: IInWorkspaceServiceService_IWriteIDMapping;
    evacuateCGroup: IInWorkspaceServiceService_IEvacuateCGroup;
    mountProc: IInWorkspaceServiceService_IMountProc;
    umountProc: IInWorkspaceServiceService_IUmountProc;
    mountSysfs: IInWorkspaceServiceService_IMountSysfs;
    umountSysfs: IInWorkspaceServiceService_IUmountSysfs;
    teardown: IInWorkspaceServiceService_ITeardown;
}

interface IInWorkspaceServiceService_IPrepareForUserNS extends grpc.MethodDefinition<workspace_daemon_pb.PrepareForUserNSRequest, workspace_daemon_pb.PrepareForUserNSResponse> {
    path: "/iws.InWorkspaceService/PrepareForUserNS";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.PrepareForUserNSRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.PrepareForUserNSRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.PrepareForUserNSResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.PrepareForUserNSResponse>;
}
interface IInWorkspaceServiceService_IWriteIDMapping extends grpc.MethodDefinition<workspace_daemon_pb.WriteIDMappingRequest, workspace_daemon_pb.WriteIDMappingResponse> {
    path: "/iws.InWorkspaceService/WriteIDMapping";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.WriteIDMappingRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.WriteIDMappingRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.WriteIDMappingResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.WriteIDMappingResponse>;
}
interface IInWorkspaceServiceService_IEvacuateCGroup extends grpc.MethodDefinition<workspace_daemon_pb.EvacuateCGroupRequest, workspace_daemon_pb.EvacuateCGroupResponse> {
    path: "/iws.InWorkspaceService/EvacuateCGroup";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.EvacuateCGroupRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.EvacuateCGroupRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.EvacuateCGroupResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.EvacuateCGroupResponse>;
}
interface IInWorkspaceServiceService_IMountProc extends grpc.MethodDefinition<workspace_daemon_pb.MountProcRequest, workspace_daemon_pb.MountProcResponse> {
    path: "/iws.InWorkspaceService/MountProc";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.MountProcRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.MountProcRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.MountProcResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.MountProcResponse>;
}
interface IInWorkspaceServiceService_IUmountProc extends grpc.MethodDefinition<workspace_daemon_pb.UmountProcRequest, workspace_daemon_pb.UmountProcResponse> {
    path: "/iws.InWorkspaceService/UmountProc";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.UmountProcRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.UmountProcRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.UmountProcResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.UmountProcResponse>;
}
interface IInWorkspaceServiceService_IMountSysfs extends grpc.MethodDefinition<workspace_daemon_pb.MountProcRequest, workspace_daemon_pb.MountProcResponse> {
    path: "/iws.InWorkspaceService/MountSysfs";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.MountProcRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.MountProcRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.MountProcResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.MountProcResponse>;
}
interface IInWorkspaceServiceService_IUmountSysfs extends grpc.MethodDefinition<workspace_daemon_pb.UmountProcRequest, workspace_daemon_pb.UmountProcResponse> {
    path: "/iws.InWorkspaceService/UmountSysfs";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.UmountProcRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.UmountProcRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.UmountProcResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.UmountProcResponse>;
}
interface IInWorkspaceServiceService_ITeardown extends grpc.MethodDefinition<workspace_daemon_pb.TeardownRequest, workspace_daemon_pb.TeardownResponse> {
    path: "/iws.InWorkspaceService/Teardown";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<workspace_daemon_pb.TeardownRequest>;
    requestDeserialize: grpc.deserialize<workspace_daemon_pb.TeardownRequest>;
    responseSerialize: grpc.serialize<workspace_daemon_pb.TeardownResponse>;
    responseDeserialize: grpc.deserialize<workspace_daemon_pb.TeardownResponse>;
}

export const InWorkspaceServiceService: IInWorkspaceServiceService;

export interface IInWorkspaceServiceServer extends grpc.UntypedServiceImplementation {
    prepareForUserNS: grpc.handleUnaryCall<workspace_daemon_pb.PrepareForUserNSRequest, workspace_daemon_pb.PrepareForUserNSResponse>;
    writeIDMapping: grpc.handleUnaryCall<workspace_daemon_pb.WriteIDMappingRequest, workspace_daemon_pb.WriteIDMappingResponse>;
    evacuateCGroup: grpc.handleUnaryCall<workspace_daemon_pb.EvacuateCGroupRequest, workspace_daemon_pb.EvacuateCGroupResponse>;
    mountProc: grpc.handleUnaryCall<workspace_daemon_pb.MountProcRequest, workspace_daemon_pb.MountProcResponse>;
    umountProc: grpc.handleUnaryCall<workspace_daemon_pb.UmountProcRequest, workspace_daemon_pb.UmountProcResponse>;
    mountSysfs: grpc.handleUnaryCall<workspace_daemon_pb.MountProcRequest, workspace_daemon_pb.MountProcResponse>;
    umountSysfs: grpc.handleUnaryCall<workspace_daemon_pb.UmountProcRequest, workspace_daemon_pb.UmountProcResponse>;
    teardown: grpc.handleUnaryCall<workspace_daemon_pb.TeardownRequest, workspace_daemon_pb.TeardownResponse>;
}

export interface IInWorkspaceServiceClient {
    prepareForUserNS(request: workspace_daemon_pb.PrepareForUserNSRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    prepareForUserNS(request: workspace_daemon_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    prepareForUserNS(request: workspace_daemon_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    writeIDMapping(request: workspace_daemon_pb.WriteIDMappingRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    writeIDMapping(request: workspace_daemon_pb.WriteIDMappingRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    writeIDMapping(request: workspace_daemon_pb.WriteIDMappingRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    evacuateCGroup(request: workspace_daemon_pb.EvacuateCGroupRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.EvacuateCGroupResponse) => void): grpc.ClientUnaryCall;
    evacuateCGroup(request: workspace_daemon_pb.EvacuateCGroupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.EvacuateCGroupResponse) => void): grpc.ClientUnaryCall;
    evacuateCGroup(request: workspace_daemon_pb.EvacuateCGroupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.EvacuateCGroupResponse) => void): grpc.ClientUnaryCall;
    mountProc(request: workspace_daemon_pb.MountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    mountProc(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    mountProc(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    umountProc(request: workspace_daemon_pb.UmountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    umountProc(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    umountProc(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    mountSysfs(request: workspace_daemon_pb.MountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    mountSysfs(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    mountSysfs(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    umountSysfs(request: workspace_daemon_pb.UmountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    umountSysfs(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    umountSysfs(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    teardown(request: workspace_daemon_pb.TeardownRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    teardown(request: workspace_daemon_pb.TeardownRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    teardown(request: workspace_daemon_pb.TeardownRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
}

export class InWorkspaceServiceClient extends grpc.Client implements IInWorkspaceServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public prepareForUserNS(request: workspace_daemon_pb.PrepareForUserNSRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    public prepareForUserNS(request: workspace_daemon_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    public prepareForUserNS(request: workspace_daemon_pb.PrepareForUserNSRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.PrepareForUserNSResponse) => void): grpc.ClientUnaryCall;
    public writeIDMapping(request: workspace_daemon_pb.WriteIDMappingRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    public writeIDMapping(request: workspace_daemon_pb.WriteIDMappingRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    public writeIDMapping(request: workspace_daemon_pb.WriteIDMappingRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.WriteIDMappingResponse) => void): grpc.ClientUnaryCall;
    public evacuateCGroup(request: workspace_daemon_pb.EvacuateCGroupRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.EvacuateCGroupResponse) => void): grpc.ClientUnaryCall;
    public evacuateCGroup(request: workspace_daemon_pb.EvacuateCGroupRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.EvacuateCGroupResponse) => void): grpc.ClientUnaryCall;
    public evacuateCGroup(request: workspace_daemon_pb.EvacuateCGroupRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.EvacuateCGroupResponse) => void): grpc.ClientUnaryCall;
    public mountProc(request: workspace_daemon_pb.MountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public mountProc(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public mountProc(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public umountProc(request: workspace_daemon_pb.UmountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public umountProc(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public umountProc(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public mountSysfs(request: workspace_daemon_pb.MountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public mountSysfs(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public mountSysfs(request: workspace_daemon_pb.MountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.MountProcResponse) => void): grpc.ClientUnaryCall;
    public umountSysfs(request: workspace_daemon_pb.UmountProcRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public umountSysfs(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public umountSysfs(request: workspace_daemon_pb.UmountProcRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.UmountProcResponse) => void): grpc.ClientUnaryCall;
    public teardown(request: workspace_daemon_pb.TeardownRequest, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    public teardown(request: workspace_daemon_pb.TeardownRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
    public teardown(request: workspace_daemon_pb.TeardownRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: workspace_daemon_pb.TeardownResponse) => void): grpc.ClientUnaryCall;
}
