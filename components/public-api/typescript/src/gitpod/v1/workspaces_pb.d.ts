// package: gitpod.v1
// file: gitpod/v1/workspaces.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";
import * as gitpod_v1_pagination_pb from "../../gitpod/v1/pagination_pb";

export class ListWorkspacesRequest extends jspb.Message { 

    hasPagination(): boolean;
    clearPagination(): void;
    getPagination(): gitpod_v1_pagination_pb.Pagination | undefined;
    setPagination(value?: gitpod_v1_pagination_pb.Pagination): ListWorkspacesRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListWorkspacesRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListWorkspacesRequest): ListWorkspacesRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListWorkspacesRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListWorkspacesRequest;
    static deserializeBinaryFromReader(message: ListWorkspacesRequest, reader: jspb.BinaryReader): ListWorkspacesRequest;
}

export namespace ListWorkspacesRequest {
    export type AsObject = {
        pagination?: gitpod_v1_pagination_pb.Pagination.AsObject,
    }
}

export class ListWorkspacesResponse extends jspb.Message { 
    getNextPageToken(): string;
    setNextPageToken(value: string): ListWorkspacesResponse;
    clearResultList(): void;
    getResultList(): Array<Workspace>;
    setResultList(value: Array<Workspace>): ListWorkspacesResponse;
    addResult(value?: Workspace, index?: number): Workspace;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListWorkspacesResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListWorkspacesResponse): ListWorkspacesResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListWorkspacesResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListWorkspacesResponse;
    static deserializeBinaryFromReader(message: ListWorkspacesResponse, reader: jspb.BinaryReader): ListWorkspacesResponse;
}

export namespace ListWorkspacesResponse {
    export type AsObject = {
        nextPageToken: string,
        resultList: Array<Workspace.AsObject>,
    }
}

export class GetWorkspaceRequest extends jspb.Message { 
    getWorkspaceId(): string;
    setWorkspaceId(value: string): GetWorkspaceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetWorkspaceRequest): GetWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetWorkspaceRequest;
    static deserializeBinaryFromReader(message: GetWorkspaceRequest, reader: jspb.BinaryReader): GetWorkspaceRequest;
}

export namespace GetWorkspaceRequest {
    export type AsObject = {
        workspaceId: string,
    }
}

export class GetWorkspaceResponse extends jspb.Message { 

    hasResult(): boolean;
    clearResult(): void;
    getResult(): Workspace | undefined;
    setResult(value?: Workspace): GetWorkspaceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetWorkspaceResponse): GetWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetWorkspaceResponse;
    static deserializeBinaryFromReader(message: GetWorkspaceResponse, reader: jspb.BinaryReader): GetWorkspaceResponse;
}

export namespace GetWorkspaceResponse {
    export type AsObject = {
        result?: Workspace.AsObject,
    }
}

export class CreateWorkspaceRequest extends jspb.Message { 
    getIdempotencyToken(): string;
    setIdempotencyToken(value: string): CreateWorkspaceRequest;
    getContextUrl(): string;
    setContextUrl(value: string): CreateWorkspaceRequest;

    hasIfAvailable(): boolean;
    clearIfAvailable(): void;
    getIfAvailable(): boolean;
    setIfAvailable(value: boolean): CreateWorkspaceRequest;

    hasPrebuildId(): boolean;
    clearPrebuildId(): void;
    getPrebuildId(): string;
    setPrebuildId(value: string): CreateWorkspaceRequest;

    getPrebuildCase(): CreateWorkspaceRequest.PrebuildCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CreateWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CreateWorkspaceRequest): CreateWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CreateWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CreateWorkspaceRequest;
    static deserializeBinaryFromReader(message: CreateWorkspaceRequest, reader: jspb.BinaryReader): CreateWorkspaceRequest;
}

export namespace CreateWorkspaceRequest {
    export type AsObject = {
        idempotencyToken: string,
        contextUrl: string,
        ifAvailable: boolean,
        prebuildId: string,
    }

    export enum PrebuildCase {
        PREBUILD_NOT_SET = 0,
        IF_AVAILABLE = 3,
        PREBUILD_ID = 4,
    }

}

export class CreateWorkspaceResponse extends jspb.Message { 
    getWorkspaceId(): string;
    setWorkspaceId(value: string): CreateWorkspaceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CreateWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CreateWorkspaceResponse): CreateWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CreateWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CreateWorkspaceResponse;
    static deserializeBinaryFromReader(message: CreateWorkspaceResponse, reader: jspb.BinaryReader): CreateWorkspaceResponse;
}

export namespace CreateWorkspaceResponse {
    export type AsObject = {
        workspaceId: string,
    }
}

export class StartWorkspaceRequest extends jspb.Message { 
    getIdempotencyToken(): string;
    setIdempotencyToken(value: string): StartWorkspaceRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): StartWorkspaceRequest;

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
        idempotencyToken: string,
        workspaceId: string,
    }
}

export class StartWorkspaceResponse extends jspb.Message { 
    getInstanceId(): string;
    setInstanceId(value: string): StartWorkspaceResponse;
    getWorkspaceUrl(): string;
    setWorkspaceUrl(value: string): StartWorkspaceResponse;

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
        instanceId: string,
        workspaceUrl: string,
    }
}

export class ListenToWorkspaceInstanceRequest extends jspb.Message { 
    getInstanceId(): string;
    setInstanceId(value: string): ListenToWorkspaceInstanceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToWorkspaceInstanceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToWorkspaceInstanceRequest): ListenToWorkspaceInstanceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToWorkspaceInstanceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToWorkspaceInstanceRequest;
    static deserializeBinaryFromReader(message: ListenToWorkspaceInstanceRequest, reader: jspb.BinaryReader): ListenToWorkspaceInstanceRequest;
}

export namespace ListenToWorkspaceInstanceRequest {
    export type AsObject = {
        instanceId: string,
    }
}

export class ListenToWorkspaceInstanceResponse extends jspb.Message { 

    hasInstanceStatus(): boolean;
    clearInstanceStatus(): void;
    getInstanceStatus(): WorkspaceInstanceStatus | undefined;
    setInstanceStatus(value?: WorkspaceInstanceStatus): ListenToWorkspaceInstanceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToWorkspaceInstanceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToWorkspaceInstanceResponse): ListenToWorkspaceInstanceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToWorkspaceInstanceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToWorkspaceInstanceResponse;
    static deserializeBinaryFromReader(message: ListenToWorkspaceInstanceResponse, reader: jspb.BinaryReader): ListenToWorkspaceInstanceResponse;
}

export namespace ListenToWorkspaceInstanceResponse {
    export type AsObject = {
        instanceStatus?: WorkspaceInstanceStatus.AsObject,
    }
}

export class ListenToImageBuildLogsRequest extends jspb.Message { 
    getInstanceId(): string;
    setInstanceId(value: string): ListenToImageBuildLogsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToImageBuildLogsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToImageBuildLogsRequest): ListenToImageBuildLogsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToImageBuildLogsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToImageBuildLogsRequest;
    static deserializeBinaryFromReader(message: ListenToImageBuildLogsRequest, reader: jspb.BinaryReader): ListenToImageBuildLogsRequest;
}

export namespace ListenToImageBuildLogsRequest {
    export type AsObject = {
        instanceId: string,
    }
}

export class ListenToImageBuildLogsResponse extends jspb.Message { 
    getLine(): string;
    setLine(value: string): ListenToImageBuildLogsResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToImageBuildLogsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToImageBuildLogsResponse): ListenToImageBuildLogsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToImageBuildLogsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToImageBuildLogsResponse;
    static deserializeBinaryFromReader(message: ListenToImageBuildLogsResponse, reader: jspb.BinaryReader): ListenToImageBuildLogsResponse;
}

export namespace ListenToImageBuildLogsResponse {
    export type AsObject = {
        line: string,
    }
}

export class StopWorkspaceRequest extends jspb.Message { 
    getIdempotencyToken(): string;
    setIdempotencyToken(value: string): StopWorkspaceRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): StopWorkspaceRequest;

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
        idempotencyToken: string,
        workspaceId: string,
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

export class Workspace extends jspb.Message { 

    hasMetadata(): boolean;
    clearMetadata(): void;
    getMetadata(): WorkspaceMetadata | undefined;
    setMetadata(value?: WorkspaceMetadata): Workspace;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Workspace.AsObject;
    static toObject(includeInstance: boolean, msg: Workspace): Workspace.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Workspace, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Workspace;
    static deserializeBinaryFromReader(message: Workspace, reader: jspb.BinaryReader): Workspace;
}

export namespace Workspace {
    export type AsObject = {
        metadata?: WorkspaceMetadata.AsObject,
    }
}

export class WorkspaceMetadata extends jspb.Message { 
    getWorkspaceId(): string;
    setWorkspaceId(value: string): WorkspaceMetadata;
    getOwnerId(): string;
    setOwnerId(value: string): WorkspaceMetadata;
    getProjectId(): string;
    setProjectId(value: string): WorkspaceMetadata;

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
        workspaceId: string,
        ownerId: string,
        projectId: string,
    }
}

export class WorkspaceInstance extends jspb.Message { 
    getInstanceId(): string;
    setInstanceId(value: string): WorkspaceInstance;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): WorkspaceInstance;

    hasCreatedAt(): boolean;
    clearCreatedAt(): void;
    getCreatedAt(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setCreatedAt(value?: google_protobuf_timestamp_pb.Timestamp): WorkspaceInstance;

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): WorkspaceInstanceStatus | undefined;
    setStatus(value?: WorkspaceInstanceStatus): WorkspaceInstance;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInstance.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInstance): WorkspaceInstance.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceInstance, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInstance;
    static deserializeBinaryFromReader(message: WorkspaceInstance, reader: jspb.BinaryReader): WorkspaceInstance;
}

export namespace WorkspaceInstance {
    export type AsObject = {
        instanceId: string,
        workspaceId: string,
        createdAt?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        status?: WorkspaceInstanceStatus.AsObject,
    }
}

export class WorkspaceInstanceStatus extends jspb.Message { 
    getStatusVersion(): number;
    setStatusVersion(value: number): WorkspaceInstanceStatus;
    getPhase(): WorkspaceInstancePhase;
    setPhase(value: WorkspaceInstancePhase): WorkspaceInstanceStatus;

    hasConditions(): boolean;
    clearConditions(): void;
    getConditions(): WorkspaceInstanceConditions | undefined;
    setConditions(value?: WorkspaceInstanceConditions): WorkspaceInstanceStatus;
    getMessage(): string;
    setMessage(value: string): WorkspaceInstanceStatus;
    getUrl(): string;
    setUrl(value: string): WorkspaceInstanceStatus;

    hasAuth(): boolean;
    clearAuth(): void;
    getAuth(): WorkspaceInstanceAuthentication | undefined;
    setAuth(value?: WorkspaceInstanceAuthentication): WorkspaceInstanceStatus;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInstanceStatus.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInstanceStatus): WorkspaceInstanceStatus.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceInstanceStatus, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInstanceStatus;
    static deserializeBinaryFromReader(message: WorkspaceInstanceStatus, reader: jspb.BinaryReader): WorkspaceInstanceStatus;
}

export namespace WorkspaceInstanceStatus {
    export type AsObject = {
        statusVersion: number,
        phase: WorkspaceInstancePhase,
        conditions?: WorkspaceInstanceConditions.AsObject,
        message: string,
        url: string,
        auth?: WorkspaceInstanceAuthentication.AsObject,
    }
}

export class WorkspaceInstanceConditions extends jspb.Message { 
    getFailed(): string;
    setFailed(value: string): WorkspaceInstanceConditions;
    getTimeout(): string;
    setTimeout(value: string): WorkspaceInstanceConditions;

    hasFirstUserActivity(): boolean;
    clearFirstUserActivity(): void;
    getFirstUserActivity(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setFirstUserActivity(value?: google_protobuf_timestamp_pb.Timestamp): WorkspaceInstanceConditions;

    hasStoppedByRequest(): boolean;
    clearStoppedByRequest(): void;
    getStoppedByRequest(): boolean | undefined;
    setStoppedByRequest(value: boolean): WorkspaceInstanceConditions;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInstanceConditions.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInstanceConditions): WorkspaceInstanceConditions.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceInstanceConditions, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInstanceConditions;
    static deserializeBinaryFromReader(message: WorkspaceInstanceConditions, reader: jspb.BinaryReader): WorkspaceInstanceConditions;
}

export namespace WorkspaceInstanceConditions {
    export type AsObject = {
        failed: string,
        timeout: string,
        firstUserActivity?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        stoppedByRequest?: boolean,
    }
}

export class WorkspaceInstanceAuthentication extends jspb.Message { 
    getAdmission(): AdmissionLevel;
    setAdmission(value: AdmissionLevel): WorkspaceInstanceAuthentication;
    getOwnerToken(): string;
    setOwnerToken(value: string): WorkspaceInstanceAuthentication;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInstanceAuthentication.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInstanceAuthentication): WorkspaceInstanceAuthentication.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceInstanceAuthentication, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInstanceAuthentication;
    static deserializeBinaryFromReader(message: WorkspaceInstanceAuthentication, reader: jspb.BinaryReader): WorkspaceInstanceAuthentication;
}

export namespace WorkspaceInstanceAuthentication {
    export type AsObject = {
        admission: AdmissionLevel,
        ownerToken: string,
    }
}

export enum WorkspaceInstancePhase {
    WORKSPACE_INSTANCE_PHASE_UNSPECIFIED = 0,
    WORKSPACE_INSTANCE_PHASE_PENDING = 2,
    WORKSPACE_INSTANCE_PHASE_CREATING = 3,
    WORKSPACE_INSTANCE_PHASE_INITIALIZING = 4,
    WORKSPACE_INSTANCE_PHASE_RUNNING = 5,
    WORKSPACE_INSTANCE_PHASE_INTERRUPTED = 6,
    WORKSPACE_INSTANCE_PHASE_STOPPING = 7,
    WORKSPACE_INSTANCE_PHASE_STOPPED = 8,
}

export enum AdmissionLevel {
    ADMISSION_LEVEL_UNSPECIFIED = 0,
    ADMISSION_LEVEL_OWNER_ONLY = 1,
    ADMISSION_LEVEL_EVERYONE = 2,
}
