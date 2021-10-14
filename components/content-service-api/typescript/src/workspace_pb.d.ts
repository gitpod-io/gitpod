// package: contentservice
// file: workspace.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class WorkspaceDownloadURLRequest extends jspb.Message {
    getOwnerId(): string;
    setOwnerId(value: string): WorkspaceDownloadURLRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): WorkspaceDownloadURLRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceDownloadURLRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceDownloadURLRequest): WorkspaceDownloadURLRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceDownloadURLRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceDownloadURLRequest;
    static deserializeBinaryFromReader(message: WorkspaceDownloadURLRequest, reader: jspb.BinaryReader): WorkspaceDownloadURLRequest;
}

export namespace WorkspaceDownloadURLRequest {
    export type AsObject = {
        ownerId: string,
        workspaceId: string,
    }
}

export class WorkspaceDownloadURLResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): WorkspaceDownloadURLResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceDownloadURLResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceDownloadURLResponse): WorkspaceDownloadURLResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceDownloadURLResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceDownloadURLResponse;
    static deserializeBinaryFromReader(message: WorkspaceDownloadURLResponse, reader: jspb.BinaryReader): WorkspaceDownloadURLResponse;
}

export namespace WorkspaceDownloadURLResponse {
    export type AsObject = {
        url: string,
    }
}

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
