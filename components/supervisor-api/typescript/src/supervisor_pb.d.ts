/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: supervisor
// file: supervisor.proto

/* tslint:disable */

import * as jspb from "google-protobuf";

export class PrepareBackupRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrepareBackupRequest.AsObject;
    static toObject(includeInstance: boolean, msg: PrepareBackupRequest): PrepareBackupRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrepareBackupRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrepareBackupRequest;
    static deserializeBinaryFromReader(message: PrepareBackupRequest, reader: jspb.BinaryReader): PrepareBackupRequest;
}

export namespace PrepareBackupRequest {
    export type AsObject = {
    }
}

export class PrepareBackupResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrepareBackupResponse.AsObject;
    static toObject(includeInstance: boolean, msg: PrepareBackupResponse): PrepareBackupResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrepareBackupResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrepareBackupResponse;
    static deserializeBinaryFromReader(message: PrepareBackupResponse, reader: jspb.BinaryReader): PrepareBackupResponse;
}

export namespace PrepareBackupResponse {
    export type AsObject = {
    }
}

export class StatusRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StatusRequest.AsObject;
    static toObject(includeInstance: boolean, msg: StatusRequest): StatusRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StatusRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StatusRequest;
    static deserializeBinaryFromReader(message: StatusRequest, reader: jspb.BinaryReader): StatusRequest;
}

export namespace StatusRequest {
    export type AsObject = {
    }
}

export class StatusResponse extends jspb.Message { 
    getCanaryAvailable(): boolean;
    setCanaryAvailable(value: boolean): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StatusResponse.AsObject;
    static toObject(includeInstance: boolean, msg: StatusResponse): StatusResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StatusResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StatusResponse;
    static deserializeBinaryFromReader(message: StatusResponse, reader: jspb.BinaryReader): StatusResponse;
}

export namespace StatusResponse {
    export type AsObject = {
        canaryAvailable: boolean,
    }
}

export class DebugPauseTheiaRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DebugPauseTheiaRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DebugPauseTheiaRequest): DebugPauseTheiaRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DebugPauseTheiaRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DebugPauseTheiaRequest;
    static deserializeBinaryFromReader(message: DebugPauseTheiaRequest, reader: jspb.BinaryReader): DebugPauseTheiaRequest;
}

export namespace DebugPauseTheiaRequest {
    export type AsObject = {
    }
}

export class DebugPauseTheiaResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DebugPauseTheiaResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DebugPauseTheiaResponse): DebugPauseTheiaResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DebugPauseTheiaResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DebugPauseTheiaResponse;
    static deserializeBinaryFromReader(message: DebugPauseTheiaResponse, reader: jspb.BinaryReader): DebugPauseTheiaResponse;
}

export namespace DebugPauseTheiaResponse {
    export type AsObject = {
    }
}

export class ContentStatusRequest extends jspb.Message { 
    getWait(): boolean;
    setWait(value: boolean): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ContentStatusRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ContentStatusRequest): ContentStatusRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ContentStatusRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ContentStatusRequest;
    static deserializeBinaryFromReader(message: ContentStatusRequest, reader: jspb.BinaryReader): ContentStatusRequest;
}

export namespace ContentStatusRequest {
    export type AsObject = {
        wait: boolean,
    }
}

export class ContentStatusResponse extends jspb.Message { 
    getAvailable(): boolean;
    setAvailable(value: boolean): void;

    getSource(): ContentSource;
    setSource(value: ContentSource): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ContentStatusResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ContentStatusResponse): ContentStatusResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ContentStatusResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ContentStatusResponse;
    static deserializeBinaryFromReader(message: ContentStatusResponse, reader: jspb.BinaryReader): ContentStatusResponse;
}

export namespace ContentStatusResponse {
    export type AsObject = {
        available: boolean,
        source: ContentSource,
    }
}

export enum ContentSource {
    FROM_OTHER = 0,
    FROM_BACKUP = 1,
    FROM_PREBUILD = 2,
}
