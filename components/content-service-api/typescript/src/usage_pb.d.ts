/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: usage.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class UsageReportUploadURLRequest extends jspb.Message {
    getBucket(): string;
    setBucket(value: string): UsageReportUploadURLRequest;
    getName(): string;
    setName(value: string): UsageReportUploadURLRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UsageReportUploadURLRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UsageReportUploadURLRequest): UsageReportUploadURLRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UsageReportUploadURLRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UsageReportUploadURLRequest;
    static deserializeBinaryFromReader(message: UsageReportUploadURLRequest, reader: jspb.BinaryReader): UsageReportUploadURLRequest;
}

export namespace UsageReportUploadURLRequest {
    export type AsObject = {
        bucket: string,
        name: string,
    }
}

export class UsageReportUploadURLResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): UsageReportUploadURLResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UsageReportUploadURLResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UsageReportUploadURLResponse): UsageReportUploadURLResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UsageReportUploadURLResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UsageReportUploadURLResponse;
    static deserializeBinaryFromReader(message: UsageReportUploadURLResponse, reader: jspb.BinaryReader): UsageReportUploadURLResponse;
}

export namespace UsageReportUploadURLResponse {
    export type AsObject = {
        url: string,
    }
}
