/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: blobs.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class UploadUrlRequest extends jspb.Message { 
    getOwnerId(): string;
    setOwnerId(value: string): UploadUrlRequest;

    getName(): string;
    setName(value: string): UploadUrlRequest;

    getContentType(): string;
    setContentType(value: string): UploadUrlRequest;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UploadUrlRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UploadUrlRequest): UploadUrlRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UploadUrlRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UploadUrlRequest;
    static deserializeBinaryFromReader(message: UploadUrlRequest, reader: jspb.BinaryReader): UploadUrlRequest;
}

export namespace UploadUrlRequest {
    export type AsObject = {
        ownerId: string,
        name: string,
        contentType: string,
    }
}

export class UploadUrlResponse extends jspb.Message { 
    getUrl(): string;
    setUrl(value: string): UploadUrlResponse;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UploadUrlResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UploadUrlResponse): UploadUrlResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UploadUrlResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UploadUrlResponse;
    static deserializeBinaryFromReader(message: UploadUrlResponse, reader: jspb.BinaryReader): UploadUrlResponse;
}

export namespace UploadUrlResponse {
    export type AsObject = {
        url: string,
    }
}

export class DownloadUrlRequest extends jspb.Message { 
    getOwnerId(): string;
    setOwnerId(value: string): DownloadUrlRequest;

    getName(): string;
    setName(value: string): DownloadUrlRequest;

    getContentType(): string;
    setContentType(value: string): DownloadUrlRequest;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DownloadUrlRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DownloadUrlRequest): DownloadUrlRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DownloadUrlRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DownloadUrlRequest;
    static deserializeBinaryFromReader(message: DownloadUrlRequest, reader: jspb.BinaryReader): DownloadUrlRequest;
}

export namespace DownloadUrlRequest {
    export type AsObject = {
        ownerId: string,
        name: string,
        contentType: string,
    }
}

export class DownloadUrlResponse extends jspb.Message { 
    getUrl(): string;
    setUrl(value: string): DownloadUrlResponse;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DownloadUrlResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DownloadUrlResponse): DownloadUrlResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DownloadUrlResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DownloadUrlResponse;
    static deserializeBinaryFromReader(message: DownloadUrlResponse, reader: jspb.BinaryReader): DownloadUrlResponse;
}

export namespace DownloadUrlResponse {
    export type AsObject = {
        url: string,
    }
}

export class DeleteRequest extends jspb.Message { 
    getOwnerId(): string;
    setOwnerId(value: string): DeleteRequest;


    hasExact(): boolean;
    clearExact(): void;
    getExact(): string;
    setExact(value: string): DeleteRequest;


    hasPrefix(): boolean;
    clearPrefix(): void;
    getPrefix(): string;
    setPrefix(value: string): DeleteRequest;


    getNameCase(): DeleteRequest.NameCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteRequest): DeleteRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteRequest;
    static deserializeBinaryFromReader(message: DeleteRequest, reader: jspb.BinaryReader): DeleteRequest;
}

export namespace DeleteRequest {
    export type AsObject = {
        ownerId: string,
        exact: string,
        prefix: string,
    }

    export enum NameCase {
        NAME_NOT_SET = 0,
    
    EXACT = 2,

    PREFIX = 3,

    }

}

export class DeleteResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteResponse): DeleteResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteResponse;
    static deserializeBinaryFromReader(message: DeleteResponse, reader: jspb.BinaryReader): DeleteResponse;
}

export namespace DeleteResponse {
    export type AsObject = {
    }
}
