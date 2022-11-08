/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: workspace.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class DeleteWorkspaceRequest extends jspb.Message {
    getOwnerId(): string;
    setOwnerId(value: string): DeleteWorkspaceRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): DeleteWorkspaceRequest;
    getIncludeSnapshots(): boolean;
    setIncludeSnapshots(value: boolean): DeleteWorkspaceRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteWorkspaceRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteWorkspaceRequest): DeleteWorkspaceRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteWorkspaceRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteWorkspaceRequest;
    static deserializeBinaryFromReader(message: DeleteWorkspaceRequest, reader: jspb.BinaryReader): DeleteWorkspaceRequest;
}

export namespace DeleteWorkspaceRequest {
    export type AsObject = {
        ownerId: string,
        workspaceId: string,
        includeSnapshots: boolean,
    }
}

export class DeleteWorkspaceResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteWorkspaceResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteWorkspaceResponse): DeleteWorkspaceResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteWorkspaceResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteWorkspaceResponse;
    static deserializeBinaryFromReader(message: DeleteWorkspaceResponse, reader: jspb.BinaryReader): DeleteWorkspaceResponse;
}

export namespace DeleteWorkspaceResponse {
    export type AsObject = {
    }
}

export class WorkspaceSnapshotExistsRequest extends jspb.Message {
    getOwnerId(): string;
    setOwnerId(value: string): WorkspaceSnapshotExistsRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): WorkspaceSnapshotExistsRequest;
    getFilename(): string;
    setFilename(value: string): WorkspaceSnapshotExistsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceSnapshotExistsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceSnapshotExistsRequest): WorkspaceSnapshotExistsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceSnapshotExistsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceSnapshotExistsRequest;
    static deserializeBinaryFromReader(message: WorkspaceSnapshotExistsRequest, reader: jspb.BinaryReader): WorkspaceSnapshotExistsRequest;
}

export namespace WorkspaceSnapshotExistsRequest {
    export type AsObject = {
        ownerId: string,
        workspaceId: string,
        filename: string,
    }
}

export class WorkspaceSnapshotExistsResponse extends jspb.Message {
    getExists(): boolean;
    setExists(value: boolean): WorkspaceSnapshotExistsResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceSnapshotExistsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceSnapshotExistsResponse): WorkspaceSnapshotExistsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceSnapshotExistsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceSnapshotExistsResponse;
    static deserializeBinaryFromReader(message: WorkspaceSnapshotExistsResponse, reader: jspb.BinaryReader): WorkspaceSnapshotExistsResponse;
}

export namespace WorkspaceSnapshotExistsResponse {
    export type AsObject = {
        exists: boolean,
    }
}
