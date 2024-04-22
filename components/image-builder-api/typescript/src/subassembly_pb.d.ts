/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// package: builder
// file: subassembly.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class CreateSubassemblyRequest extends jspb.Message {
    getOciReference(): string;
    setOciReference(value: string): CreateSubassemblyRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CreateSubassemblyRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CreateSubassemblyRequest): CreateSubassemblyRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CreateSubassemblyRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CreateSubassemblyRequest;
    static deserializeBinaryFromReader(message: CreateSubassemblyRequest, reader: jspb.BinaryReader): CreateSubassemblyRequest;
}

export namespace CreateSubassemblyRequest {
    export type AsObject = {
        ociReference: string,
    }
}

export class CreateSubassemblyResponse extends jspb.Message {

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): SubassemblyStatus | undefined;
    setStatus(value?: SubassemblyStatus): CreateSubassemblyResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CreateSubassemblyResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CreateSubassemblyResponse): CreateSubassemblyResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CreateSubassemblyResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CreateSubassemblyResponse;
    static deserializeBinaryFromReader(message: CreateSubassemblyResponse, reader: jspb.BinaryReader): CreateSubassemblyResponse;
}

export namespace CreateSubassemblyResponse {
    export type AsObject = {
        status?: SubassemblyStatus.AsObject,
    }
}

export class GetSubassemblyRequest extends jspb.Message {
    getOciReference(): string;
    setOciReference(value: string): GetSubassemblyRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSubassemblyRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetSubassemblyRequest): GetSubassemblyRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSubassemblyRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSubassemblyRequest;
    static deserializeBinaryFromReader(message: GetSubassemblyRequest, reader: jspb.BinaryReader): GetSubassemblyRequest;
}

export namespace GetSubassemblyRequest {
    export type AsObject = {
        ociReference: string,
    }
}

export class GetSubassemblyResponse extends jspb.Message {

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): SubassemblyStatus | undefined;
    setStatus(value?: SubassemblyStatus): GetSubassemblyResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSubassemblyResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetSubassemblyResponse): GetSubassemblyResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSubassemblyResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSubassemblyResponse;
    static deserializeBinaryFromReader(message: GetSubassemblyResponse, reader: jspb.BinaryReader): GetSubassemblyResponse;
}

export namespace GetSubassemblyResponse {
    export type AsObject = {
        status?: SubassemblyStatus.AsObject,
    }
}

export class SubassemblyStatus extends jspb.Message {
    getPhase(): SubassemblyPhase;
    setPhase(value: SubassemblyPhase): SubassemblyStatus;
    getMessage(): string;
    setMessage(value: string): SubassemblyStatus;
    getDigest(): string;
    setDigest(value: string): SubassemblyStatus;
    getUrl(): string;
    setUrl(value: string): SubassemblyStatus;
    getManifest(): Uint8Array | string;
    getManifest_asU8(): Uint8Array;
    getManifest_asB64(): string;
    setManifest(value: Uint8Array | string): SubassemblyStatus;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SubassemblyStatus.AsObject;
    static toObject(includeInstance: boolean, msg: SubassemblyStatus): SubassemblyStatus.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SubassemblyStatus, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SubassemblyStatus;
    static deserializeBinaryFromReader(message: SubassemblyStatus, reader: jspb.BinaryReader): SubassemblyStatus;
}

export namespace SubassemblyStatus {
    export type AsObject = {
        phase: SubassemblyPhase,
        message: string,
        digest: string,
        url: string,
        manifest: Uint8Array | string,
    }
}

export enum SubassemblyPhase {
    SUBASSEMBLY_PHASE_UNSPECIFIED = 0,
    SUBASSEMBLY_PHASE_CREATING = 1,
    SUBASSEMBLY_PHASE_AVAILABLE = 2,
    SUBASSEMBLY_PHASE_UNAVAILABLE = 3,
}
