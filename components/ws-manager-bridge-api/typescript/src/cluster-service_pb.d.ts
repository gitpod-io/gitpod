/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: workspacemanagerbridge
// file: cluster-service.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from 'google-protobuf';

export class RegisterRequest extends jspb.Message {
    getName(): string;
    setName(value: string): RegisterRequest;
    getUrl(): string;
    setUrl(value: string): RegisterRequest;

    hasTls(): boolean;
    clearTls(): void;
    getTls(): TlsConfig | undefined;
    setTls(value?: TlsConfig): RegisterRequest;

    hasHints(): boolean;
    clearHints(): void;
    getHints(): RegistrationHints | undefined;
    setHints(value?: RegistrationHints): RegisterRequest;
    clearAdmissionConstraintsList(): void;
    getAdmissionConstraintsList(): Array<AdmissionConstraint>;
    setAdmissionConstraintsList(value: Array<AdmissionConstraint>): RegisterRequest;
    addAdmissionConstraints(value?: AdmissionConstraint, index?: number): AdmissionConstraint;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RegisterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: RegisterRequest): RegisterRequest.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: RegisterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegisterRequest;
    static deserializeBinaryFromReader(message: RegisterRequest, reader: jspb.BinaryReader): RegisterRequest;
}

export namespace RegisterRequest {
    export type AsObject = {
        name: string;
        url: string;
        tls?: TlsConfig.AsObject;
        hints?: RegistrationHints.AsObject;
        admissionConstraintsList: Array<AdmissionConstraint.AsObject>;
    };
}

export class RegisterResponse extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RegisterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: RegisterResponse): RegisterResponse.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: RegisterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegisterResponse;
    static deserializeBinaryFromReader(message: RegisterResponse, reader: jspb.BinaryReader): RegisterResponse;
}

export namespace RegisterResponse {
    export type AsObject = {};
}

export class TlsConfig extends jspb.Message {
    getCa(): string;
    setCa(value: string): TlsConfig;
    getCrt(): string;
    setCrt(value: string): TlsConfig;
    getKey(): string;
    setKey(value: string): TlsConfig;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): TlsConfig.AsObject;
    static toObject(includeInstance: boolean, msg: TlsConfig): TlsConfig.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: TlsConfig, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): TlsConfig;
    static deserializeBinaryFromReader(message: TlsConfig, reader: jspb.BinaryReader): TlsConfig;
}

export namespace TlsConfig {
    export type AsObject = {
        ca: string;
        crt: string;
        key: string;
    };
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
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: RegistrationHints, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RegistrationHints;
    static deserializeBinaryFromReader(message: RegistrationHints, reader: jspb.BinaryReader): RegistrationHints;
}

export namespace RegistrationHints {
    export type AsObject = {
        perfereability: Preferability;
        cordoned: boolean;
        govern: boolean;
    };
}

export class AdmissionConstraint extends jspb.Message {
    hasHasFeaturePreview(): boolean;
    clearHasFeaturePreview(): void;
    getHasFeaturePreview(): AdmissionConstraint.FeaturePreview | undefined;
    setHasFeaturePreview(value?: AdmissionConstraint.FeaturePreview): AdmissionConstraint;

    hasHasPermission(): boolean;
    clearHasPermission(): void;
    getHasPermission(): AdmissionConstraint.HasPermission | undefined;
    setHasPermission(value?: AdmissionConstraint.HasPermission): AdmissionConstraint;

    hasHasUserLevel(): boolean;
    clearHasUserLevel(): void;
    getHasUserLevel(): string;
    setHasUserLevel(value: string): AdmissionConstraint;

    hasHasMoreResources(): boolean;
    clearHasMoreResources(): void;
    getHasMoreResources(): boolean;
    setHasMoreResources(value: boolean): AdmissionConstraint;

    getConstraintCase(): AdmissionConstraint.ConstraintCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): AdmissionConstraint.AsObject;
    static toObject(includeInstance: boolean, msg: AdmissionConstraint): AdmissionConstraint.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: AdmissionConstraint, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): AdmissionConstraint;
    static deserializeBinaryFromReader(message: AdmissionConstraint, reader: jspb.BinaryReader): AdmissionConstraint;
}

export namespace AdmissionConstraint {
    export type AsObject = {
        hasFeaturePreview?: AdmissionConstraint.FeaturePreview.AsObject;
        hasPermission?: AdmissionConstraint.HasPermission.AsObject;
        hasUserLevel: string;
        hasMoreResources: boolean;
    };

    export class FeaturePreview extends jspb.Message {
        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): FeaturePreview.AsObject;
        static toObject(includeInstance: boolean, msg: FeaturePreview): FeaturePreview.AsObject;
        static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
        static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
        static serializeBinaryToWriter(message: FeaturePreview, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): FeaturePreview;
        static deserializeBinaryFromReader(message: FeaturePreview, reader: jspb.BinaryReader): FeaturePreview;
    }

    export namespace FeaturePreview {
        export type AsObject = {};
    }

    export class HasPermission extends jspb.Message {
        getPermission(): string;
        setPermission(value: string): HasPermission;

        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): HasPermission.AsObject;
        static toObject(includeInstance: boolean, msg: HasPermission): HasPermission.AsObject;
        static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
        static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
        static serializeBinaryToWriter(message: HasPermission, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): HasPermission;
        static deserializeBinaryFromReader(message: HasPermission, reader: jspb.BinaryReader): HasPermission;
    }

    export namespace HasPermission {
        export type AsObject = {
            permission: string;
        };
    }

    export enum ConstraintCase {
        CONSTRAINT_NOT_SET = 0,
        HAS_FEATURE_PREVIEW = 1,
        HAS_PERMISSION = 2,
        HAS_USER_LEVEL = 3,
        HAS_MORE_RESOURCES = 4,
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
    clearAdmissionConstraintList(): void;
    getAdmissionConstraintList(): Array<AdmissionConstraint>;
    setAdmissionConstraintList(value: Array<AdmissionConstraint>): ClusterStatus;
    addAdmissionConstraint(value?: AdmissionConstraint, index?: number): AdmissionConstraint;
    getStatic(): boolean;
    setStatic(value: boolean): ClusterStatus;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ClusterStatus.AsObject;
    static toObject(includeInstance: boolean, msg: ClusterStatus): ClusterStatus.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: ClusterStatus, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ClusterStatus;
    static deserializeBinaryFromReader(message: ClusterStatus, reader: jspb.BinaryReader): ClusterStatus;
}

export namespace ClusterStatus {
    export type AsObject = {
        name: string;
        url: string;
        state: ClusterState;
        score: number;
        maxScore: number;
        governed: boolean;
        admissionConstraintList: Array<AdmissionConstraint.AsObject>;
        pb_static: boolean;
    };
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

    hasAdmissionConstraint(): boolean;
    clearAdmissionConstraint(): void;
    getAdmissionConstraint(): ModifyAdmissionConstraint | undefined;
    setAdmissionConstraint(value?: ModifyAdmissionConstraint): UpdateRequest;

    getPropertyCase(): UpdateRequest.PropertyCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateRequest): UpdateRequest.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: UpdateRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateRequest;
    static deserializeBinaryFromReader(message: UpdateRequest, reader: jspb.BinaryReader): UpdateRequest;
}

export namespace UpdateRequest {
    export type AsObject = {
        name: string;
        score: number;
        maxScore: number;
        cordoned: boolean;
        admissionConstraint?: ModifyAdmissionConstraint.AsObject;
    };

    export enum PropertyCase {
        PROPERTY_NOT_SET = 0,
        SCORE = 2,
        MAX_SCORE = 3,
        CORDONED = 4,
        ADMISSION_CONSTRAINT = 5,
    }
}

export class ModifyAdmissionConstraint extends jspb.Message {
    getAdd(): boolean;
    setAdd(value: boolean): ModifyAdmissionConstraint;

    hasConstraint(): boolean;
    clearConstraint(): void;
    getConstraint(): AdmissionConstraint | undefined;
    setConstraint(value?: AdmissionConstraint): ModifyAdmissionConstraint;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ModifyAdmissionConstraint.AsObject;
    static toObject(includeInstance: boolean, msg: ModifyAdmissionConstraint): ModifyAdmissionConstraint.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: ModifyAdmissionConstraint, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ModifyAdmissionConstraint;
    static deserializeBinaryFromReader(
        message: ModifyAdmissionConstraint,
        reader: jspb.BinaryReader,
    ): ModifyAdmissionConstraint;
}

export namespace ModifyAdmissionConstraint {
    export type AsObject = {
        add: boolean;
        constraint?: AdmissionConstraint.AsObject;
    };
}

export class UpdateResponse extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UpdateResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UpdateResponse): UpdateResponse.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: UpdateResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UpdateResponse;
    static deserializeBinaryFromReader(message: UpdateResponse, reader: jspb.BinaryReader): UpdateResponse;
}

export namespace UpdateResponse {
    export type AsObject = {};
}

export class DeregisterRequest extends jspb.Message {
    getName(): string;
    setName(value: string): DeregisterRequest;
    getForce(): boolean;
    setForce(value: boolean): DeregisterRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeregisterRequest.AsObject;
    static toObject(includeInstance: boolean, msg: DeregisterRequest): DeregisterRequest.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: DeregisterRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeregisterRequest;
    static deserializeBinaryFromReader(message: DeregisterRequest, reader: jspb.BinaryReader): DeregisterRequest;
}

export namespace DeregisterRequest {
    export type AsObject = {
        name: string;
        force: boolean;
    };
}

export class DeregisterResponse extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DeregisterResponse.AsObject;
    static toObject(includeInstance: boolean, msg: DeregisterResponse): DeregisterResponse.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: DeregisterResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DeregisterResponse;
    static deserializeBinaryFromReader(message: DeregisterResponse, reader: jspb.BinaryReader): DeregisterResponse;
}

export namespace DeregisterResponse {
    export type AsObject = {};
}

export class ListRequest extends jspb.Message {
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListRequest): ListRequest.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: ListRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListRequest;
    static deserializeBinaryFromReader(message: ListRequest, reader: jspb.BinaryReader): ListRequest;
}

export namespace ListRequest {
    export type AsObject = {};
}

export class ListResponse extends jspb.Message {
    clearStatusList(): void;
    getStatusList(): Array<ClusterStatus>;
    setStatusList(value: Array<ClusterStatus>): ListResponse;
    addStatus(value?: ClusterStatus, index?: number): ClusterStatus;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListResponse): ListResponse.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: ListResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListResponse;
    static deserializeBinaryFromReader(message: ListResponse, reader: jspb.BinaryReader): ListResponse;
}

export namespace ListResponse {
    export type AsObject = {
        statusList: Array<ClusterStatus.AsObject>;
    };
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
