/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: usage.v1
// file: usage/v1/usage.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";

export class GetBilledUsageRequest extends jspb.Message {
    getAttributionId(): string;
    setAttributionId(value: string): GetBilledUsageRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetBilledUsageRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetBilledUsageRequest): GetBilledUsageRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetBilledUsageRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetBilledUsageRequest;
    static deserializeBinaryFromReader(message: GetBilledUsageRequest, reader: jspb.BinaryReader): GetBilledUsageRequest;
}

export namespace GetBilledUsageRequest {
    export type AsObject = {
        attributionId: string,
    }
}

export class GetBilledUsageResponse extends jspb.Message {
    clearSessionsList(): void;
    getSessionsList(): Array<BilledSession>;
    setSessionsList(value: Array<BilledSession>): GetBilledUsageResponse;
    addSessions(value?: BilledSession, index?: number): BilledSession;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetBilledUsageResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetBilledUsageResponse): GetBilledUsageResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetBilledUsageResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetBilledUsageResponse;
    static deserializeBinaryFromReader(message: GetBilledUsageResponse, reader: jspb.BinaryReader): GetBilledUsageResponse;
}

export namespace GetBilledUsageResponse {
    export type AsObject = {
        sessionsList: Array<BilledSession.AsObject>,
    }
}

export class BilledSession extends jspb.Message {
    getAttributionId(): string;
    setAttributionId(value: string): BilledSession;
    getUserId(): string;
    setUserId(value: string): BilledSession;
    getTeamId(): string;
    setTeamId(value: string): BilledSession;
    getWorkspaceId(): string;
    setWorkspaceId(value: string): BilledSession;
    getWorkspaceType(): string;
    setWorkspaceType(value: string): BilledSession;
    getProjectId(): string;
    setProjectId(value: string): BilledSession;
    getInstanceId(): string;
    setInstanceId(value: string): BilledSession;
    getWorkspaceClass(): string;
    setWorkspaceClass(value: string): BilledSession;

    hasStartTime(): boolean;
    clearStartTime(): void;
    getStartTime(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setStartTime(value?: google_protobuf_timestamp_pb.Timestamp): BilledSession;

    hasEndTime(): boolean;
    clearEndTime(): void;
    getEndTime(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setEndTime(value?: google_protobuf_timestamp_pb.Timestamp): BilledSession;
    getCredits(): number;
    setCredits(value: number): BilledSession;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BilledSession.AsObject;
    static toObject(includeInstance: boolean, msg: BilledSession): BilledSession.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BilledSession, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BilledSession;
    static deserializeBinaryFromReader(message: BilledSession, reader: jspb.BinaryReader): BilledSession;
}

export namespace BilledSession {
    export type AsObject = {
        attributionId: string,
        userId: string,
        teamId: string,
        workspaceId: string,
        workspaceType: string,
        projectId: string,
        instanceId: string,
        workspaceClass: string,
        startTime?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        endTime?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        credits: number,
    }
}
