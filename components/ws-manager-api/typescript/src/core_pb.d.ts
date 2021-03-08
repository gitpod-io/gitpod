/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
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

export class GetWorkspacesRequest extends jspb.Message { 

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
    }
}

export class SubscribeResponse extends jspb.Message { 

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): WorkspaceStatus | undefined;
    setStatus(value?: WorkspaceStatus): SubscribeResponse;


    hasLog(): boolean;
    clearLog(): void;
    getLog(): WorkspaceLogMessage | undefined;
    setLog(value?: WorkspaceLogMessage): SubscribeResponse;


    getHeaderMap(): jspb.Map<string, string>;
    clearHeaderMap(): void;


    getPayloadCase(): SubscribeResponse.PayloadCase;

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
        log?: WorkspaceLogMessage.AsObject,

        headerMap: Array<[string, string]>,
    }

    export enum PayloadCase {
        PAYLOAD_NOT_SET = 0,
    
    STATUS = 1,

    LOG = 2,

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

export class WorkspaceStatus extends jspb.Message { 
    getId(): string;
    setId(value: string): WorkspaceStatus;


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

export class WorkspaceSpec extends jspb.Message { 
    getWorkspaceImage(): string;
    setWorkspaceImage(value: string): WorkspaceSpec;

    getIdeImage(): string;
    setIdeImage(value: string): WorkspaceSpec;

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
        ideImage: string,
        headless: boolean,
        url: string,
        exposedPortsList: Array<PortSpec.AsObject>,
        type: WorkspaceType,
        timeout: string,
    }
}

export class PortSpec extends jspb.Message { 
    getPort(): number;
    setPort(value: number): PortSpec;

    getTarget(): number;
    setTarget(value: number): PortSpec;

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
        target: number,
        visibility: PortVisibility,
        url: string,
    }
}

export class WorkspaceConditions extends jspb.Message { 
    getFailed(): string;
    setFailed(value: string): WorkspaceConditions;

    getTimeout(): string;
    setTimeout(value: string): WorkspaceConditions;

    getPullingImages(): WorkspaceConditionBool;
    setPullingImages(value: WorkspaceConditionBool): WorkspaceConditions;

    getServiceExists(): WorkspaceConditionBool;
    setServiceExists(value: WorkspaceConditionBool): WorkspaceConditions;

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
        serviceExists: WorkspaceConditionBool,
        snapshot: string,
        finalBackupComplete: WorkspaceConditionBool,
        deployed: WorkspaceConditionBool,
        networkNotReady: WorkspaceConditionBool,
        firstUserActivity?: google_protobuf_timestamp_pb.Timestamp.AsObject,
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

    getIdeImage(): string;
    setIdeImage(value: string): StartWorkspaceSpec;

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

    getCheckoutLocation(): string;
    setCheckoutLocation(value: string): StartWorkspaceSpec;

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
        ideImage: string,
        featureFlagsList: Array<WorkspaceFeatureFlag>,
        initializer?: content_service_api_initializer_pb.WorkspaceInitializer.AsObject,
        portsList: Array<PortSpec.AsObject>,
        envvarsList: Array<EnvironmentVariable.AsObject>,
        checkoutLocation: string,
        workspaceLocation: string,
        git?: GitSpec.AsObject,
        timeout: string,
        admission: AdmissionLevel,
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
    }
}

export class WorkspaceLogMessage extends jspb.Message { 
    getId(): string;
    setId(value: string): WorkspaceLogMessage;


    hasMetadata(): boolean;
    clearMetadata(): void;
    getMetadata(): WorkspaceMetadata | undefined;
    setMetadata(value?: WorkspaceMetadata): WorkspaceLogMessage;

    getMessage(): string;
    setMessage(value: string): WorkspaceLogMessage;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceLogMessage.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceLogMessage): WorkspaceLogMessage.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceLogMessage, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceLogMessage;
    static deserializeBinaryFromReader(message: WorkspaceLogMessage, reader: jspb.BinaryReader): WorkspaceLogMessage;
}

export namespace WorkspaceLogMessage {
    export type AsObject = {
        id: string,
        metadata?: WorkspaceMetadata.AsObject,
        message: string,
    }
}

export enum StopWorkspacePolicy {
    NORMALLY = 0,
    IMMEDIATELY = 1,
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
    FIXED_RESOURCES = 5,
    USER_NAMESPACE = 6,
}

export enum WorkspaceType {
    REGULAR = 0,
    PREBUILD = 1,
    PROBE = 2,
    GHOST = 3,
}
