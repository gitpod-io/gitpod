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

export class ListUsageRequest extends jspb.Message {
    getAttributionId(): string;
    setAttributionId(value: string): ListUsageRequest;

    hasFrom(): boolean;
    clearFrom(): void;
    getFrom(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setFrom(value?: google_protobuf_timestamp_pb.Timestamp): ListUsageRequest;

    hasTo(): boolean;
    clearTo(): void;
    getTo(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setTo(value?: google_protobuf_timestamp_pb.Timestamp): ListUsageRequest;
    getOrder(): ListUsageRequest.Ordering;
    setOrder(value: ListUsageRequest.Ordering): ListUsageRequest;

    hasPagination(): boolean;
    clearPagination(): void;
    getPagination(): PaginatedRequest | undefined;
    setPagination(value?: PaginatedRequest): ListUsageRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListUsageRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListUsageRequest): ListUsageRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListUsageRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListUsageRequest;
    static deserializeBinaryFromReader(message: ListUsageRequest, reader: jspb.BinaryReader): ListUsageRequest;
}

export namespace ListUsageRequest {
    export type AsObject = {
        attributionId: string,
        from?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        to?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        order: ListUsageRequest.Ordering,
        pagination?: PaginatedRequest.AsObject,
    }

    export enum Ordering {
    ORDERING_DESCENDING = 0,
    ORDERING_ASCENDING = 1,
    }

}

export class ListUsageResponse extends jspb.Message {
    clearUsageEntriesList(): void;
    getUsageEntriesList(): Array<Usage>;
    setUsageEntriesList(value: Array<Usage>): ListUsageResponse;
    addUsageEntries(value?: Usage, index?: number): Usage;

    hasPagination(): boolean;
    clearPagination(): void;
    getPagination(): PaginatedResponse | undefined;
    setPagination(value?: PaginatedResponse): ListUsageResponse;
    getCreditBalanceAtStart(): number;
    setCreditBalanceAtStart(value: number): ListUsageResponse;
    getCreditBalanceAtEnd(): number;
    setCreditBalanceAtEnd(value: number): ListUsageResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListUsageResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListUsageResponse): ListUsageResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListUsageResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListUsageResponse;
    static deserializeBinaryFromReader(message: ListUsageResponse, reader: jspb.BinaryReader): ListUsageResponse;
}

export namespace ListUsageResponse {
    export type AsObject = {
        usageEntriesList: Array<Usage.AsObject>,
        pagination?: PaginatedResponse.AsObject,
        creditBalanceAtStart: number,
        creditBalanceAtEnd: number,
    }
}

export class Usage extends jspb.Message {
    getId(): string;
    setId(value: string): Usage;
    getAttributionId(): string;
    setAttributionId(value: string): Usage;
    getDescription(): string;
    setDescription(value: string): Usage;
    getCredits(): number;
    setCredits(value: number): Usage;

    hasEffectiveTime(): boolean;
    clearEffectiveTime(): void;
    getEffectiveTime(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setEffectiveTime(value?: google_protobuf_timestamp_pb.Timestamp): Usage;
    getKind(): Usage.Kind;
    setKind(value: Usage.Kind): Usage;
    getWorkspaceInstanceId(): string;
    setWorkspaceInstanceId(value: string): Usage;
    getDraft(): boolean;
    setDraft(value: boolean): Usage;
    getMetadata(): string;
    setMetadata(value: string): Usage;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Usage.AsObject;
    static toObject(includeInstance: boolean, msg: Usage): Usage.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Usage, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Usage;
    static deserializeBinaryFromReader(message: Usage, reader: jspb.BinaryReader): Usage;
}

export namespace Usage {
    export type AsObject = {
        id: string,
        attributionId: string,
        description: string,
        credits: number,
        effectiveTime?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        kind: Usage.Kind,
        workspaceInstanceId: string,
        draft: boolean,
        metadata: string,
    }

    export enum Kind {
    KIND_WORKSPACE_INSTANCE = 0,
    KIND_INVOICE = 1,
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
