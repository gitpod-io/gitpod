/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: usage.v1
// file: usage/v1/billing.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";
import * as usage_v1_usage_pb from "../../usage/v1/usage_pb";

export class UpdateInvoicesRequest extends jspb.Message {

    hasStartTime(): boolean;
    clearStartTime(): void;
    getStartTime(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setStartTime(value?: google_protobuf_timestamp_pb.Timestamp): UpdateInvoicesRequest;

    hasEndTime(): boolean;
    clearEndTime(): void;
    getEndTime(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setEndTime(value?: google_protobuf_timestamp_pb.Timestamp): UpdateInvoicesRequest;
    clearSessionsList(): void;
    getSessionsList(): Array<usage_v1_usage_pb.BilledSession>;
    setSessionsList(value: Array<usage_v1_usage_pb.BilledSession>): UpdateInvoicesRequest;
    addSessions(value?: usage_v1_usage_pb.BilledSession, index?: number): usage_v1_usage_pb.BilledSession;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateInvoicesRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateInvoicesRequest): UpdateInvoicesRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UpdateInvoicesRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateInvoicesRequest;
    static deserializeBinaryFromReader(message: UpdateInvoicesRequest, reader: jspb.BinaryReader): UpdateInvoicesRequest;
}

export namespace UpdateInvoicesRequest {
    export type AsObject = {
        startTime?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        endTime?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        sessionsList: Array<usage_v1_usage_pb.BilledSession.AsObject>,
    }
}

export class UpdateInvoicesResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateInvoicesResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateInvoicesResponse): UpdateInvoicesResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UpdateInvoicesResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateInvoicesResponse;
    static deserializeBinaryFromReader(message: UpdateInvoicesResponse, reader: jspb.BinaryReader): UpdateInvoicesResponse;
}

export namespace UpdateInvoicesResponse {
    export type AsObject = {
    }
}
