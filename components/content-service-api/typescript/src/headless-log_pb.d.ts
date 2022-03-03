/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: headless-log.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from 'google-protobuf';

export class LogDownloadURLRequest extends jspb.Message {
    getOwnerId(): string;
    setOwnerId(value: string): LogDownloadURLRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): LogDownloadURLRequest;
    getInstanceId(): string;
    setInstanceId(value: string): LogDownloadURLRequest;
    getTaskId(): string;
    setTaskId(value: string): LogDownloadURLRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): LogDownloadURLRequest.AsObject;
    static toObject(includeInstance: boolean, msg: LogDownloadURLRequest): LogDownloadURLRequest.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: LogDownloadURLRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): LogDownloadURLRequest;
    static deserializeBinaryFromReader(
        message: LogDownloadURLRequest,
        reader: jspb.BinaryReader,
    ): LogDownloadURLRequest;
}

export namespace LogDownloadURLRequest {
    export type AsObject = {
        ownerId: string;
        workspaceId: string;
        instanceId: string;
        taskId: string;
    };
}

export class LogDownloadURLResponse extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): LogDownloadURLResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): LogDownloadURLResponse.AsObject;
    static toObject(includeInstance: boolean, msg: LogDownloadURLResponse): LogDownloadURLResponse.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: LogDownloadURLResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): LogDownloadURLResponse;
    static deserializeBinaryFromReader(
        message: LogDownloadURLResponse,
        reader: jspb.BinaryReader,
    ): LogDownloadURLResponse;
}

export namespace LogDownloadURLResponse {
    export type AsObject = {
        url: string;
    };
}

export class ListLogsRequest extends jspb.Message {
    getOwnerId(): string;
    setOwnerId(value: string): ListLogsRequest;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): ListLogsRequest;
    getInstanceId(): string;
    setInstanceId(value: string): ListLogsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListLogsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListLogsRequest): ListLogsRequest.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: ListLogsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListLogsRequest;
    static deserializeBinaryFromReader(message: ListLogsRequest, reader: jspb.BinaryReader): ListLogsRequest;
}

export namespace ListLogsRequest {
    export type AsObject = {
        ownerId: string;
        workspaceId: string;
        instanceId: string;
    };
}

export class ListLogsResponse extends jspb.Message {
    clearTaskIdList(): void;
    getTaskIdList(): Array<string>;
    setTaskIdList(value: Array<string>): ListLogsResponse;
    addTaskId(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListLogsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListLogsResponse): ListLogsResponse.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: ListLogsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListLogsResponse;
    static deserializeBinaryFromReader(message: ListLogsResponse, reader: jspb.BinaryReader): ListLogsResponse;
}

export namespace ListLogsResponse {
    export type AsObject = {
        taskIdList: Array<string>;
    };
}
