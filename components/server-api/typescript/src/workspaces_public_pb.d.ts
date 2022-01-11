// package: server
// file: workspaces_public.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class GetWorkspaceRequest extends jspb.Message {
    getId(): string;
    setId(value: string): GetWorkspaceRequest;

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
        id: string,
    }
}

export class GetWorkspaceResponse extends jspb.Message {

    hasWorkspace(): boolean;
    clearWorkspace(): void;
    getWorkspace(): Workspace | undefined;
    setWorkspace(value?: Workspace): GetWorkspaceResponse;

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
        workspace?: Workspace.AsObject,
    }
}

export class ListWorkspacesRequest extends jspb.Message {
    getUserId(): string;
    setUserId(value: string): ListWorkspacesRequest;

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
        userId: string,
    }
}

export class ListWorkspacesResponse extends jspb.Message {
    clearWorkspacesList(): void;
    getWorkspacesList(): Array<Workspace>;
    setWorkspacesList(value: Array<Workspace>): ListWorkspacesResponse;
    addWorkspaces(value?: Workspace, index?: number): Workspace;

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
        workspacesList: Array<Workspace.AsObject>,
    }
}

export class CreateWorkspaceRequest extends jspb.Message {
    getContextUrl(): string;
    setContextUrl(value: string): CreateWorkspaceRequest;

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
        contextUrl: string,
    }
}

export class CreateWorkspaceResponse extends jspb.Message {

    hasWorkspace(): boolean;
    clearWorkspace(): void;
    getWorkspace(): Workspace | undefined;
    setWorkspace(value?: Workspace): CreateWorkspaceResponse;

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
        workspace?: Workspace.AsObject,
    }
}

export class StartWorkspaceRequest extends jspb.Message {
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
        workspaceId: string,
    }
}

export class StartWorkspaceResponse extends jspb.Message {

    hasInstance(): boolean;
    clearInstance(): void;
    getInstance(): WorkspaceInstance | undefined;
    setInstance(value?: WorkspaceInstance): StartWorkspaceResponse;

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
        instance?: WorkspaceInstance.AsObject,
    }
}

export class StopWorkspaceRequest extends jspb.Message {
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

export class WatchWorkspacesRequest extends jspb.Message {

    hasOwnerId(): boolean;
    clearOwnerId(): void;
    getOwnerId(): string;
    setOwnerId(value: string): WatchWorkspacesRequest;

    hasWorkspaceId(): boolean;
    clearWorkspaceId(): void;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): WatchWorkspacesRequest;

    hasInstanceId(): boolean;
    clearInstanceId(): void;
    getInstanceId(): string;
    setInstanceId(value: string): WatchWorkspacesRequest;

    getCriterionCase(): WatchWorkspacesRequest.CriterionCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WatchWorkspacesRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WatchWorkspacesRequest): WatchWorkspacesRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WatchWorkspacesRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WatchWorkspacesRequest;
    static deserializeBinaryFromReader(message: WatchWorkspacesRequest, reader: jspb.BinaryReader): WatchWorkspacesRequest;
}

export namespace WatchWorkspacesRequest {
    export type AsObject = {
        ownerId: string,
        workspaceId: string,
        instanceId: string,
    }

    export enum CriterionCase {
        CRITERION_NOT_SET = 0,
        OWNER_ID = 1,
        WORKSPACE_ID = 2,
        INSTANCE_ID = 3,
    }

}

export class WatchWorkspacesResponse extends jspb.Message {

    hasInstance(): boolean;
    clearInstance(): void;
    getInstance(): WorkspaceInstance | undefined;
    setInstance(value?: WorkspaceInstance): WatchWorkspacesResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WatchWorkspacesResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WatchWorkspacesResponse): WatchWorkspacesResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WatchWorkspacesResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WatchWorkspacesResponse;
    static deserializeBinaryFromReader(message: WatchWorkspacesResponse, reader: jspb.BinaryReader): WatchWorkspacesResponse;
}

export namespace WatchWorkspacesResponse {
    export type AsObject = {
        instance?: WorkspaceInstance.AsObject,
    }
}

export class GetWorkspaceInstanceRequest extends jspb.Message {
    getId(): string;
    setId(value: string): GetWorkspaceInstanceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetWorkspaceInstanceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetWorkspaceInstanceRequest): GetWorkspaceInstanceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetWorkspaceInstanceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetWorkspaceInstanceRequest;
    static deserializeBinaryFromReader(message: GetWorkspaceInstanceRequest, reader: jspb.BinaryReader): GetWorkspaceInstanceRequest;
}

export namespace GetWorkspaceInstanceRequest {
    export type AsObject = {
        id: string,
    }
}

export class GetWorkspaceInstanceResponse extends jspb.Message {

    hasInstance(): boolean;
    clearInstance(): void;
    getInstance(): WorkspaceInstance | undefined;
    setInstance(value?: WorkspaceInstance): GetWorkspaceInstanceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetWorkspaceInstanceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetWorkspaceInstanceResponse): GetWorkspaceInstanceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetWorkspaceInstanceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetWorkspaceInstanceResponse;
    static deserializeBinaryFromReader(message: GetWorkspaceInstanceResponse, reader: jspb.BinaryReader): GetWorkspaceInstanceResponse;
}

export namespace GetWorkspaceInstanceResponse {
    export type AsObject = {
        instance?: WorkspaceInstance.AsObject,
    }
}

export class ListWorkspaceInstancesRequest extends jspb.Message {

    hasUserId(): boolean;
    clearUserId(): void;
    getUserId(): string;
    setUserId(value: string): ListWorkspaceInstancesRequest;

    hasWorkspaceId(): boolean;
    clearWorkspaceId(): void;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): ListWorkspaceInstancesRequest;

    getCriterionCase(): ListWorkspaceInstancesRequest.CriterionCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListWorkspaceInstancesRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListWorkspaceInstancesRequest): ListWorkspaceInstancesRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListWorkspaceInstancesRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListWorkspaceInstancesRequest;
    static deserializeBinaryFromReader(message: ListWorkspaceInstancesRequest, reader: jspb.BinaryReader): ListWorkspaceInstancesRequest;
}

export namespace ListWorkspaceInstancesRequest {
    export type AsObject = {
        userId: string,
        workspaceId: string,
    }

    export enum CriterionCase {
        CRITERION_NOT_SET = 0,
        USER_ID = 1,
        WORKSPACE_ID = 2,
    }

}

export class ListWorkspaceInstancesResponse extends jspb.Message {
    clearInstancesList(): void;
    getInstancesList(): Array<WorkspaceInstance>;
    setInstancesList(value: Array<WorkspaceInstance>): ListWorkspaceInstancesResponse;
    addInstances(value?: WorkspaceInstance, index?: number): WorkspaceInstance;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListWorkspaceInstancesResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListWorkspaceInstancesResponse): ListWorkspaceInstancesResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListWorkspaceInstancesResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListWorkspaceInstancesResponse;
    static deserializeBinaryFromReader(message: ListWorkspaceInstancesResponse, reader: jspb.BinaryReader): ListWorkspaceInstancesResponse;
}

export namespace ListWorkspaceInstancesResponse {
    export type AsObject = {
        instancesList: Array<WorkspaceInstance.AsObject>,
    }
}

export class GetRunningWorkspaceInstanceRequest extends jspb.Message {
    getWorkspaceId(): string;
    setWorkspaceId(value: string): GetRunningWorkspaceInstanceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetRunningWorkspaceInstanceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetRunningWorkspaceInstanceRequest): GetRunningWorkspaceInstanceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetRunningWorkspaceInstanceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetRunningWorkspaceInstanceRequest;
    static deserializeBinaryFromReader(message: GetRunningWorkspaceInstanceRequest, reader: jspb.BinaryReader): GetRunningWorkspaceInstanceRequest;
}

export namespace GetRunningWorkspaceInstanceRequest {
    export type AsObject = {
        workspaceId: string,
    }
}

export class GetRunningWorkspaceInstanceResponse extends jspb.Message {

    hasInstance(): boolean;
    clearInstance(): void;
    getInstance(): WorkspaceInstance | undefined;
    setInstance(value?: WorkspaceInstance): GetRunningWorkspaceInstanceResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetRunningWorkspaceInstanceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetRunningWorkspaceInstanceResponse): GetRunningWorkspaceInstanceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetRunningWorkspaceInstanceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetRunningWorkspaceInstanceResponse;
    static deserializeBinaryFromReader(message: GetRunningWorkspaceInstanceResponse, reader: jspb.BinaryReader): GetRunningWorkspaceInstanceResponse;
}

export namespace GetRunningWorkspaceInstanceResponse {
    export type AsObject = {
        instance?: WorkspaceInstance.AsObject,
    }
}

export class Workspace extends jspb.Message {
    getId(): string;
    setId(value: string): Workspace;
    getOwner(): string;
    setOwner(value: string): Workspace;

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
        id: string,
        owner: string,
    }
}

export class WorkspaceInstance extends jspb.Message {
    getId(): string;
    setId(value: string): WorkspaceInstance;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): WorkspaceInstance;

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
        id: string,
        workspaceId: string,
    }
}
