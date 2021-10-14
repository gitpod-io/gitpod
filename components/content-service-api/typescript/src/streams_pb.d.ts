// package: contentservice
// file: streams.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class StartStreamRequest extends jspb.Message {
    getId(): string;
    setId(value: string): StartStreamRequest;
    getOwnerId(): string;
    setOwnerId(value: string): StartStreamRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): StartStreamRequest;
    getInstanceId(): string;
    setInstanceId(value: string): StartStreamRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StartStreamRequest.AsObject;
    static toObject(includeInstance: boolean, msg: StartStreamRequest): StartStreamRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StartStreamRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StartStreamRequest;
    static deserializeBinaryFromReader(message: StartStreamRequest, reader: jspb.BinaryReader): StartStreamRequest;
}

export namespace StartStreamRequest {
    export type AsObject = {
        id: string,
        ownerId: string,
        workspaceId: string,
        instanceId: string,
    }
}

export class StartStreamResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): StartStreamResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StartStreamResponse.AsObject;
    static toObject(includeInstance: boolean, msg: StartStreamResponse): StartStreamResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StartStreamResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StartStreamResponse;
    static deserializeBinaryFromReader(message: StartStreamResponse, reader: jspb.BinaryReader): StartStreamResponse;
}

export namespace StartStreamResponse {
    export type AsObject = {
        url: string,
    }
}

export class CommitStreamRequest extends jspb.Message {
    getId(): string;
    setId(value: string): CommitStreamRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CommitStreamRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CommitStreamRequest): CommitStreamRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CommitStreamRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CommitStreamRequest;
    static deserializeBinaryFromReader(message: CommitStreamRequest, reader: jspb.BinaryReader): CommitStreamRequest;
}

export namespace CommitStreamRequest {
    export type AsObject = {
        id: string,
    }
}

export class CommitStreamResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CommitStreamResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CommitStreamResponse): CommitStreamResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CommitStreamResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CommitStreamResponse;
    static deserializeBinaryFromReader(message: CommitStreamResponse, reader: jspb.BinaryReader): CommitStreamResponse;
}

export namespace CommitStreamResponse {
    export type AsObject = {
    }
}

export class AccessStreamRequest extends jspb.Message {
    getId(): string;
    setId(value: string): AccessStreamRequest;
    getOwnerId(): string;
    setOwnerId(value: string): AccessStreamRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): AccessStreamRequest;
    getInstanceId(): string;
    setInstanceId(value: string): AccessStreamRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): AccessStreamRequest.AsObject;
    static toObject(includeInstance: boolean, msg: AccessStreamRequest): AccessStreamRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: AccessStreamRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): AccessStreamRequest;
    static deserializeBinaryFromReader(message: AccessStreamRequest, reader: jspb.BinaryReader): AccessStreamRequest;
}

export namespace AccessStreamRequest {
    export type AsObject = {
        id: string,
        ownerId: string,
        workspaceId: string,
        instanceId: string,
    }
}

export class AccessStreamResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): AccessStreamResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): AccessStreamResponse.AsObject;
    static toObject(includeInstance: boolean, msg: AccessStreamResponse): AccessStreamResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: AccessStreamResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): AccessStreamResponse;
    static deserializeBinaryFromReader(message: AccessStreamResponse, reader: jspb.BinaryReader): AccessStreamResponse;
}

export namespace AccessStreamResponse {
    export type AsObject = {
        url: string,
    }
}
