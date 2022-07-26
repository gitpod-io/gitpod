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

export class ListBilledUsageRequest extends jspb.Message {
    getAttributionId(): string;
    setAttributionId(value: string): ListBilledUsageRequest;

    hasFrom(): boolean;
    clearFrom(): void;
    getFrom(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setFrom(value?: google_protobuf_timestamp_pb.Timestamp): ListBilledUsageRequest;

    hasTo(): boolean;
    clearTo(): void;
    getTo(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setTo(value?: google_protobuf_timestamp_pb.Timestamp): ListBilledUsageRequest;
    getOrder(): ListBilledUsageRequest.Ordering;
    setOrder(value: ListBilledUsageRequest.Ordering): ListBilledUsageRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListBilledUsageRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListBilledUsageRequest): ListBilledUsageRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListBilledUsageRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListBilledUsageRequest;
    static deserializeBinaryFromReader(message: ListBilledUsageRequest, reader: jspb.BinaryReader): ListBilledUsageRequest;
}

export namespace ListBilledUsageRequest {
    export type AsObject = {
        attributionId: string,
        from?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        to?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        order: ListBilledUsageRequest.Ordering,
    }

    export enum Ordering {
    ORDERING_DESCENDING = 0,
    ORDERING_ASCENDING = 1,
    }

}

export class ListBilledUsageResponse extends jspb.Message {
    clearSessionsList(): void;
    getSessionsList(): Array<BilledSession>;
    setSessionsList(value: Array<BilledSession>): ListBilledUsageResponse;
    addSessions(value?: BilledSession, index?: number): BilledSession;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListBilledUsageResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListBilledUsageResponse): ListBilledUsageResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListBilledUsageResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListBilledUsageResponse;
    static deserializeBinaryFromReader(message: ListBilledUsageResponse, reader: jspb.BinaryReader): ListBilledUsageResponse;
}

export namespace ListBilledUsageResponse {
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
    getCreditsDeprecated(): number;
    setCreditsDeprecated(value: number): BilledSession;
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
        creditsDeprecated: number,
        credits: number,
    }
}
