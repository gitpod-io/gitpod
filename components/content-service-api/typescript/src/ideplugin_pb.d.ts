/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: ideplugin
// file: ideplugin.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class PluginUploadURLRequest extends jspb.Message {
    getBucket(): string;
    setBucket(value: string): PluginUploadURLRequest;
    getName(): string;
    setName(value: string): PluginUploadURLRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PluginUploadURLRequest.AsObject;
    static toObject(includeInstance: boolean, msg: PluginUploadURLRequest): PluginUploadURLRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PluginUploadURLRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PluginUploadURLRequest;
    static deserializeBinaryFromReader(message: PluginUploadURLRequest, reader: jspb.BinaryReader): PluginUploadURLRequest;
}

export namespace PluginUploadURLRequest {
    export type AsObject = {
        bucket: string,
        name: string,
    }
}

export class PluginUploadURLResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): PluginUploadURLResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PluginUploadURLResponse.AsObject;
    static toObject(includeInstance: boolean, msg: PluginUploadURLResponse): PluginUploadURLResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PluginUploadURLResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PluginUploadURLResponse;
    static deserializeBinaryFromReader(message: PluginUploadURLResponse, reader: jspb.BinaryReader): PluginUploadURLResponse;
}

export namespace PluginUploadURLResponse {
    export type AsObject = {
        url: string,
    }
}

export class PluginDownloadURLRequest extends jspb.Message {
    getBucket(): string;
    setBucket(value: string): PluginDownloadURLRequest;
    getName(): string;
    setName(value: string): PluginDownloadURLRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PluginDownloadURLRequest.AsObject;
    static toObject(includeInstance: boolean, msg: PluginDownloadURLRequest): PluginDownloadURLRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PluginDownloadURLRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PluginDownloadURLRequest;
    static deserializeBinaryFromReader(message: PluginDownloadURLRequest, reader: jspb.BinaryReader): PluginDownloadURLRequest;
}

export namespace PluginDownloadURLRequest {
    export type AsObject = {
        bucket: string,
        name: string,
    }
}

export class PluginDownloadURLResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): PluginDownloadURLResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PluginDownloadURLResponse.AsObject;
    static toObject(includeInstance: boolean, msg: PluginDownloadURLResponse): PluginDownloadURLResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PluginDownloadURLResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PluginDownloadURLResponse;
    static deserializeBinaryFromReader(message: PluginDownloadURLResponse, reader: jspb.BinaryReader): PluginDownloadURLResponse;
}

export namespace PluginDownloadURLResponse {
    export type AsObject = {
        url: string,
    }
}

export class PluginHashRequest extends jspb.Message {
    getBucket(): string;
    setBucket(value: string): PluginHashRequest;
    getName(): string;
    setName(value: string): PluginHashRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PluginHashRequest.AsObject;
    static toObject(includeInstance: boolean, msg: PluginHashRequest): PluginHashRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PluginHashRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PluginHashRequest;
    static deserializeBinaryFromReader(message: PluginHashRequest, reader: jspb.BinaryReader): PluginHashRequest;
}

export namespace PluginHashRequest {
    export type AsObject = {
        bucket: string,
        name: string,
    }
}

export class PluginHashResponse extends jspb.Message {
    getHash(): string;
    setHash(value: string): PluginHashResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PluginHashResponse.AsObject;
    static toObject(includeInstance: boolean, msg: PluginHashResponse): PluginHashResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PluginHashResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PluginHashResponse;
    static deserializeBinaryFromReader(message: PluginHashResponse, reader: jspb.BinaryReader): PluginHashResponse;
}

export namespace PluginHashResponse {
    export type AsObject = {
        hash: string,
    }
}
