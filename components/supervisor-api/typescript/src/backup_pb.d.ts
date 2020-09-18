/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: supervisor
// file: backup.proto

/* tslint:disable */

import * as jspb from "google-protobuf";

export class PrepareBackupRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrepareBackupRequest.AsObject;
    static toObject(includeInstance: boolean, msg: PrepareBackupRequest): PrepareBackupRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrepareBackupRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrepareBackupRequest;
    static deserializeBinaryFromReader(message: PrepareBackupRequest, reader: jspb.BinaryReader): PrepareBackupRequest;
}

export namespace PrepareBackupRequest {
    export type AsObject = {
    }
}

export class PrepareBackupResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrepareBackupResponse.AsObject;
    static toObject(includeInstance: boolean, msg: PrepareBackupResponse): PrepareBackupResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrepareBackupResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrepareBackupResponse;
    static deserializeBinaryFromReader(message: PrepareBackupResponse, reader: jspb.BinaryReader): PrepareBackupResponse;
}

export namespace PrepareBackupResponse {
    export type AsObject = {
    }
}
