/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: wsman
// file: core.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";

export class MetadataFilter extends jspb.Message {
    getOwner(): string;
    setOwner(value: string): MetadataFilter;
    getMetaId(): string;
    setMetaId(value: string): MetadataFilter;

    getAnnotationsMap(): jspb.Map<string, string>;
    clearAnnotationsMap(): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MetadataFilter.AsObject;
    static toObject(includeInstance: boolean, msg: MetadataFilter): MetadataFilter.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MetadataFilter, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MetadataFilter;
    static deserializeBinaryFromReader(message: MetadataFilter, reader: jspb.BinaryReader): MetadataFilter;
}

export namespace MetadataFilter {
    export type AsObject = {
        owner: string,
        metaId: string,

        annotationsMap: Array<[string, string]>,
    }
}

export class GetWorkspacesRequest extends jspb.Message {

    hasMustMatch(): boolean;
    clearMustMatch(): void;
    getMustMatch(): MetadataFilter | undefined;
    setMustMatch(value?: MetadataFilter): GetWorkspacesRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetWorkspacesRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetWorkspacesRequest): GetWorkspacesRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetWorkspacesRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetWorkspacesRequest;
    static deserializeBinaryFromReader(message: GetWorkspacesRequest, reader: jspb.BinaryReader): GetWorkspacesRequest;
}

export namespace GetWorkspacesRequest {
    export type AsObject = {
        mustMatch?: MetadataFilter.AsObject,
    }
}

export class GetWorkspacesResponse extends jspb.Message {
    clearStatusList(): void;
    getStatusList(): Array<WorkspaceStatus>;
    setStatusList(value: Array<WorkspaceStatus>): GetWorkspacesResponse;
    addStatus(value?: WorkspaceStatus, index?: number): WorkspaceStatus;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetWorkspacesResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetWorkspacesResponse): GetWorkspacesResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetWorkspacesResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetWorkspacesResponse;
    static deserializeBinaryFromReader(message: GetWorkspacesResponse, reader: jspb.BinaryReader): GetWorkspacesResponse;
}

export namespace GetWorkspacesResponse {
    export type AsObject = {
        statusList: Array<WorkspaceStatus.AsObject>,
    }
}

export class StartWorkspaceRequest extends jspb.Message {
    getId(): string;
    setId(value: string): StartWorkspaceRequest;
    getServicePrefix(): string;
    setServicePrefix(value: string): StartWorkspaceRequest;

    hasMetadata(): boolean;
    clearMetadata(): void;
    getMetadata(): WorkspaceMetadata | undefined;
    setMetadata(value?: WorkspaceMetadata): StartWorkspaceRequest;

    hasSpec(): boolean;
    clearSpec(): void;
    getSpec(): StartWorkspaceSpec | undefined;
    setSpec(value?: StartWorkspaceSpec): StartWorkspaceRequest;
    getType(): WorkspaceType;
    setType(value: WorkspaceType): StartWorkspaceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StartWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: StartWorkspaceRequest): StartWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StartWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StartWorkspaceRequest;
    static deserializeBinaryFromReader(message: StartWorkspaceRequest, reader: jspb.BinaryReader): StartWorkspaceRequest;
}

export namespace StartWorkspaceRequest {
    export type AsObject = {
        id: string,
        servicePrefix: string,
        metadata?: WorkspaceMetadata.AsObject,
        spec?: StartWorkspaceSpec.AsObject,
        type: WorkspaceType,
    }
}

export class StartWorkspaceResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): StartWorkspaceResponse;
    getOwnerToken(): string;
    setOwnerToken(value: string): StartWorkspaceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StartWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: StartWorkspaceResponse): StartWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StartWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StartWorkspaceResponse;
    static deserializeBinaryFromReader(message: StartWorkspaceResponse, reader: jspb.BinaryReader): StartWorkspaceResponse;
}

export namespace StartWorkspaceResponse {
    export type AsObject = {
        url: string,
        ownerToken: string,
    }
}

export class StopWorkspaceRequest extends jspb.Message {
    getId(): string;
    setId(value: string): StopWorkspaceRequest;
    getPolicy(): StopWorkspacePolicy;
    setPolicy(value: StopWorkspacePolicy): StopWorkspaceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StopWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: StopWorkspaceRequest): StopWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StopWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StopWorkspaceRequest;
    static deserializeBinaryFromReader(message: StopWorkspaceRequest, reader: jspb.BinaryReader): StopWorkspaceRequest;
}

export namespace StopWorkspaceRequest {
    export type AsObject = {
        id: string,
        policy: StopWorkspacePolicy,
    }
}

export class StopWorkspaceResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StopWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: StopWorkspaceResponse): StopWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StopWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StopWorkspaceResponse;
    static deserializeBinaryFromReader(message: StopWorkspaceResponse, reader: jspb.BinaryReader): StopWorkspaceResponse;
}

export namespace StopWorkspaceResponse {
    export type AsObject = {
    }
}

export class DescribeWorkspaceRequest extends jspb.Message {
    getId(): string;
    setId(value: string): DescribeWorkspaceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DescribeWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DescribeWorkspaceRequest): DescribeWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DescribeWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DescribeWorkspaceRequest;
    static deserializeBinaryFromReader(message: DescribeWorkspaceRequest, reader: jspb.BinaryReader): DescribeWorkspaceRequest;
}

export namespace DescribeWorkspaceRequest {
    export type AsObject = {
        id: string,
    }
}

export class DescribeWorkspaceResponse extends jspb.Message {

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): WorkspaceStatus | undefined;
    setStatus(value?: WorkspaceStatus): DescribeWorkspaceResponse;
    getLastactivity(): string;
    setLastactivity(value: string): DescribeWorkspaceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DescribeWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DescribeWorkspaceResponse): DescribeWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DescribeWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DescribeWorkspaceResponse;
    static deserializeBinaryFromReader(message: DescribeWorkspaceResponse, reader: jspb.BinaryReader): DescribeWorkspaceResponse;
}

export namespace DescribeWorkspaceResponse {
    export type AsObject = {
        status?: WorkspaceStatus.AsObject,
        lastactivity: string,
    }
}

export class SubscribeRequest extends jspb.Message {

    hasMustMatch(): boolean;
    clearMustMatch(): void;
    getMustMatch(): MetadataFilter | undefined;
    setMustMatch(value?: MetadataFilter): SubscribeRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SubscribeRequest.AsObject;
    static toObject(includeInstance: boolean, msg: SubscribeRequest): SubscribeRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SubscribeRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SubscribeRequest;
    static deserializeBinaryFromReader(message: SubscribeRequest, reader: jspb.BinaryReader): SubscribeRequest;
}

export namespace SubscribeRequest {
    export type AsObject = {
        mustMatch?: MetadataFilter.AsObject,
    }
}

export class SubscribeResponse extends jspb.Message {

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): WorkspaceStatus | undefined;
    setStatus(value?: WorkspaceStatus): SubscribeResponse;

    getHeaderMap(): jspb.Map<string, string>;
    clearHeaderMap(): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SubscribeResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SubscribeResponse): SubscribeResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SubscribeResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SubscribeResponse;
    static deserializeBinaryFromReader(message: SubscribeResponse, reader: jspb.BinaryReader): SubscribeResponse;
}

export namespace SubscribeResponse {
    export type AsObject = {
        status?: WorkspaceStatus.AsObject,

        headerMap: Array<[string, string]>,
    }
}

export class MarkActiveRequest extends jspb.Message {
    getId(): string;
    setId(value: string): MarkActiveRequest;
    getClosed(): boolean;
    setClosed(value: boolean): MarkActiveRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MarkActiveRequest.AsObject;
    static toObject(includeInstance: boolean, msg: MarkActiveRequest): MarkActiveRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MarkActiveRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MarkActiveRequest;
    static deserializeBinaryFromReader(message: MarkActiveRequest, reader: jspb.BinaryReader): MarkActiveRequest;
}

export namespace MarkActiveRequest {
    export type AsObject = {
        id: string,
        closed: boolean,
    }
}

export class MarkActiveResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MarkActiveResponse.AsObject;
    static toObject(includeInstance: boolean, msg: MarkActiveResponse): MarkActiveResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MarkActiveResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MarkActiveResponse;
    static deserializeBinaryFromReader(message: MarkActiveResponse, reader: jspb.BinaryReader): MarkActiveResponse;
}

export namespace MarkActiveResponse {
    export type AsObject = {
    }
}

export class SetTimeoutRequest extends jspb.Message {
    getId(): string;
    setId(value: string): SetTimeoutRequest;
    getDuration(): string;
    setDuration(value: string): SetTimeoutRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetTimeoutRequest.AsObject;
    static toObject(includeInstance: boolean, msg: SetTimeoutRequest): SetTimeoutRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetTimeoutRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetTimeoutRequest;
    static deserializeBinaryFromReader(message: SetTimeoutRequest, reader: jspb.BinaryReader): SetTimeoutRequest;
}

export namespace SetTimeoutRequest {
    export type AsObject = {
        id: string,
        duration: string,
    }
}

export class SetTimeoutResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetTimeoutResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SetTimeoutResponse): SetTimeoutResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetTimeoutResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetTimeoutResponse;
    static deserializeBinaryFromReader(message: SetTimeoutResponse, reader: jspb.BinaryReader): SetTimeoutResponse;
}

export namespace SetTimeoutResponse {
    export type AsObject = {
    }
}

export class ControlPortRequest extends jspb.Message {
    getId(): string;
    setId(value: string): ControlPortRequest;
    getExpose(): boolean;
    setExpose(value: boolean): ControlPortRequest;

    hasSpec(): boolean;
    clearSpec(): void;
    getSpec(): PortSpec | undefined;
    setSpec(value?: PortSpec): ControlPortRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ControlPortRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ControlPortRequest): ControlPortRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ControlPortRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ControlPortRequest;
    static deserializeBinaryFromReader(message: ControlPortRequest, reader: jspb.BinaryReader): ControlPortRequest;
}

export namespace ControlPortRequest {
    export type AsObject = {
        id: string,
        expose: boolean,
        spec?: PortSpec.AsObject,
    }
}

export class ControlPortResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ControlPortResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ControlPortResponse): ControlPortResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ControlPortResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ControlPortResponse;
    static deserializeBinaryFromReader(message: ControlPortResponse, reader: jspb.BinaryReader): ControlPortResponse;
}

export namespace ControlPortResponse {
    export type AsObject = {
    }
}

export class TakeSnapshotRequest extends jspb.Message {
    getId(): string;
    setId(value: string): TakeSnapshotRequest;
    getReturnImmediately(): boolean;
    setReturnImmediately(value: boolean): TakeSnapshotRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): TakeSnapshotRequest.AsObject;
    static toObject(includeInstance: boolean, msg: TakeSnapshotRequest): TakeSnapshotRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: TakeSnapshotRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): TakeSnapshotRequest;
    static deserializeBinaryFromReader(message: TakeSnapshotRequest, reader: jspb.BinaryReader): TakeSnapshotRequest;
}

export namespace TakeSnapshotRequest {
    export type AsObject = {
        id: string,
        returnImmediately: boolean,
    }
}

export class TakeSnapshotResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): TakeSnapshotResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): TakeSnapshotResponse.AsObject;
    static toObject(includeInstance: boolean, msg: TakeSnapshotResponse): TakeSnapshotResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: TakeSnapshotResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): TakeSnapshotResponse;
    static deserializeBinaryFromReader(message: TakeSnapshotResponse, reader: jspb.BinaryReader): TakeSnapshotResponse;
}

export namespace TakeSnapshotResponse {
    export type AsObject = {
        url: string,
    }
}

export class ControlAdmissionRequest extends jspb.Message {
    getId(): string;
    setId(value: string): ControlAdmissionRequest;
    getLevel(): AdmissionLevel;
    setLevel(value: AdmissionLevel): ControlAdmissionRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ControlAdmissionRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ControlAdmissionRequest): ControlAdmissionRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ControlAdmissionRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ControlAdmissionRequest;
    static deserializeBinaryFromReader(message: ControlAdmissionRequest, reader: jspb.BinaryReader): ControlAdmissionRequest;
}

export namespace ControlAdmissionRequest {
    export type AsObject = {
        id: string,
        level: AdmissionLevel,
    }
}

export class ControlAdmissionResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ControlAdmissionResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ControlAdmissionResponse): ControlAdmissionResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ControlAdmissionResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ControlAdmissionResponse;
    static deserializeBinaryFromReader(message: ControlAdmissionResponse, reader: jspb.BinaryReader): ControlAdmissionResponse;
}

export namespace ControlAdmissionResponse {
    export type AsObject = {
    }
}

export class DeleteVolumeSnapshotRequest extends jspb.Message {
    getId(): string;
    setId(value: string): DeleteVolumeSnapshotRequest;
    getVolumeHandle(): string;
    setVolumeHandle(value: string): DeleteVolumeSnapshotRequest;
    getSoftDelete(): boolean;
    setSoftDelete(value: boolean): DeleteVolumeSnapshotRequest;
    getWsType(): WorkspaceType;
    setWsType(value: WorkspaceType): DeleteVolumeSnapshotRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteVolumeSnapshotRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteVolumeSnapshotRequest): DeleteVolumeSnapshotRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteVolumeSnapshotRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteVolumeSnapshotRequest;
    static deserializeBinaryFromReader(message: DeleteVolumeSnapshotRequest, reader: jspb.BinaryReader): DeleteVolumeSnapshotRequest;
}

export namespace DeleteVolumeSnapshotRequest {
    export type AsObject = {
        id: string,
        volumeHandle: string,
        softDelete: boolean,
        wsType: WorkspaceType,
    }
}

export class DeleteVolumeSnapshotResponse extends jspb.Message {
    getWasDeleted(): boolean;
    setWasDeleted(value: boolean): DeleteVolumeSnapshotResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteVolumeSnapshotResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteVolumeSnapshotResponse): DeleteVolumeSnapshotResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteVolumeSnapshotResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteVolumeSnapshotResponse;
    static deserializeBinaryFromReader(message: DeleteVolumeSnapshotResponse, reader: jspb.BinaryReader): DeleteVolumeSnapshotResponse;
}

export namespace DeleteVolumeSnapshotResponse {
    export type AsObject = {
        wasDeleted: boolean,
    }
}

export class BackupWorkspaceRequest extends jspb.Message {
    getId(): string;
    setId(value: string): BackupWorkspaceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BackupWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: BackupWorkspaceRequest): BackupWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BackupWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BackupWorkspaceRequest;
    static deserializeBinaryFromReader(message: BackupWorkspaceRequest, reader: jspb.BinaryReader): BackupWorkspaceRequest;
}

export namespace BackupWorkspaceRequest {
    export type AsObject = {
        id: string,
    }
}

export class BackupWorkspaceResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): BackupWorkspaceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BackupWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: BackupWorkspaceResponse): BackupWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BackupWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BackupWorkspaceResponse;
    static deserializeBinaryFromReader(message: BackupWorkspaceResponse, reader: jspb.BinaryReader): BackupWorkspaceResponse;
}

export namespace BackupWorkspaceResponse {
    export type AsObject = {
        url: string,
    }
}

export class UpdateSSHKeyRequest extends jspb.Message {
    getId(): string;
    setId(value: string): UpdateSSHKeyRequest;
    clearKeysList(): void;
    getKeysList(): Array<string>;
    setKeysList(value: Array<string>): UpdateSSHKeyRequest;
    addKeys(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateSSHKeyRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateSSHKeyRequest): UpdateSSHKeyRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UpdateSSHKeyRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateSSHKeyRequest;
    static deserializeBinaryFromReader(message: UpdateSSHKeyRequest, reader: jspb.BinaryReader): UpdateSSHKeyRequest;
}

export namespace UpdateSSHKeyRequest {
    export type AsObject = {
        id: string,
        keysList: Array<string>,
    }
}

export class UpdateSSHKeyResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateSSHKeyResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateSSHKeyResponse): UpdateSSHKeyResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UpdateSSHKeyResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateSSHKeyResponse;
    static deserializeBinaryFromReader(message: UpdateSSHKeyResponse, reader: jspb.BinaryReader): UpdateSSHKeyResponse;
}

export namespace UpdateSSHKeyResponse {
    export type AsObject = {
    }
}

export class WorkspaceStatus extends jspb.Message {
    getId(): string;
    setId(value: string): WorkspaceStatus;
    getStatusVersion(): number;
    setStatusVersion(value: number): WorkspaceStatus;

    hasMetadata(): boolean;
    clearMetadata(): void;
    getMetadata(): WorkspaceMetadata | undefined;
    setMetadata(value?: WorkspaceMetadata): WorkspaceStatus;

    hasSpec(): boolean;
    clearSpec(): void;
    getSpec(): WorkspaceSpec | undefined;
    setSpec(value?: WorkspaceSpec): WorkspaceStatus;
    getPhase(): WorkspacePhase;
    setPhase(value: WorkspacePhase): WorkspaceStatus;

    hasConditions(): boolean;
    clearConditions(): void;
    getConditions(): WorkspaceConditions | undefined;
    setConditions(value?: WorkspaceConditions): WorkspaceStatus;
    getMessage(): string;
    setMessage(value: string): WorkspaceStatus;

    hasRepo(): boolean;
    clearRepo(): void;
    getRepo(): content_service_api_initializer_pb.GitStatus | undefined;
    setRepo(value?: content_service_api_initializer_pb.GitStatus): WorkspaceStatus;

    hasRuntime(): boolean;
    clearRuntime(): void;
    getRuntime(): WorkspaceRuntimeInfo | undefined;
    setRuntime(value?: WorkspaceRuntimeInfo): WorkspaceStatus;

    hasAuth(): boolean;
    clearAuth(): void;
    getAuth(): WorkspaceAuthentication | undefined;
    setAuth(value?: WorkspaceAuthentication): WorkspaceStatus;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceStatus.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceStatus): WorkspaceStatus.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceStatus, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceStatus;
    static deserializeBinaryFromReader(message: WorkspaceStatus, reader: jspb.BinaryReader): WorkspaceStatus;
}

export namespace WorkspaceStatus {
    export type AsObject = {
        id: string,
        statusVersion: number,
        metadata?: WorkspaceMetadata.AsObject,
        spec?: WorkspaceSpec.AsObject,
        phase: WorkspacePhase,
        conditions?: WorkspaceConditions.AsObject,
        message: string,
        repo?: content_service_api_initializer_pb.GitStatus.AsObject,
        runtime?: WorkspaceRuntimeInfo.AsObject,
        auth?: WorkspaceAuthentication.AsObject,
    }
}

export class IDEImage extends jspb.Message {
    getWebRef(): string;
    setWebRef(value: string): IDEImage;
    getDesktopRef(): string;
    setDesktopRef(value: string): IDEImage;
    getSupervisorRef(): string;
    setSupervisorRef(value: string): IDEImage;
    getDesktopPluginRef(): string;
    setDesktopPluginRef(value: string): IDEImage;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IDEImage.AsObject;
    static toObject(includeInstance: boolean, msg: IDEImage): IDEImage.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IDEImage, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IDEImage;
    static deserializeBinaryFromReader(message: IDEImage, reader: jspb.BinaryReader): IDEImage;
}

export namespace IDEImage {
    export type AsObject = {
        webRef: string,
        desktopRef: string,
        supervisorRef: string,
        desktopPluginRef: string,
    }
}

export class WorkspaceSpec extends jspb.Message {
    getWorkspaceImage(): string;
    setWorkspaceImage(value: string): WorkspaceSpec;
    getDeprecatedIdeImage(): string;
    setDeprecatedIdeImage(value: string): WorkspaceSpec;
    getHeadless(): boolean;
    setHeadless(value: boolean): WorkspaceSpec;
    getUrl(): string;
    setUrl(value: string): WorkspaceSpec;
    clearExposedPortsList(): void;
    getExposedPortsList(): Array<PortSpec>;
    setExposedPortsList(value: Array<PortSpec>): WorkspaceSpec;
    addExposedPorts(value?: PortSpec, index?: number): PortSpec;
    getType(): WorkspaceType;
    setType(value: WorkspaceType): WorkspaceSpec;
    getTimeout(): string;
    setTimeout(value: string): WorkspaceSpec;

    hasIdeImage(): boolean;
    clearIdeImage(): void;
    getIdeImage(): IDEImage | undefined;
    setIdeImage(value?: IDEImage): WorkspaceSpec;
    getClass(): string;
    setClass(value: string): WorkspaceSpec;
    clearIdeImageLayersList(): void;
    getIdeImageLayersList(): Array<string>;
    setIdeImageLayersList(value: Array<string>): WorkspaceSpec;
    addIdeImageLayers(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceSpec.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceSpec): WorkspaceSpec.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceSpec, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceSpec;
    static deserializeBinaryFromReader(message: WorkspaceSpec, reader: jspb.BinaryReader): WorkspaceSpec;
}

export namespace WorkspaceSpec {
    export type AsObject = {
        workspaceImage: string,
        deprecatedIdeImage: string,
        headless: boolean,
        url: string,
        exposedPortsList: Array<PortSpec.AsObject>,
        type: WorkspaceType,
        timeout: string,
        ideImage?: IDEImage.AsObject,
        pb_class: string,
        ideImageLayersList: Array<string>,
    }
}

export class PortSpec extends jspb.Message {
    getPort(): number;
    setPort(value: number): PortSpec;
    getVisibility(): PortVisibility;
    setVisibility(value: PortVisibility): PortSpec;
    getUrl(): string;
    setUrl(value: string): PortSpec;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PortSpec.AsObject;
    static toObject(includeInstance: boolean, msg: PortSpec): PortSpec.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PortSpec, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PortSpec;
    static deserializeBinaryFromReader(message: PortSpec, reader: jspb.BinaryReader): PortSpec;
}

export namespace PortSpec {
    export type AsObject = {
        port: number,
        visibility: PortVisibility,
        url: string,
    }
}

export class VolumeSnapshotInfo extends jspb.Message {
    getVolumeSnapshotName(): string;
    setVolumeSnapshotName(value: string): VolumeSnapshotInfo;
    getVolumeSnapshotHandle(): string;
    setVolumeSnapshotHandle(value: string): VolumeSnapshotInfo;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): VolumeSnapshotInfo.AsObject;
    static toObject(includeInstance: boolean, msg: VolumeSnapshotInfo): VolumeSnapshotInfo.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: VolumeSnapshotInfo, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): VolumeSnapshotInfo;
    static deserializeBinaryFromReader(message: VolumeSnapshotInfo, reader: jspb.BinaryReader): VolumeSnapshotInfo;
}

export namespace VolumeSnapshotInfo {
    export type AsObject = {
        volumeSnapshotName: string,
        volumeSnapshotHandle: string,
    }
}

export class WorkspaceConditions extends jspb.Message {
    getFailed(): string;
    setFailed(value: string): WorkspaceConditions;
    getTimeout(): string;
    setTimeout(value: string): WorkspaceConditions;
    getPullingImages(): WorkspaceConditionBool;
    setPullingImages(value: WorkspaceConditionBool): WorkspaceConditions;
    getSnapshot(): string;
    setSnapshot(value: string): WorkspaceConditions;
    getFinalBackupComplete(): WorkspaceConditionBool;
    setFinalBackupComplete(value: WorkspaceConditionBool): WorkspaceConditions;
    getDeployed(): WorkspaceConditionBool;
    setDeployed(value: WorkspaceConditionBool): WorkspaceConditions;
    getNetworkNotReady(): WorkspaceConditionBool;
    setNetworkNotReady(value: WorkspaceConditionBool): WorkspaceConditions;

    hasFirstUserActivity(): boolean;
    clearFirstUserActivity(): void;
    getFirstUserActivity(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setFirstUserActivity(value?: google_protobuf_timestamp_pb.Timestamp): WorkspaceConditions;
    getHeadlessTaskFailed(): string;
    setHeadlessTaskFailed(value: string): WorkspaceConditions;
    getStoppedByRequest(): WorkspaceConditionBool;
    setStoppedByRequest(value: WorkspaceConditionBool): WorkspaceConditions;

    hasVolumeSnapshot(): boolean;
    clearVolumeSnapshot(): void;
    getVolumeSnapshot(): VolumeSnapshotInfo | undefined;
    setVolumeSnapshot(value?: VolumeSnapshotInfo): WorkspaceConditions;
    getAborted(): WorkspaceConditionBool;
    setAborted(value: WorkspaceConditionBool): WorkspaceConditions;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceConditions.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceConditions): WorkspaceConditions.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceConditions, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceConditions;
    static deserializeBinaryFromReader(message: WorkspaceConditions, reader: jspb.BinaryReader): WorkspaceConditions;
}

export namespace WorkspaceConditions {
    export type AsObject = {
        failed: string,
        timeout: string,
        pullingImages: WorkspaceConditionBool,
        snapshot: string,
        finalBackupComplete: WorkspaceConditionBool,
        deployed: WorkspaceConditionBool,
        networkNotReady: WorkspaceConditionBool,
        firstUserActivity?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        headlessTaskFailed: string,
        stoppedByRequest: WorkspaceConditionBool,
        volumeSnapshot?: VolumeSnapshotInfo.AsObject,
        aborted: WorkspaceConditionBool,
    }
}

export class WorkspaceMetadata extends jspb.Message {
    getOwner(): string;
    setOwner(value: string): WorkspaceMetadata;
    getMetaId(): string;
    setMetaId(value: string): WorkspaceMetadata;

    hasStartedAt(): boolean;
    clearStartedAt(): void;
    getStartedAt(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setStartedAt(value?: google_protobuf_timestamp_pb.Timestamp): WorkspaceMetadata;

    getAnnotationsMap(): jspb.Map<string, string>;
    clearAnnotationsMap(): void;

    hasTeam(): boolean;
    clearTeam(): void;
    getTeam(): string | undefined;
    setTeam(value: string): WorkspaceMetadata;

    hasProject(): boolean;
    clearProject(): void;
    getProject(): string | undefined;
    setProject(value: string): WorkspaceMetadata;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceMetadata.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceMetadata): WorkspaceMetadata.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceMetadata, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceMetadata;
    static deserializeBinaryFromReader(message: WorkspaceMetadata, reader: jspb.BinaryReader): WorkspaceMetadata;
}

export namespace WorkspaceMetadata {
    export type AsObject = {
        owner: string,
        metaId: string,
        startedAt?: google_protobuf_timestamp_pb.Timestamp.AsObject,

        annotationsMap: Array<[string, string]>,
        team?: string,
        project?: string,
    }
}

export class WorkspaceRuntimeInfo extends jspb.Message {
    getNodeName(): string;
    setNodeName(value: string): WorkspaceRuntimeInfo;
    getPodName(): string;
    setPodName(value: string): WorkspaceRuntimeInfo;
    getNodeIp(): string;
    setNodeIp(value: string): WorkspaceRuntimeInfo;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceRuntimeInfo.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceRuntimeInfo): WorkspaceRuntimeInfo.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceRuntimeInfo, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceRuntimeInfo;
    static deserializeBinaryFromReader(message: WorkspaceRuntimeInfo, reader: jspb.BinaryReader): WorkspaceRuntimeInfo;
}

export namespace WorkspaceRuntimeInfo {
    export type AsObject = {
        nodeName: string,
        podName: string,
        nodeIp: string,
    }
}

export class WorkspaceAuthentication extends jspb.Message {
    getAdmission(): AdmissionLevel;
    setAdmission(value: AdmissionLevel): WorkspaceAuthentication;
    getOwnerToken(): string;
    setOwnerToken(value: string): WorkspaceAuthentication;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceAuthentication.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceAuthentication): WorkspaceAuthentication.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceAuthentication, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceAuthentication;
    static deserializeBinaryFromReader(message: WorkspaceAuthentication, reader: jspb.BinaryReader): WorkspaceAuthentication;
}

export namespace WorkspaceAuthentication {
    export type AsObject = {
        admission: AdmissionLevel,
        ownerToken: string,
    }
}

export class StartWorkspaceSpec extends jspb.Message {
    getWorkspaceImage(): string;
    setWorkspaceImage(value: string): StartWorkspaceSpec;
    getDeprecatedIdeImage(): string;
    setDeprecatedIdeImage(value: string): StartWorkspaceSpec;
    clearFeatureFlagsList(): void;
    getFeatureFlagsList(): Array<WorkspaceFeatureFlag>;
    setFeatureFlagsList(value: Array<WorkspaceFeatureFlag>): StartWorkspaceSpec;
    addFeatureFlags(value: WorkspaceFeatureFlag, index?: number): WorkspaceFeatureFlag;

    hasInitializer(): boolean;
    clearInitializer(): void;
    getInitializer(): content_service_api_initializer_pb.WorkspaceInitializer | undefined;
    setInitializer(value?: content_service_api_initializer_pb.WorkspaceInitializer): StartWorkspaceSpec;
    clearPortsList(): void;
    getPortsList(): Array<PortSpec>;
    setPortsList(value: Array<PortSpec>): StartWorkspaceSpec;
    addPorts(value?: PortSpec, index?: number): PortSpec;
    clearEnvvarsList(): void;
    getEnvvarsList(): Array<EnvironmentVariable>;
    setEnvvarsList(value: Array<EnvironmentVariable>): StartWorkspaceSpec;
    addEnvvars(value?: EnvironmentVariable, index?: number): EnvironmentVariable;
    getWorkspaceLocation(): string;
    setWorkspaceLocation(value: string): StartWorkspaceSpec;

    hasGit(): boolean;
    clearGit(): void;
    getGit(): GitSpec | undefined;
    setGit(value?: GitSpec): StartWorkspaceSpec;
    getTimeout(): string;
    setTimeout(value: string): StartWorkspaceSpec;
    getAdmission(): AdmissionLevel;
    setAdmission(value: AdmissionLevel): StartWorkspaceSpec;

    hasIdeImage(): boolean;
    clearIdeImage(): void;
    getIdeImage(): IDEImage | undefined;
    setIdeImage(value?: IDEImage): StartWorkspaceSpec;
    getClass(): string;
    setClass(value: string): StartWorkspaceSpec;

    hasVolumeSnapshot(): boolean;
    clearVolumeSnapshot(): void;
    getVolumeSnapshot(): VolumeSnapshotInfo | undefined;
    setVolumeSnapshot(value?: VolumeSnapshotInfo): StartWorkspaceSpec;
    clearSshPublicKeysList(): void;
    getSshPublicKeysList(): Array<string>;
    setSshPublicKeysList(value: Array<string>): StartWorkspaceSpec;
    addSshPublicKeys(value: string, index?: number): string;
    clearSysEnvvarsList(): void;
    getSysEnvvarsList(): Array<EnvironmentVariable>;
    setSysEnvvarsList(value: Array<EnvironmentVariable>): StartWorkspaceSpec;
    addSysEnvvars(value?: EnvironmentVariable, index?: number): EnvironmentVariable;
    clearIdeImageLayersList(): void;
    getIdeImageLayersList(): Array<string>;
    setIdeImageLayersList(value: Array<string>): StartWorkspaceSpec;
    addIdeImageLayers(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StartWorkspaceSpec.AsObject;
    static toObject(includeInstance: boolean, msg: StartWorkspaceSpec): StartWorkspaceSpec.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StartWorkspaceSpec, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StartWorkspaceSpec;
    static deserializeBinaryFromReader(message: StartWorkspaceSpec, reader: jspb.BinaryReader): StartWorkspaceSpec;
}

export namespace StartWorkspaceSpec {
    export type AsObject = {
        workspaceImage: string,
        deprecatedIdeImage: string,
        featureFlagsList: Array<WorkspaceFeatureFlag>,
        initializer?: content_service_api_initializer_pb.WorkspaceInitializer.AsObject,
        portsList: Array<PortSpec.AsObject>,
        envvarsList: Array<EnvironmentVariable.AsObject>,
        workspaceLocation: string,
        git?: GitSpec.AsObject,
        timeout: string,
        admission: AdmissionLevel,
        ideImage?: IDEImage.AsObject,
        pb_class: string,
        volumeSnapshot?: VolumeSnapshotInfo.AsObject,
        sshPublicKeysList: Array<string>,
        sysEnvvarsList: Array<EnvironmentVariable.AsObject>,
        ideImageLayersList: Array<string>,
    }
}

export class GitSpec extends jspb.Message {
    getUsername(): string;
    setUsername(value: string): GitSpec;
    getEmail(): string;
    setEmail(value: string): GitSpec;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GitSpec.AsObject;
    static toObject(includeInstance: boolean, msg: GitSpec): GitSpec.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GitSpec, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GitSpec;
    static deserializeBinaryFromReader(message: GitSpec, reader: jspb.BinaryReader): GitSpec;
}

export namespace GitSpec {
    export type AsObject = {
        username: string,
        email: string,
    }
}

export class EnvironmentVariable extends jspb.Message {
    getName(): string;
    setName(value: string): EnvironmentVariable;
    getValue(): string;
    setValue(value: string): EnvironmentVariable;

    hasSecret(): boolean;
    clearSecret(): void;
    getSecret(): EnvironmentVariable.SecretKeyRef | undefined;
    setSecret(value?: EnvironmentVariable.SecretKeyRef): EnvironmentVariable;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): EnvironmentVariable.AsObject;
    static toObject(includeInstance: boolean, msg: EnvironmentVariable): EnvironmentVariable.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: EnvironmentVariable, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): EnvironmentVariable;
    static deserializeBinaryFromReader(message: EnvironmentVariable, reader: jspb.BinaryReader): EnvironmentVariable;
}

export namespace EnvironmentVariable {
    export type AsObject = {
        name: string,
        value: string,
        secret?: EnvironmentVariable.SecretKeyRef.AsObject,
    }


    export class SecretKeyRef extends jspb.Message {
        getSecretName(): string;
        setSecretName(value: string): SecretKeyRef;
        getKey(): string;
        setKey(value: string): SecretKeyRef;

        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): SecretKeyRef.AsObject;
        static toObject(includeInstance: boolean, msg: SecretKeyRef): SecretKeyRef.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: SecretKeyRef, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): SecretKeyRef;
        static deserializeBinaryFromReader(message: SecretKeyRef, reader: jspb.BinaryReader): SecretKeyRef;
    }

    export namespace SecretKeyRef {
        export type AsObject = {
            secretName: string,
            key: string,
        }
    }

}

export class ExposedPorts extends jspb.Message {
    clearPortsList(): void;
    getPortsList(): Array<PortSpec>;
    setPortsList(value: Array<PortSpec>): ExposedPorts;
    addPorts(value?: PortSpec, index?: number): PortSpec;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ExposedPorts.AsObject;
    static toObject(includeInstance: boolean, msg: ExposedPorts): ExposedPorts.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ExposedPorts, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ExposedPorts;
    static deserializeBinaryFromReader(message: ExposedPorts, reader: jspb.BinaryReader): ExposedPorts;
}

export namespace ExposedPorts {
    export type AsObject = {
        portsList: Array<PortSpec.AsObject>,
    }
}

export class SSHPublicKeys extends jspb.Message {
    clearKeysList(): void;
    getKeysList(): Array<string>;
    setKeysList(value: Array<string>): SSHPublicKeys;
    addKeys(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SSHPublicKeys.AsObject;
    static toObject(includeInstance: boolean, msg: SSHPublicKeys): SSHPublicKeys.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SSHPublicKeys, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SSHPublicKeys;
    static deserializeBinaryFromReader(message: SSHPublicKeys, reader: jspb.BinaryReader): SSHPublicKeys;
}

export namespace SSHPublicKeys {
    export type AsObject = {
        keysList: Array<string>,
    }
}

export class DescribeClusterRequest extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DescribeClusterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DescribeClusterRequest): DescribeClusterRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DescribeClusterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DescribeClusterRequest;
    static deserializeBinaryFromReader(message: DescribeClusterRequest, reader: jspb.BinaryReader): DescribeClusterRequest;
}

export namespace DescribeClusterRequest {
    export type AsObject = {
    }
}

export class DescribeClusterResponse extends jspb.Message {
    clearWorkspaceclassesList(): void;
    getWorkspaceclassesList(): Array<WorkspaceClass>;
    setWorkspaceclassesList(value: Array<WorkspaceClass>): DescribeClusterResponse;
    addWorkspaceclasses(value?: WorkspaceClass, index?: number): WorkspaceClass;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DescribeClusterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DescribeClusterResponse): DescribeClusterResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DescribeClusterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DescribeClusterResponse;
    static deserializeBinaryFromReader(message: DescribeClusterResponse, reader: jspb.BinaryReader): DescribeClusterResponse;
}

export namespace DescribeClusterResponse {
    export type AsObject = {
        workspaceclassesList: Array<WorkspaceClass.AsObject>,
    }
}

export class WorkspaceClass extends jspb.Message {
    getId(): string;
    setId(value: string): WorkspaceClass;
    getDisplayname(): string;
    setDisplayname(value: string): WorkspaceClass;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceClass.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceClass): WorkspaceClass.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceClass, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceClass;
    static deserializeBinaryFromReader(message: WorkspaceClass, reader: jspb.BinaryReader): WorkspaceClass;
}

export namespace WorkspaceClass {
    export type AsObject = {
        id: string,
        displayname: string,
    }
}

export enum StopWorkspacePolicy {
    NORMALLY = 0,
    IMMEDIATELY = 1,
    ABORT = 2,
}

export enum AdmissionLevel {
    ADMIT_OWNER_ONLY = 0,
    ADMIT_EVERYONE = 1,
}

export enum PortVisibility {
    PORT_VISIBILITY_PRIVATE = 0,
    PORT_VISIBILITY_PUBLIC = 1,
}

export enum WorkspaceConditionBool {
    FALSE = 0,
    TRUE = 1,
    EMPTY = 2,
}

export enum WorkspacePhase {
    UNKNOWN = 0,
    PENDING = 1,
    CREATING = 2,
    INITIALIZING = 3,
    RUNNING = 4,
    INTERRUPTED = 7,
    STOPPING = 5,
    STOPPED = 6,
}

export enum WorkspaceFeatureFlag {
    NOOP = 0,
    FULL_WORKSPACE_BACKUP = 4,
    PERSISTENT_VOLUME_CLAIM = 7,
    WORKSPACE_CLASS_LIMITING = 9,
    WORKSPACE_CONNECTION_LIMITING = 10,
    WORKSPACE_PSI = 11,
}

export enum WorkspaceType {
    REGULAR = 0,
    PREBUILD = 1,
    IMAGEBUILD = 4,
}
