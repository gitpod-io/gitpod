/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: aggregator
// file: aggregator.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class StartSessionRequest extends jspb.Message {
    getPersist(): boolean;
    setPersist(value: boolean): StartSessionRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StartSessionRequest.AsObject;
    static toObject(includeInstance: boolean, msg: StartSessionRequest): StartSessionRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StartSessionRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StartSessionRequest;
    static deserializeBinaryFromReader(message: StartSessionRequest, reader: jspb.BinaryReader): StartSessionRequest;
}

export namespace StartSessionRequest {
    export type AsObject = {
        persist: boolean,
    }
}

export class StartSessionResponse extends jspb.Message {
    getId(): string;
    setId(value: string): StartSessionResponse;
    getIngesterUrl(): string;
    setIngesterUrl(value: string): StartSessionResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): StartSessionResponse.AsObject;
    static toObject(includeInstance: boolean, msg: StartSessionResponse): StartSessionResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: StartSessionResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): StartSessionResponse;
    static deserializeBinaryFromReader(message: StartSessionResponse, reader: jspb.BinaryReader): StartSessionResponse;
}

export namespace StartSessionResponse {
    export type AsObject = {
        id: string,
        ingesterUrl: string,
    }
}

export class CloseSessionRequest extends jspb.Message {
    getId(): string;
    setId(value: string): CloseSessionRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CloseSessionRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CloseSessionRequest): CloseSessionRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CloseSessionRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CloseSessionRequest;
    static deserializeBinaryFromReader(message: CloseSessionRequest, reader: jspb.BinaryReader): CloseSessionRequest;
}

export namespace CloseSessionRequest {
    export type AsObject = {
        id: string,
    }
}

export class CloseSessionResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CloseSessionResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CloseSessionResponse): CloseSessionResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CloseSessionResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CloseSessionResponse;
    static deserializeBinaryFromReader(message: CloseSessionResponse, reader: jspb.BinaryReader): CloseSessionResponse;
}

export namespace CloseSessionResponse {
    export type AsObject = {
    }
}

export class DescribeRequest extends jspb.Message {
    getId(): string;
    setId(value: string): DescribeRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DescribeRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DescribeRequest): DescribeRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DescribeRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DescribeRequest;
    static deserializeBinaryFromReader(message: DescribeRequest, reader: jspb.BinaryReader): DescribeRequest;
}

export namespace DescribeRequest {
    export type AsObject = {
        id: string,
    }
}

export class DescribeResponse extends jspb.Message {
    getId(): string;
    setId(value: string): DescribeResponse;
    getIngesterUrl(): string;
    setIngesterUrl(value: string): DescribeResponse;
    getPersisted(): boolean;
    setPersisted(value: boolean): DescribeResponse;
    clearStreamsList(): void;
    getStreamsList(): Array<Stream>;
    setStreamsList(value: Array<Stream>): DescribeResponse;
    addStreams(value?: Stream, index?: number): Stream;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DescribeResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DescribeResponse): DescribeResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DescribeResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DescribeResponse;
    static deserializeBinaryFromReader(message: DescribeResponse, reader: jspb.BinaryReader): DescribeResponse;
}

export namespace DescribeResponse {
    export type AsObject = {
        id: string,
        ingesterUrl: string,
        persisted: boolean,
        streamsList: Array<Stream.AsObject>,
    }
}

export class ConsumeRequest extends jspb.Message {
    getSession(): string;
    setSession(value: string): ConsumeRequest;
    getStream(): string;
    setStream(value: string): ConsumeRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ConsumeRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ConsumeRequest): ConsumeRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ConsumeRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ConsumeRequest;
    static deserializeBinaryFromReader(message: ConsumeRequest, reader: jspb.BinaryReader): ConsumeRequest;
}

export namespace ConsumeRequest {
    export type AsObject = {
        session: string,
        stream: string,
    }
}

export class ConsumeResponse extends jspb.Message {
    getData(): Uint8Array | string;
    getData_asU8(): Uint8Array;
    getData_asB64(): string;
    setData(value: Uint8Array | string): ConsumeResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ConsumeResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ConsumeResponse): ConsumeResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ConsumeResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ConsumeResponse;
    static deserializeBinaryFromReader(message: ConsumeResponse, reader: jspb.BinaryReader): ConsumeResponse;
}

export namespace ConsumeResponse {
    export type AsObject = {
        data: Uint8Array | string,
    }
}

export class Stream extends jspb.Message {
    getId(): string;
    setId(value: string): Stream;
    getIngesterUrl(): string;
    setIngesterUrl(value: string): Stream;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Stream.AsObject;
    static toObject(includeInstance: boolean, msg: Stream): Stream.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Stream, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Stream;
    static deserializeBinaryFromReader(message: Stream, reader: jspb.BinaryReader): Stream;
}

export namespace Stream {
    export type AsObject = {
        id: string,
        ingesterUrl: string,
    }
}

export class IngestRequest extends jspb.Message {
    getSession(): string;
    setSession(value: string): IngestRequest;
    getStream(): string;
    setStream(value: string): IngestRequest;
    getContent(): Uint8Array | string;
    getContent_asU8(): Uint8Array;
    getContent_asB64(): string;
    setContent(value: Uint8Array | string): IngestRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IngestRequest.AsObject;
    static toObject(includeInstance: boolean, msg: IngestRequest): IngestRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IngestRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IngestRequest;
    static deserializeBinaryFromReader(message: IngestRequest, reader: jspb.BinaryReader): IngestRequest;
}

export namespace IngestRequest {
    export type AsObject = {
        session: string,
        stream: string,
        content: Uint8Array | string,
    }
}

export class IngestResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IngestResponse.AsObject;
    static toObject(includeInstance: boolean, msg: IngestResponse): IngestResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: IngestResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): IngestResponse;
    static deserializeBinaryFromReader(message: IngestResponse, reader: jspb.BinaryReader): IngestResponse;
}

export namespace IngestResponse {
    export type AsObject = {
    }
}
