// package: gitpod.v1
// file: gitpod/v1/workspaces.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";
import * as google_protobuf_field_mask_pb from "google-protobuf/google/protobuf/field_mask_pb";
import * as gitpod_v1_pagination_pb from "../../gitpod/v1/pagination_pb";

export class ListWorkspacesRequest extends jspb.Message { 

    hasPagination(): boolean;
    clearPagination(): void;
    getPagination(): gitpod_v1_pagination_pb.Pagination | undefined;
    setPagination(value?: gitpod_v1_pagination_pb.Pagination): ListWorkspacesRequest;

    hasFieldMask(): boolean;
    clearFieldMask(): void;
    getFieldMask(): google_protobuf_field_mask_pb.FieldMask | undefined;
    setFieldMask(value?: google_protobuf_field_mask_pb.FieldMask): ListWorkspacesRequest;

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
        fieldMask?: google_protobuf_field_mask_pb.FieldMask.AsObject,
    }
}

export class ListWorkspacesResponse extends jspb.Message { 
    getNextPageToken(): string;
    setNextPageToken(value: string): ListWorkspacesResponse;
    clearResultList(): void;
    getResultList(): Array<ListWorkspacesResponse.WorkspaceAndInstance>;
    setResultList(value: Array<ListWorkspacesResponse.WorkspaceAndInstance>): ListWorkspacesResponse;
    addResult(value?: ListWorkspacesResponse.WorkspaceAndInstance, index?: number): ListWorkspacesResponse.WorkspaceAndInstance;

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
        resultList: Array<ListWorkspacesResponse.WorkspaceAndInstance.AsObject>,
    }


    export class WorkspaceAndInstance extends jspb.Message { 

        hasResult(): boolean;
        clearResult(): void;
        getResult(): Workspace | undefined;
        setResult(value?: Workspace): WorkspaceAndInstance;

        hasLastActiveInstances(): boolean;
        clearLastActiveInstances(): void;
        getLastActiveInstances(): WorkspaceInstance | undefined;
        setLastActiveInstances(value?: WorkspaceInstance): WorkspaceAndInstance;

        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): WorkspaceAndInstance.AsObject;
        static toObject(includeInstance: boolean, msg: WorkspaceAndInstance): WorkspaceAndInstance.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: WorkspaceAndInstance, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): WorkspaceAndInstance;
        static deserializeBinaryFromReader(message: WorkspaceAndInstance, reader: jspb.BinaryReader): WorkspaceAndInstance;
    }

    export namespace WorkspaceAndInstance {
        export type AsObject = {
            result?: Workspace.AsObject,
            lastActiveInstances?: WorkspaceInstance.AsObject,
        }
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

export class CreateAndStartWorkspaceRequest extends jspb.Message { 
    getIdempotencyToken(): string;
    setIdempotencyToken(value: string): CreateAndStartWorkspaceRequest;
    getContextUrl(): string;
    setContextUrl(value: string): CreateAndStartWorkspaceRequest;

    hasIfAvailable(): boolean;
    clearIfAvailable(): void;
    getIfAvailable(): boolean;
    setIfAvailable(value: boolean): CreateAndStartWorkspaceRequest;

    hasPrebuildId(): boolean;
    clearPrebuildId(): void;
    getPrebuildId(): string;
    setPrebuildId(value: string): CreateAndStartWorkspaceRequest;

    hasStartSpec(): boolean;
    clearStartSpec(): void;
    getStartSpec(): StartWorkspaceSpec | undefined;
    setStartSpec(value?: StartWorkspaceSpec): CreateAndStartWorkspaceRequest;

    getPrebuildCase(): CreateAndStartWorkspaceRequest.PrebuildCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CreateAndStartWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CreateAndStartWorkspaceRequest): CreateAndStartWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CreateAndStartWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CreateAndStartWorkspaceRequest;
    static deserializeBinaryFromReader(message: CreateAndStartWorkspaceRequest, reader: jspb.BinaryReader): CreateAndStartWorkspaceRequest;
}

export namespace CreateAndStartWorkspaceRequest {
    export type AsObject = {
        idempotencyToken: string,
        contextUrl: string,
        ifAvailable: boolean,
        prebuildId: string,
        startSpec?: StartWorkspaceSpec.AsObject,
    }

    export enum PrebuildCase {
        PREBUILD_NOT_SET = 0,
        IF_AVAILABLE = 3,
        PREBUILD_ID = 4,
    }

}

export class CreateAndStartWorkspaceResponse extends jspb.Message { 
    getWorkspaceId(): string;
    setWorkspaceId(value: string): CreateAndStartWorkspaceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CreateAndStartWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CreateAndStartWorkspaceResponse): CreateAndStartWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CreateAndStartWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CreateAndStartWorkspaceResponse;
    static deserializeBinaryFromReader(message: CreateAndStartWorkspaceResponse, reader: jspb.BinaryReader): CreateAndStartWorkspaceResponse;
}

export namespace CreateAndStartWorkspaceResponse {
    export type AsObject = {
        workspaceId: string,
    }
}

export class StartWorkspaceRequest extends jspb.Message { 
    getIdempotencyToken(): string;
    setIdempotencyToken(value: string): StartWorkspaceRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): StartWorkspaceRequest;

    hasSpec(): boolean;
    clearSpec(): void;
    getSpec(): StartWorkspaceSpec | undefined;
    setSpec(value?: StartWorkspaceSpec): StartWorkspaceRequest;

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
        spec?: StartWorkspaceSpec.AsObject,
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

export class GetActiveWorkspaceInstanceRequest extends jspb.Message { 
    getWorkspaceId(): string;
    setWorkspaceId(value: string): GetActiveWorkspaceInstanceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetActiveWorkspaceInstanceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetActiveWorkspaceInstanceRequest): GetActiveWorkspaceInstanceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetActiveWorkspaceInstanceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetActiveWorkspaceInstanceRequest;
    static deserializeBinaryFromReader(message: GetActiveWorkspaceInstanceRequest, reader: jspb.BinaryReader): GetActiveWorkspaceInstanceRequest;
}

export namespace GetActiveWorkspaceInstanceRequest {
    export type AsObject = {
        workspaceId: string,
    }
}

export class GetActiveWorkspaceInstanceResponse extends jspb.Message { 

    hasInstance(): boolean;
    clearInstance(): void;
    getInstance(): WorkspaceInstance | undefined;
    setInstance(value?: WorkspaceInstance): GetActiveWorkspaceInstanceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetActiveWorkspaceInstanceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetActiveWorkspaceInstanceResponse): GetActiveWorkspaceInstanceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetActiveWorkspaceInstanceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetActiveWorkspaceInstanceResponse;
    static deserializeBinaryFromReader(message: GetActiveWorkspaceInstanceResponse, reader: jspb.BinaryReader): GetActiveWorkspaceInstanceResponse;
}

export namespace GetActiveWorkspaceInstanceResponse {
    export type AsObject = {
        instance?: WorkspaceInstance.AsObject,
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
    getWorkspaceId(): string;
    setWorkspaceId(value: string): Workspace;
    getOwnerId(): string;
    setOwnerId(value: string): Workspace;
    getProjectId(): string;
    setProjectId(value: string): Workspace;

    hasContext(): boolean;
    clearContext(): void;
    getContext(): WorkspaceContext | undefined;
    setContext(value?: WorkspaceContext): Workspace;
    getDescription(): string;
    setDescription(value: string): Workspace;

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
        workspaceId: string,
        ownerId: string,
        projectId: string,
        context?: WorkspaceContext.AsObject,
        description: string,
    }
}

export class WorkspaceContext extends jspb.Message { 
    getContextUrl(): string;
    setContextUrl(value: string): WorkspaceContext;

    hasGit(): boolean;
    clearGit(): void;
    getGit(): WorkspaceContext.Git | undefined;
    setGit(value?: WorkspaceContext.Git): WorkspaceContext;

    hasPrebuild(): boolean;
    clearPrebuild(): void;
    getPrebuild(): WorkspaceContext.Prebuild | undefined;
    setPrebuild(value?: WorkspaceContext.Prebuild): WorkspaceContext;

    hasSnapshot(): boolean;
    clearSnapshot(): void;
    getSnapshot(): WorkspaceContext.Snapshot | undefined;
    setSnapshot(value?: WorkspaceContext.Snapshot): WorkspaceContext;

    getDetailsCase(): WorkspaceContext.DetailsCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceContext.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceContext): WorkspaceContext.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceContext, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceContext;
    static deserializeBinaryFromReader(message: WorkspaceContext, reader: jspb.BinaryReader): WorkspaceContext;
}

export namespace WorkspaceContext {
    export type AsObject = {
        contextUrl: string,
        git?: WorkspaceContext.Git.AsObject,
        prebuild?: WorkspaceContext.Prebuild.AsObject,
        snapshot?: WorkspaceContext.Snapshot.AsObject,
    }


    export class Git extends jspb.Message { 
        getNormalizedContextUrl(): string;
        setNormalizedContextUrl(value: string): Git;
        getCommit(): string;
        setCommit(value: string): Git;

        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): Git.AsObject;
        static toObject(includeInstance: boolean, msg: Git): Git.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: Git, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): Git;
        static deserializeBinaryFromReader(message: Git, reader: jspb.BinaryReader): Git;
    }

    export namespace Git {
        export type AsObject = {
            normalizedContextUrl: string,
            commit: string,
        }
    }

    export class Prebuild extends jspb.Message { 

        hasOriginalContext(): boolean;
        clearOriginalContext(): void;
        getOriginalContext(): WorkspaceContext.Git | undefined;
        setOriginalContext(value?: WorkspaceContext.Git): Prebuild;
        getPrebuildId(): string;
        setPrebuildId(value: string): Prebuild;

        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): Prebuild.AsObject;
        static toObject(includeInstance: boolean, msg: Prebuild): Prebuild.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: Prebuild, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): Prebuild;
        static deserializeBinaryFromReader(message: Prebuild, reader: jspb.BinaryReader): Prebuild;
    }

    export namespace Prebuild {
        export type AsObject = {
            originalContext?: WorkspaceContext.Git.AsObject,
            prebuildId: string,
        }
    }

    export class Snapshot extends jspb.Message { 
        getSnapshotId(): string;
        setSnapshotId(value: string): Snapshot;

        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): Snapshot.AsObject;
        static toObject(includeInstance: boolean, msg: Snapshot): Snapshot.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: Snapshot, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): Snapshot;
        static deserializeBinaryFromReader(message: Snapshot, reader: jspb.BinaryReader): Snapshot;
    }

    export namespace Snapshot {
        export type AsObject = {
            snapshotId: string,
        }
    }


    export enum DetailsCase {
        DETAILS_NOT_SET = 0,
        GIT = 2,
        PREBUILD = 3,
        SNAPSHOT = 4,
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

export class StartWorkspaceSpec extends jspb.Message { 

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
