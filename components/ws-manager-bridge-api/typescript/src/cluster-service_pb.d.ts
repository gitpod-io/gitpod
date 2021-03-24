/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: workspacemanagerbridge
// file: cluster-service.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class RegisterRequest extends jspb.Message { 
    getName(): string;
    setName(value: string): RegisterRequest;

    getUrl(): string;
    setUrl(value: string): RegisterRequest;

    getCert(): Uint8Array | string;
    getCert_asU8(): Uint8Array;
    getCert_asB64(): string;
    setCert(value: Uint8Array | string): RegisterRequest;

    getToken(): string;
    setToken(value: string): RegisterRequest;


    hasHints(): boolean;
    clearHints(): void;
    getHints(): RegistrationHints | undefined;
    setHints(value?: RegistrationHints): RegisterRequest;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RegisterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: RegisterRequest): RegisterRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: RegisterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegisterRequest;
    static deserializeBinaryFromReader(message: RegisterRequest, reader: jspb.BinaryReader): RegisterRequest;
}

export namespace RegisterRequest {
    export type AsObject = {
        name: string,
        url: string,
        cert: Uint8Array | string,
        token: string,
        hints?: RegistrationHints.AsObject,
    }
}

export class RegisterResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RegisterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: RegisterResponse): RegisterResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: RegisterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegisterResponse;
    static deserializeBinaryFromReader(message: RegisterResponse, reader: jspb.BinaryReader): RegisterResponse;
}

export namespace RegisterResponse {
    export type AsObject = {
    }
}

export class RegistrationHints extends jspb.Message { 
    getPerfereability(): Preferability;
    setPerfereability(value: Preferability): RegistrationHints;

    getCordoned(): boolean;
    setCordoned(value: boolean): RegistrationHints;

    getGovern(): boolean;
    setGovern(value: boolean): RegistrationHints;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RegistrationHints.AsObject;
    static toObject(includeInstance: boolean, msg: RegistrationHints): RegistrationHints.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: RegistrationHints, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegistrationHints;
    static deserializeBinaryFromReader(message: RegistrationHints, reader: jspb.BinaryReader): RegistrationHints;
}

export namespace RegistrationHints {
    export type AsObject = {
        perfereability: Preferability,
        cordoned: boolean,
        govern: boolean,
    }
}

export class ClusterStatus extends jspb.Message { 
    getName(): string;
    setName(value: string): ClusterStatus;

    getUrl(): string;
    setUrl(value: string): ClusterStatus;

    getState(): ClusterState;
    setState(value: ClusterState): ClusterStatus;

    getScore(): number;
    setScore(value: number): ClusterStatus;

    getMaxScore(): number;
    setMaxScore(value: number): ClusterStatus;

    getGoverned(): boolean;
    setGoverned(value: boolean): ClusterStatus;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ClusterStatus.AsObject;
    static toObject(includeInstance: boolean, msg: ClusterStatus): ClusterStatus.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ClusterStatus, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ClusterStatus;
    static deserializeBinaryFromReader(message: ClusterStatus, reader: jspb.BinaryReader): ClusterStatus;
}

export namespace ClusterStatus {
    export type AsObject = {
        name: string,
        url: string,
        state: ClusterState,
        score: number,
        maxScore: number,
        governed: boolean,
    }
}

export class UpdateRequest extends jspb.Message { 
    getName(): string;
    setName(value: string): UpdateRequest;


    hasScore(): boolean;
    clearScore(): void;
    getScore(): number;
    setScore(value: number): UpdateRequest;


    hasMaxScore(): boolean;
    clearMaxScore(): void;
    getMaxScore(): number;
    setMaxScore(value: number): UpdateRequest;


    hasCordoned(): boolean;
    clearCordoned(): void;
    getCordoned(): boolean;
    setCordoned(value: boolean): UpdateRequest;


    getPropertyCase(): UpdateRequest.PropertyCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateRequest): UpdateRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UpdateRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateRequest;
    static deserializeBinaryFromReader(message: UpdateRequest, reader: jspb.BinaryReader): UpdateRequest;
}

export namespace UpdateRequest {
    export type AsObject = {
        name: string,
        score: number,
        maxScore: number,
        cordoned: boolean,
    }

    export enum PropertyCase {
        PROPERTY_NOT_SET = 0,
    
    SCORE = 2,

    MAX_SCORE = 3,

    CORDONED = 4,

    }

}

export class UpdateResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateResponse): UpdateResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UpdateResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateResponse;
    static deserializeBinaryFromReader(message: UpdateResponse, reader: jspb.BinaryReader): UpdateResponse;
}

export namespace UpdateResponse {
    export type AsObject = {
    }
}

export class DeregisterRequest extends jspb.Message { 
    getName(): string;
    setName(value: string): DeregisterRequest;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeregisterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DeregisterRequest): DeregisterRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeregisterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeregisterRequest;
    static deserializeBinaryFromReader(message: DeregisterRequest, reader: jspb.BinaryReader): DeregisterRequest;
}

export namespace DeregisterRequest {
    export type AsObject = {
        name: string,
    }
}

export class DeregisterResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeregisterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DeregisterResponse): DeregisterResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DeregisterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeregisterResponse;
    static deserializeBinaryFromReader(message: DeregisterResponse, reader: jspb.BinaryReader): DeregisterResponse;
}

export namespace DeregisterResponse {
    export type AsObject = {
    }
}

export class ListRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListRequest): ListRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListRequest;
    static deserializeBinaryFromReader(message: ListRequest, reader: jspb.BinaryReader): ListRequest;
}

export namespace ListRequest {
    export type AsObject = {
    }
}

export class ListResponse extends jspb.Message { 
    clearStatusList(): void;
    getStatusList(): Array<ClusterStatus>;
    setStatusList(value: Array<ClusterStatus>): ListResponse;
    addStatus(value?: ClusterStatus, index?: number): ClusterStatus;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListResponse): ListResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListResponse;
    static deserializeBinaryFromReader(message: ListResponse, reader: jspb.BinaryReader): ListResponse;
}

export namespace ListResponse {
    export type AsObject = {
        statusList: Array<ClusterStatus.AsObject>,
    }
}

export enum Preferability {
    NONE = 0,
    PREFER = 1,
    DONTSCHEDULE = 2,
}

export enum ClusterState {
    UNKNOWN = 0,
    AVAILABLE = 1,
    CORDONED = 2,
    DRAINING = 3,
}
