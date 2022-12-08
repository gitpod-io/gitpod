/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// package: wsman
// file: core.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as core_pb from "./core_pb";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";

interface IWorkspaceManagerService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    getWorkspaces: IWorkspaceManagerService_IGetWorkspaces;
    startWorkspace: IWorkspaceManagerService_IStartWorkspace;
    stopWorkspace: IWorkspaceManagerService_IStopWorkspace;
    describeWorkspace: IWorkspaceManagerService_IDescribeWorkspace;
    backupWorkspace: IWorkspaceManagerService_IBackupWorkspace;
    subscribe: IWorkspaceManagerService_ISubscribe;
    markActive: IWorkspaceManagerService_IMarkActive;
    setTimeout: IWorkspaceManagerService_ISetTimeout;
    controlPort: IWorkspaceManagerService_IControlPort;
    takeSnapshot: IWorkspaceManagerService_ITakeSnapshot;
    controlAdmission: IWorkspaceManagerService_IControlAdmission;
    deleteVolumeSnapshot: IWorkspaceManagerService_IDeleteVolumeSnapshot;
    updateSSHKey: IWorkspaceManagerService_IUpdateSSHKey;
    describeCluster: IWorkspaceManagerService_IDescribeCluster;
}

interface IWorkspaceManagerService_IGetWorkspaces
    extends grpc.MethodDefinition<core_pb.GetWorkspacesRequest, core_pb.GetWorkspacesResponse> {
    path: "/wsman.WorkspaceManager/GetWorkspaces";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.GetWorkspacesRequest>;
    requestDeserialize: grpc.deserialize<core_pb.GetWorkspacesRequest>;
    responseSerialize: grpc.serialize<core_pb.GetWorkspacesResponse>;
    responseDeserialize: grpc.deserialize<core_pb.GetWorkspacesResponse>;
}
interface IWorkspaceManagerService_IStartWorkspace
    extends grpc.MethodDefinition<core_pb.StartWorkspaceRequest, core_pb.StartWorkspaceResponse> {
    path: "/wsman.WorkspaceManager/StartWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.StartWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<core_pb.StartWorkspaceRequest>;
    responseSerialize: grpc.serialize<core_pb.StartWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<core_pb.StartWorkspaceResponse>;
}
interface IWorkspaceManagerService_IStopWorkspace
    extends grpc.MethodDefinition<core_pb.StopWorkspaceRequest, core_pb.StopWorkspaceResponse> {
    path: "/wsman.WorkspaceManager/StopWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.StopWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<core_pb.StopWorkspaceRequest>;
    responseSerialize: grpc.serialize<core_pb.StopWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<core_pb.StopWorkspaceResponse>;
}
interface IWorkspaceManagerService_IDescribeWorkspace
    extends grpc.MethodDefinition<core_pb.DescribeWorkspaceRequest, core_pb.DescribeWorkspaceResponse> {
    path: "/wsman.WorkspaceManager/DescribeWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.DescribeWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<core_pb.DescribeWorkspaceRequest>;
    responseSerialize: grpc.serialize<core_pb.DescribeWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<core_pb.DescribeWorkspaceResponse>;
}
interface IWorkspaceManagerService_IBackupWorkspace
    extends grpc.MethodDefinition<core_pb.BackupWorkspaceRequest, core_pb.BackupWorkspaceResponse> {
    path: "/wsman.WorkspaceManager/BackupWorkspace";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.BackupWorkspaceRequest>;
    requestDeserialize: grpc.deserialize<core_pb.BackupWorkspaceRequest>;
    responseSerialize: grpc.serialize<core_pb.BackupWorkspaceResponse>;
    responseDeserialize: grpc.deserialize<core_pb.BackupWorkspaceResponse>;
}
interface IWorkspaceManagerService_ISubscribe
    extends grpc.MethodDefinition<core_pb.SubscribeRequest, core_pb.SubscribeResponse> {
    path: "/wsman.WorkspaceManager/Subscribe";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<core_pb.SubscribeRequest>;
    requestDeserialize: grpc.deserialize<core_pb.SubscribeRequest>;
    responseSerialize: grpc.serialize<core_pb.SubscribeResponse>;
    responseDeserialize: grpc.deserialize<core_pb.SubscribeResponse>;
}
interface IWorkspaceManagerService_IMarkActive
    extends grpc.MethodDefinition<core_pb.MarkActiveRequest, core_pb.MarkActiveResponse> {
    path: "/wsman.WorkspaceManager/MarkActive";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.MarkActiveRequest>;
    requestDeserialize: grpc.deserialize<core_pb.MarkActiveRequest>;
    responseSerialize: grpc.serialize<core_pb.MarkActiveResponse>;
    responseDeserialize: grpc.deserialize<core_pb.MarkActiveResponse>;
}
interface IWorkspaceManagerService_ISetTimeout
    extends grpc.MethodDefinition<core_pb.SetTimeoutRequest, core_pb.SetTimeoutResponse> {
    path: "/wsman.WorkspaceManager/SetTimeout";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.SetTimeoutRequest>;
    requestDeserialize: grpc.deserialize<core_pb.SetTimeoutRequest>;
    responseSerialize: grpc.serialize<core_pb.SetTimeoutResponse>;
    responseDeserialize: grpc.deserialize<core_pb.SetTimeoutResponse>;
}
interface IWorkspaceManagerService_IControlPort
    extends grpc.MethodDefinition<core_pb.ControlPortRequest, core_pb.ControlPortResponse> {
    path: "/wsman.WorkspaceManager/ControlPort";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.ControlPortRequest>;
    requestDeserialize: grpc.deserialize<core_pb.ControlPortRequest>;
    responseSerialize: grpc.serialize<core_pb.ControlPortResponse>;
    responseDeserialize: grpc.deserialize<core_pb.ControlPortResponse>;
}
interface IWorkspaceManagerService_ITakeSnapshot
    extends grpc.MethodDefinition<core_pb.TakeSnapshotRequest, core_pb.TakeSnapshotResponse> {
    path: "/wsman.WorkspaceManager/TakeSnapshot";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.TakeSnapshotRequest>;
    requestDeserialize: grpc.deserialize<core_pb.TakeSnapshotRequest>;
    responseSerialize: grpc.serialize<core_pb.TakeSnapshotResponse>;
    responseDeserialize: grpc.deserialize<core_pb.TakeSnapshotResponse>;
}
interface IWorkspaceManagerService_IControlAdmission
    extends grpc.MethodDefinition<core_pb.ControlAdmissionRequest, core_pb.ControlAdmissionResponse> {
    path: "/wsman.WorkspaceManager/ControlAdmission";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.ControlAdmissionRequest>;
    requestDeserialize: grpc.deserialize<core_pb.ControlAdmissionRequest>;
    responseSerialize: grpc.serialize<core_pb.ControlAdmissionResponse>;
    responseDeserialize: grpc.deserialize<core_pb.ControlAdmissionResponse>;
}
interface IWorkspaceManagerService_IDeleteVolumeSnapshot
    extends grpc.MethodDefinition<core_pb.DeleteVolumeSnapshotRequest, core_pb.DeleteVolumeSnapshotResponse> {
    path: "/wsman.WorkspaceManager/DeleteVolumeSnapshot";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.DeleteVolumeSnapshotRequest>;
    requestDeserialize: grpc.deserialize<core_pb.DeleteVolumeSnapshotRequest>;
    responseSerialize: grpc.serialize<core_pb.DeleteVolumeSnapshotResponse>;
    responseDeserialize: grpc.deserialize<core_pb.DeleteVolumeSnapshotResponse>;
}
interface IWorkspaceManagerService_IUpdateSSHKey
    extends grpc.MethodDefinition<core_pb.UpdateSSHKeyRequest, core_pb.UpdateSSHKeyResponse> {
    path: "/wsman.WorkspaceManager/UpdateSSHKey";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.UpdateSSHKeyRequest>;
    requestDeserialize: grpc.deserialize<core_pb.UpdateSSHKeyRequest>;
    responseSerialize: grpc.serialize<core_pb.UpdateSSHKeyResponse>;
    responseDeserialize: grpc.deserialize<core_pb.UpdateSSHKeyResponse>;
}
interface IWorkspaceManagerService_IDescribeCluster
    extends grpc.MethodDefinition<core_pb.DescribeClusterRequest, core_pb.DescribeClusterResponse> {
    path: "/wsman.WorkspaceManager/DescribeCluster";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<core_pb.DescribeClusterRequest>;
    requestDeserialize: grpc.deserialize<core_pb.DescribeClusterRequest>;
    responseSerialize: grpc.serialize<core_pb.DescribeClusterResponse>;
    responseDeserialize: grpc.deserialize<core_pb.DescribeClusterResponse>;
}

export const WorkspaceManagerService: IWorkspaceManagerService;

export interface IWorkspaceManagerServer extends grpc.UntypedServiceImplementation {
    getWorkspaces: grpc.handleUnaryCall<core_pb.GetWorkspacesRequest, core_pb.GetWorkspacesResponse>;
    startWorkspace: grpc.handleUnaryCall<core_pb.StartWorkspaceRequest, core_pb.StartWorkspaceResponse>;
    stopWorkspace: grpc.handleUnaryCall<core_pb.StopWorkspaceRequest, core_pb.StopWorkspaceResponse>;
    describeWorkspace: grpc.handleUnaryCall<core_pb.DescribeWorkspaceRequest, core_pb.DescribeWorkspaceResponse>;
    backupWorkspace: grpc.handleUnaryCall<core_pb.BackupWorkspaceRequest, core_pb.BackupWorkspaceResponse>;
    subscribe: grpc.handleServerStreamingCall<core_pb.SubscribeRequest, core_pb.SubscribeResponse>;
    markActive: grpc.handleUnaryCall<core_pb.MarkActiveRequest, core_pb.MarkActiveResponse>;
    setTimeout: grpc.handleUnaryCall<core_pb.SetTimeoutRequest, core_pb.SetTimeoutResponse>;
    controlPort: grpc.handleUnaryCall<core_pb.ControlPortRequest, core_pb.ControlPortResponse>;
    takeSnapshot: grpc.handleUnaryCall<core_pb.TakeSnapshotRequest, core_pb.TakeSnapshotResponse>;
    controlAdmission: grpc.handleUnaryCall<core_pb.ControlAdmissionRequest, core_pb.ControlAdmissionResponse>;
    deleteVolumeSnapshot: grpc.handleUnaryCall<
        core_pb.DeleteVolumeSnapshotRequest,
        core_pb.DeleteVolumeSnapshotResponse
    >;
    updateSSHKey: grpc.handleUnaryCall<core_pb.UpdateSSHKeyRequest, core_pb.UpdateSSHKeyResponse>;
    describeCluster: grpc.handleUnaryCall<core_pb.DescribeClusterRequest, core_pb.DescribeClusterResponse>;
}

export interface IWorkspaceManagerClient {
    getWorkspaces(
        request: core_pb.GetWorkspacesRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.GetWorkspacesResponse) => void,
    ): grpc.ClientUnaryCall;
    getWorkspaces(
        request: core_pb.GetWorkspacesRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.GetWorkspacesResponse) => void,
    ): grpc.ClientUnaryCall;
    getWorkspaces(
        request: core_pb.GetWorkspacesRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.GetWorkspacesResponse) => void,
    ): grpc.ClientUnaryCall;
    startWorkspace(
        request: core_pb.StartWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.StartWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    startWorkspace(
        request: core_pb.StartWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.StartWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    startWorkspace(
        request: core_pb.StartWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.StartWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    stopWorkspace(
        request: core_pb.StopWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.StopWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    stopWorkspace(
        request: core_pb.StopWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.StopWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    stopWorkspace(
        request: core_pb.StopWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.StopWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    describeWorkspace(
        request: core_pb.DescribeWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    describeWorkspace(
        request: core_pb.DescribeWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    describeWorkspace(
        request: core_pb.DescribeWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    backupWorkspace(
        request: core_pb.BackupWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.BackupWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    backupWorkspace(
        request: core_pb.BackupWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.BackupWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    backupWorkspace(
        request: core_pb.BackupWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.BackupWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    subscribe(
        request: core_pb.SubscribeRequest,
        options?: Partial<grpc.CallOptions>,
    ): grpc.ClientReadableStream<core_pb.SubscribeResponse>;
    subscribe(
        request: core_pb.SubscribeRequest,
        metadata?: grpc.Metadata,
        options?: Partial<grpc.CallOptions>,
    ): grpc.ClientReadableStream<core_pb.SubscribeResponse>;
    markActive(
        request: core_pb.MarkActiveRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.MarkActiveResponse) => void,
    ): grpc.ClientUnaryCall;
    markActive(
        request: core_pb.MarkActiveRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.MarkActiveResponse) => void,
    ): grpc.ClientUnaryCall;
    markActive(
        request: core_pb.MarkActiveRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.MarkActiveResponse) => void,
    ): grpc.ClientUnaryCall;
    setTimeout(
        request: core_pb.SetTimeoutRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.SetTimeoutResponse) => void,
    ): grpc.ClientUnaryCall;
    setTimeout(
        request: core_pb.SetTimeoutRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.SetTimeoutResponse) => void,
    ): grpc.ClientUnaryCall;
    setTimeout(
        request: core_pb.SetTimeoutRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.SetTimeoutResponse) => void,
    ): grpc.ClientUnaryCall;
    controlPort(
        request: core_pb.ControlPortRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlPortResponse) => void,
    ): grpc.ClientUnaryCall;
    controlPort(
        request: core_pb.ControlPortRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlPortResponse) => void,
    ): grpc.ClientUnaryCall;
    controlPort(
        request: core_pb.ControlPortRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlPortResponse) => void,
    ): grpc.ClientUnaryCall;
    takeSnapshot(
        request: core_pb.TakeSnapshotRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.TakeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    takeSnapshot(
        request: core_pb.TakeSnapshotRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.TakeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    takeSnapshot(
        request: core_pb.TakeSnapshotRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.TakeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    controlAdmission(
        request: core_pb.ControlAdmissionRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlAdmissionResponse) => void,
    ): grpc.ClientUnaryCall;
    controlAdmission(
        request: core_pb.ControlAdmissionRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlAdmissionResponse) => void,
    ): grpc.ClientUnaryCall;
    controlAdmission(
        request: core_pb.ControlAdmissionRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlAdmissionResponse) => void,
    ): grpc.ClientUnaryCall;
    deleteVolumeSnapshot(
        request: core_pb.DeleteVolumeSnapshotRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.DeleteVolumeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    deleteVolumeSnapshot(
        request: core_pb.DeleteVolumeSnapshotRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.DeleteVolumeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    deleteVolumeSnapshot(
        request: core_pb.DeleteVolumeSnapshotRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.DeleteVolumeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    updateSSHKey(
        request: core_pb.UpdateSSHKeyRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.UpdateSSHKeyResponse) => void,
    ): grpc.ClientUnaryCall;
    updateSSHKey(
        request: core_pb.UpdateSSHKeyRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.UpdateSSHKeyResponse) => void,
    ): grpc.ClientUnaryCall;
    updateSSHKey(
        request: core_pb.UpdateSSHKeyRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.UpdateSSHKeyResponse) => void,
    ): grpc.ClientUnaryCall;
    describeCluster(
        request: core_pb.DescribeClusterRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeClusterResponse) => void,
    ): grpc.ClientUnaryCall;
    describeCluster(
        request: core_pb.DescribeClusterRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeClusterResponse) => void,
    ): grpc.ClientUnaryCall;
    describeCluster(
        request: core_pb.DescribeClusterRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeClusterResponse) => void,
    ): grpc.ClientUnaryCall;
}

export class WorkspaceManagerClient extends grpc.Client implements IWorkspaceManagerClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getWorkspaces(
        request: core_pb.GetWorkspacesRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.GetWorkspacesResponse) => void,
    ): grpc.ClientUnaryCall;
    public getWorkspaces(
        request: core_pb.GetWorkspacesRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.GetWorkspacesResponse) => void,
    ): grpc.ClientUnaryCall;
    public getWorkspaces(
        request: core_pb.GetWorkspacesRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.GetWorkspacesResponse) => void,
    ): grpc.ClientUnaryCall;
    public startWorkspace(
        request: core_pb.StartWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.StartWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public startWorkspace(
        request: core_pb.StartWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.StartWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public startWorkspace(
        request: core_pb.StartWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.StartWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public stopWorkspace(
        request: core_pb.StopWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.StopWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public stopWorkspace(
        request: core_pb.StopWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.StopWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public stopWorkspace(
        request: core_pb.StopWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.StopWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public describeWorkspace(
        request: core_pb.DescribeWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public describeWorkspace(
        request: core_pb.DescribeWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public describeWorkspace(
        request: core_pb.DescribeWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public backupWorkspace(
        request: core_pb.BackupWorkspaceRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.BackupWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public backupWorkspace(
        request: core_pb.BackupWorkspaceRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.BackupWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public backupWorkspace(
        request: core_pb.BackupWorkspaceRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.BackupWorkspaceResponse) => void,
    ): grpc.ClientUnaryCall;
    public subscribe(
        request: core_pb.SubscribeRequest,
        options?: Partial<grpc.CallOptions>,
    ): grpc.ClientReadableStream<core_pb.SubscribeResponse>;
    public subscribe(
        request: core_pb.SubscribeRequest,
        metadata?: grpc.Metadata,
        options?: Partial<grpc.CallOptions>,
    ): grpc.ClientReadableStream<core_pb.SubscribeResponse>;
    public markActive(
        request: core_pb.MarkActiveRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.MarkActiveResponse) => void,
    ): grpc.ClientUnaryCall;
    public markActive(
        request: core_pb.MarkActiveRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.MarkActiveResponse) => void,
    ): grpc.ClientUnaryCall;
    public markActive(
        request: core_pb.MarkActiveRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.MarkActiveResponse) => void,
    ): grpc.ClientUnaryCall;
    public setTimeout(
        request: core_pb.SetTimeoutRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.SetTimeoutResponse) => void,
    ): grpc.ClientUnaryCall;
    public setTimeout(
        request: core_pb.SetTimeoutRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.SetTimeoutResponse) => void,
    ): grpc.ClientUnaryCall;
    public setTimeout(
        request: core_pb.SetTimeoutRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.SetTimeoutResponse) => void,
    ): grpc.ClientUnaryCall;
    public controlPort(
        request: core_pb.ControlPortRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlPortResponse) => void,
    ): grpc.ClientUnaryCall;
    public controlPort(
        request: core_pb.ControlPortRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlPortResponse) => void,
    ): grpc.ClientUnaryCall;
    public controlPort(
        request: core_pb.ControlPortRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlPortResponse) => void,
    ): grpc.ClientUnaryCall;
    public takeSnapshot(
        request: core_pb.TakeSnapshotRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.TakeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    public takeSnapshot(
        request: core_pb.TakeSnapshotRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.TakeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    public takeSnapshot(
        request: core_pb.TakeSnapshotRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.TakeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    public controlAdmission(
        request: core_pb.ControlAdmissionRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlAdmissionResponse) => void,
    ): grpc.ClientUnaryCall;
    public controlAdmission(
        request: core_pb.ControlAdmissionRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlAdmissionResponse) => void,
    ): grpc.ClientUnaryCall;
    public controlAdmission(
        request: core_pb.ControlAdmissionRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.ControlAdmissionResponse) => void,
    ): grpc.ClientUnaryCall;
    public deleteVolumeSnapshot(
        request: core_pb.DeleteVolumeSnapshotRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.DeleteVolumeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    public deleteVolumeSnapshot(
        request: core_pb.DeleteVolumeSnapshotRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.DeleteVolumeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    public deleteVolumeSnapshot(
        request: core_pb.DeleteVolumeSnapshotRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.DeleteVolumeSnapshotResponse) => void,
    ): grpc.ClientUnaryCall;
    public updateSSHKey(
        request: core_pb.UpdateSSHKeyRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.UpdateSSHKeyResponse) => void,
    ): grpc.ClientUnaryCall;
    public updateSSHKey(
        request: core_pb.UpdateSSHKeyRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.UpdateSSHKeyResponse) => void,
    ): grpc.ClientUnaryCall;
    public updateSSHKey(
        request: core_pb.UpdateSSHKeyRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.UpdateSSHKeyResponse) => void,
    ): grpc.ClientUnaryCall;
    public describeCluster(
        request: core_pb.DescribeClusterRequest,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeClusterResponse) => void,
    ): grpc.ClientUnaryCall;
    public describeCluster(
        request: core_pb.DescribeClusterRequest,
        metadata: grpc.Metadata,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeClusterResponse) => void,
    ): grpc.ClientUnaryCall;
    public describeCluster(
        request: core_pb.DescribeClusterRequest,
        metadata: grpc.Metadata,
        options: Partial<grpc.CallOptions>,
        callback: (error: grpc.ServiceError | null, response: core_pb.DescribeClusterResponse) => void,
    ): grpc.ClientUnaryCall;
}
