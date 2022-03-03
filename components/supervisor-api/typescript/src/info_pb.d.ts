/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: supervisor
// file: info.proto

/* tslint:disable */

import * as jspb from 'google-protobuf';

export class WorkspaceInfoRequest extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInfoRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInfoRequest): WorkspaceInfoRequest.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: WorkspaceInfoRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInfoRequest;
    static deserializeBinaryFromReader(message: WorkspaceInfoRequest, reader: jspb.BinaryReader): WorkspaceInfoRequest;
}

export namespace WorkspaceInfoRequest {
    export type AsObject = {};
}

export class WorkspaceInfoResponse extends jspb.Message {
    getWorkspaceId(): string;
    setWorkspaceId(value: string): void;

    getInstanceId(): string;
    setInstanceId(value: string): void;

    getCheckoutLocation(): string;
    setCheckoutLocation(value: string): void;

    hasWorkspaceLocationFile(): boolean;
    clearWorkspaceLocationFile(): void;
    getWorkspaceLocationFile(): string;
    setWorkspaceLocationFile(value: string): void;

    hasWorkspaceLocationFolder(): boolean;
    clearWorkspaceLocationFolder(): void;
    getWorkspaceLocationFolder(): string;
    setWorkspaceLocationFolder(value: string): void;

    getUserHome(): string;
    setUserHome(value: string): void;

    getWorkspaceLocationCase(): WorkspaceInfoResponse.WorkspaceLocationCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInfoResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInfoResponse): WorkspaceInfoResponse.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: WorkspaceInfoResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInfoResponse;
    static deserializeBinaryFromReader(
        message: WorkspaceInfoResponse,
        reader: jspb.BinaryReader,
    ): WorkspaceInfoResponse;
}

export namespace WorkspaceInfoResponse {
    export type AsObject = {
        workspaceId: string;
        instanceId: string;
        checkoutLocation: string;
        workspaceLocationFile: string;
        workspaceLocationFolder: string;
        userHome: string;
    };

    export enum WorkspaceLocationCase {
        WORKSPACELOCATION_NOT_SET = 0,

        WORKSPACE_LOCATION_FILE = 4,

        WORKSPACE_LOCATION_FOLDER = 5,
    }
}
