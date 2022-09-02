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

export class ReconcileUsageWithLedgerRequest extends jspb.Message {

    hasFrom(): boolean;
    clearFrom(): void;
    getFrom(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setFrom(value?: google_protobuf_timestamp_pb.Timestamp): ReconcileUsageWithLedgerRequest;

    hasTo(): boolean;
    clearTo(): void;
    getTo(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setTo(value?: google_protobuf_timestamp_pb.Timestamp): ReconcileUsageWithLedgerRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ReconcileUsageWithLedgerRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ReconcileUsageWithLedgerRequest): ReconcileUsageWithLedgerRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ReconcileUsageWithLedgerRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ReconcileUsageWithLedgerRequest;
    static deserializeBinaryFromReader(message: ReconcileUsageWithLedgerRequest, reader: jspb.BinaryReader): ReconcileUsageWithLedgerRequest;
}

export namespace ReconcileUsageWithLedgerRequest {
    export type AsObject = {
        from?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        to?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    }
}

export class ReconcileUsageWithLedgerResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ReconcileUsageWithLedgerResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ReconcileUsageWithLedgerResponse): ReconcileUsageWithLedgerResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ReconcileUsageWithLedgerResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ReconcileUsageWithLedgerResponse;
    static deserializeBinaryFromReader(message: ReconcileUsageWithLedgerResponse, reader: jspb.BinaryReader): ReconcileUsageWithLedgerResponse;
}

export namespace ReconcileUsageWithLedgerResponse {
    export type AsObject = {
    }
}

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

    hasPagination(): boolean;
    clearPagination(): void;
    getPagination(): PaginatedRequest | undefined;
    setPagination(value?: PaginatedRequest): ListBilledUsageRequest;

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
        pagination?: PaginatedRequest.AsObject,
    }

    export enum Ordering {
    ORDERING_DESCENDING = 0,
    ORDERING_ASCENDING = 1,
    }

}

export class PaginatedRequest extends jspb.Message {
    getPerPage(): number;
    setPerPage(value: number): PaginatedRequest;
    getPage(): number;
    setPage(value: number): PaginatedRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PaginatedRequest.AsObject;
    static toObject(includeInstance: boolean, msg: PaginatedRequest): PaginatedRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PaginatedRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PaginatedRequest;
    static deserializeBinaryFromReader(message: PaginatedRequest, reader: jspb.BinaryReader): PaginatedRequest;
}

export namespace PaginatedRequest {
    export type AsObject = {
        perPage: number,
        page: number,
    }
}

export class ListBilledUsageResponse extends jspb.Message {
    clearSessionsList(): void;
    getSessionsList(): Array<BilledSession>;
    setSessionsList(value: Array<BilledSession>): ListBilledUsageResponse;
    addSessions(value?: BilledSession, index?: number): BilledSession;
    getTotalCreditsUsed(): number;
    setTotalCreditsUsed(value: number): ListBilledUsageResponse;

    hasPagination(): boolean;
    clearPagination(): void;
    getPagination(): PaginatedResponse | undefined;
    setPagination(value?: PaginatedResponse): ListBilledUsageResponse;

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
        totalCreditsUsed: number,
        pagination?: PaginatedResponse.AsObject,
    }
}

export class PaginatedResponse extends jspb.Message {
    getPerPage(): number;
    setPerPage(value: number): PaginatedResponse;
    getTotalPages(): number;
    setTotalPages(value: number): PaginatedResponse;
    getTotal(): number;
    setTotal(value: number): PaginatedResponse;
    getPage(): number;
    setPage(value: number): PaginatedResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PaginatedResponse.AsObject;
    static toObject(includeInstance: boolean, msg: PaginatedResponse): PaginatedResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PaginatedResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PaginatedResponse;
    static deserializeBinaryFromReader(message: PaginatedResponse, reader: jspb.BinaryReader): PaginatedResponse;
}

export namespace PaginatedResponse {
    export type AsObject = {
        perPage: number,
        totalPages: number,
        total: number,
        page: number,
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

export class ReconcileUsageRequest extends jspb.Message {

    hasStartTime(): boolean;
    clearStartTime(): void;
    getStartTime(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setStartTime(value?: google_protobuf_timestamp_pb.Timestamp): ReconcileUsageRequest;

    hasEndTime(): boolean;
    clearEndTime(): void;
    getEndTime(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setEndTime(value?: google_protobuf_timestamp_pb.Timestamp): ReconcileUsageRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ReconcileUsageRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ReconcileUsageRequest): ReconcileUsageRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ReconcileUsageRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ReconcileUsageRequest;
    static deserializeBinaryFromReader(message: ReconcileUsageRequest, reader: jspb.BinaryReader): ReconcileUsageRequest;
}

export namespace ReconcileUsageRequest {
    export type AsObject = {
        startTime?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        endTime?: google_protobuf_timestamp_pb.Timestamp.AsObject,
    }
}

export class ReconcileUsageResponse extends jspb.Message {
    clearSessionsList(): void;
    getSessionsList(): Array<BilledSession>;
    setSessionsList(value: Array<BilledSession>): ReconcileUsageResponse;
    addSessions(value?: BilledSession, index?: number): BilledSession;
    getReportId(): string;
    setReportId(value: string): ReconcileUsageResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ReconcileUsageResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ReconcileUsageResponse): ReconcileUsageResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ReconcileUsageResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ReconcileUsageResponse;
    static deserializeBinaryFromReader(message: ReconcileUsageResponse, reader: jspb.BinaryReader): ReconcileUsageResponse;
}

export namespace ReconcileUsageResponse {
    export type AsObject = {
        sessionsList: Array<BilledSession.AsObject>,
        reportId: string,
    }
}

export class GetCostCenterRequest extends jspb.Message {
    getAttributionId(): string;
    setAttributionId(value: string): GetCostCenterRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCostCenterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetCostCenterRequest): GetCostCenterRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCostCenterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCostCenterRequest;
    static deserializeBinaryFromReader(message: GetCostCenterRequest, reader: jspb.BinaryReader): GetCostCenterRequest;
}

export namespace GetCostCenterRequest {
    export type AsObject = {
        attributionId: string,
    }
}

export class GetCostCenterResponse extends jspb.Message {

    hasCostCenter(): boolean;
    clearCostCenter(): void;
    getCostCenter(): CostCenter | undefined;
    setCostCenter(value?: CostCenter): GetCostCenterResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCostCenterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetCostCenterResponse): GetCostCenterResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCostCenterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCostCenterResponse;
    static deserializeBinaryFromReader(message: GetCostCenterResponse, reader: jspb.BinaryReader): GetCostCenterResponse;
}

export namespace GetCostCenterResponse {
    export type AsObject = {
        costCenter?: CostCenter.AsObject,
    }
}

export class CostCenter extends jspb.Message {
    getAttributionId(): string;
    setAttributionId(value: string): CostCenter;
    getSpendingLimit(): number;
    setSpendingLimit(value: number): CostCenter;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CostCenter.AsObject;
    static toObject(includeInstance: boolean, msg: CostCenter): CostCenter.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CostCenter, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CostCenter;
    static deserializeBinaryFromReader(message: CostCenter, reader: jspb.BinaryReader): CostCenter;
}

export namespace CostCenter {
    export type AsObject = {
        attributionId: string,
        spendingLimit: number,
    }
}
