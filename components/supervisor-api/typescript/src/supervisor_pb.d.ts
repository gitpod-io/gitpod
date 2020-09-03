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

export class SupervisorStatusRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SupervisorStatusRequest.AsObject;
    static toObject(includeInstance: boolean, msg: SupervisorStatusRequest): SupervisorStatusRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SupervisorStatusRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SupervisorStatusRequest;
    static deserializeBinaryFromReader(message: SupervisorStatusRequest, reader: jspb.BinaryReader): SupervisorStatusRequest;
}

export namespace SupervisorStatusRequest {
    export type AsObject = {
    }
}

export class SupervisorStatusResponse extends jspb.Message { 
    getOk(): boolean;
    setOk(value: boolean): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SupervisorStatusResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SupervisorStatusResponse): SupervisorStatusResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SupervisorStatusResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SupervisorStatusResponse;
    static deserializeBinaryFromReader(message: SupervisorStatusResponse, reader: jspb.BinaryReader): SupervisorStatusResponse;
}

export namespace SupervisorStatusResponse {
    export type AsObject = {
        ok: boolean,
    }
}

export class IDEStatusRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IDEStatusRequest.AsObject;
    static toObject(includeInstance: boolean, msg: IDEStatusRequest): IDEStatusRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IDEStatusRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IDEStatusRequest;
    static deserializeBinaryFromReader(message: IDEStatusRequest, reader: jspb.BinaryReader): IDEStatusRequest;
}

export namespace IDEStatusRequest {
    export type AsObject = {
    }
}

export class IDEStatusResponse extends jspb.Message { 
    getOk(): boolean;
    setOk(value: boolean): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IDEStatusResponse.AsObject;
    static toObject(includeInstance: boolean, msg: IDEStatusResponse): IDEStatusResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IDEStatusResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IDEStatusResponse;
    static deserializeBinaryFromReader(message: IDEStatusResponse, reader: jspb.BinaryReader): IDEStatusResponse;
}

export namespace IDEStatusResponse {
    export type AsObject = {
        ok: boolean,
    }
}

export class BackupStatusRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BackupStatusRequest.AsObject;
    static toObject(includeInstance: boolean, msg: BackupStatusRequest): BackupStatusRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BackupStatusRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BackupStatusRequest;
    static deserializeBinaryFromReader(message: BackupStatusRequest, reader: jspb.BinaryReader): BackupStatusRequest;
}

export namespace BackupStatusRequest {
    export type AsObject = {
    }
}

export class BackupStatusResponse extends jspb.Message { 
    getCanaryAvailable(): boolean;
    setCanaryAvailable(value: boolean): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BackupStatusResponse.AsObject;
    static toObject(includeInstance: boolean, msg: BackupStatusResponse): BackupStatusResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BackupStatusResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BackupStatusResponse;
    static deserializeBinaryFromReader(message: BackupStatusResponse, reader: jspb.BinaryReader): BackupStatusResponse;
}

export namespace BackupStatusResponse {
    export type AsObject = {
        canaryAvailable: boolean,
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
