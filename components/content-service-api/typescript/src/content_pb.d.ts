/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: content.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class DeleteUserContentRequest extends jspb.Message {
    getOwnerId(): string;
    setOwnerId(value: string): DeleteUserContentRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteUserContentRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteUserContentRequest): DeleteUserContentRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteUserContentRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteUserContentRequest;
    static deserializeBinaryFromReader(message: DeleteUserContentRequest, reader: jspb.BinaryReader): DeleteUserContentRequest;
}

export namespace DeleteUserContentRequest {
    export type AsObject = {
        ownerId: string,
    }
}

export class DeleteUserContentResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeleteUserContentResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DeleteUserContentResponse): DeleteUserContentResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeleteUserContentResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeleteUserContentResponse;
    static deserializeBinaryFromReader(message: DeleteUserContentResponse, reader: jspb.BinaryReader): DeleteUserContentResponse;
}

export namespace DeleteUserContentResponse {
    export type AsObject = {
    }
}
