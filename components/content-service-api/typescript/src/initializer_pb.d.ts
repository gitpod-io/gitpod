/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: contentservice
// file: initializer.proto

/* tslint:disable */

import * as jspb from "google-protobuf";

export class WorkspaceInitializer extends jspb.Message { 

    hasEmpty(): boolean;
    clearEmpty(): void;
    getEmpty(): EmptyInitializer | undefined;
    setEmpty(value?: EmptyInitializer): void;


    hasGit(): boolean;
    clearGit(): void;
    getGit(): GitInitializer | undefined;
    setGit(value?: GitInitializer): void;


    hasSnapshot(): boolean;
    clearSnapshot(): void;
    getSnapshot(): SnapshotInitializer | undefined;
    setSnapshot(value?: SnapshotInitializer): void;


    hasPrebuild(): boolean;
    clearPrebuild(): void;
    getPrebuild(): PrebuildInitializer | undefined;
    setPrebuild(value?: PrebuildInitializer): void;


    getSpecCase(): WorkspaceInitializer.SpecCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInitializer.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInitializer): WorkspaceInitializer.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceInitializer, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInitializer;
    static deserializeBinaryFromReader(message: WorkspaceInitializer, reader: jspb.BinaryReader): WorkspaceInitializer;
}

export namespace WorkspaceInitializer {
    export type AsObject = {
        empty?: EmptyInitializer.AsObject,
        git?: GitInitializer.AsObject,
        snapshot?: SnapshotInitializer.AsObject,
        prebuild?: PrebuildInitializer.AsObject,
    }

    export enum SpecCase {
        SPEC_NOT_SET = 0,
    
    EMPTY = 1,

    GIT = 2,

    SNAPSHOT = 3,

    PREBUILD = 4,

    }

}

export class EmptyInitializer extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): EmptyInitializer.AsObject;
    static toObject(includeInstance: boolean, msg: EmptyInitializer): EmptyInitializer.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: EmptyInitializer, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): EmptyInitializer;
    static deserializeBinaryFromReader(message: EmptyInitializer, reader: jspb.BinaryReader): EmptyInitializer;
}

export namespace EmptyInitializer {
    export type AsObject = {
    }
}

export class GitInitializer extends jspb.Message { 
    getRemoteUri(): string;
    setRemoteUri(value: string): void;

    getUpstreamRemoteUri(): string;
    setUpstreamRemoteUri(value: string): void;

    getTargetMode(): CloneTargetMode;
    setTargetMode(value: CloneTargetMode): void;

    getCloneTaget(): string;
    setCloneTaget(value: string): void;

    getCheckoutLocation(): string;
    setCheckoutLocation(value: string): void;


    hasConfig(): boolean;
    clearConfig(): void;
    getConfig(): GitConfig | undefined;
    setConfig(value?: GitConfig): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GitInitializer.AsObject;
    static toObject(includeInstance: boolean, msg: GitInitializer): GitInitializer.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GitInitializer, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GitInitializer;
    static deserializeBinaryFromReader(message: GitInitializer, reader: jspb.BinaryReader): GitInitializer;
}

export namespace GitInitializer {
    export type AsObject = {
        remoteUri: string,
        upstreamRemoteUri: string,
        targetMode: CloneTargetMode,
        cloneTaget: string,
        checkoutLocation: string,
        config?: GitConfig.AsObject,
    }
}

export class GitConfig extends jspb.Message { 

    getCustomConfigMap(): jspb.Map<string, string>;
    clearCustomConfigMap(): void;

    getAuthentication(): GitAuthMethod;
    setAuthentication(value: GitAuthMethod): void;

    getAuthUser(): string;
    setAuthUser(value: string): void;

    getAuthPassword(): string;
    setAuthPassword(value: string): void;

    getAuthOts(): string;
    setAuthOts(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GitConfig.AsObject;
    static toObject(includeInstance: boolean, msg: GitConfig): GitConfig.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GitConfig, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GitConfig;
    static deserializeBinaryFromReader(message: GitConfig, reader: jspb.BinaryReader): GitConfig;
}

export namespace GitConfig {
    export type AsObject = {

        customConfigMap: Array<[string, string]>,
        authentication: GitAuthMethod,
        authUser: string,
        authPassword: string,
        authOts: string,
    }
}

export class SnapshotInitializer extends jspb.Message { 
    getSnapshot(): string;
    setSnapshot(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SnapshotInitializer.AsObject;
    static toObject(includeInstance: boolean, msg: SnapshotInitializer): SnapshotInitializer.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SnapshotInitializer, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SnapshotInitializer;
    static deserializeBinaryFromReader(message: SnapshotInitializer, reader: jspb.BinaryReader): SnapshotInitializer;
}

export namespace SnapshotInitializer {
    export type AsObject = {
        snapshot: string,
    }
}

export class PrebuildInitializer extends jspb.Message { 

    hasPrebuild(): boolean;
    clearPrebuild(): void;
    getPrebuild(): SnapshotInitializer | undefined;
    setPrebuild(value?: SnapshotInitializer): void;


    hasGit(): boolean;
    clearGit(): void;
    getGit(): GitInitializer | undefined;
    setGit(value?: GitInitializer): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrebuildInitializer.AsObject;
    static toObject(includeInstance: boolean, msg: PrebuildInitializer): PrebuildInitializer.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrebuildInitializer, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrebuildInitializer;
    static deserializeBinaryFromReader(message: PrebuildInitializer, reader: jspb.BinaryReader): PrebuildInitializer;
}

export namespace PrebuildInitializer {
    export type AsObject = {
        prebuild?: SnapshotInitializer.AsObject,
        git?: GitInitializer.AsObject,
    }
}

export class GitStatus extends jspb.Message { 
    getBranch(): string;
    setBranch(value: string): void;

    getLatestCommit(): string;
    setLatestCommit(value: string): void;

    clearUncommitedFilesList(): void;
    getUncommitedFilesList(): Array<string>;
    setUncommitedFilesList(value: Array<string>): void;
    addUncommitedFiles(value: string, index?: number): string;

    getTotalUncommitedFiles(): number;
    setTotalUncommitedFiles(value: number): void;

    clearUntrackedFilesList(): void;
    getUntrackedFilesList(): Array<string>;
    setUntrackedFilesList(value: Array<string>): void;
    addUntrackedFiles(value: string, index?: number): string;

    getTotalUntrackedFiles(): number;
    setTotalUntrackedFiles(value: number): void;

    clearUnpushedCommitsList(): void;
    getUnpushedCommitsList(): Array<string>;
    setUnpushedCommitsList(value: Array<string>): void;
    addUnpushedCommits(value: string, index?: number): string;

    getTotalUnpushedCommits(): number;
    setTotalUnpushedCommits(value: number): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GitStatus.AsObject;
    static toObject(includeInstance: boolean, msg: GitStatus): GitStatus.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GitStatus, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GitStatus;
    static deserializeBinaryFromReader(message: GitStatus, reader: jspb.BinaryReader): GitStatus;
}

export namespace GitStatus {
    export type AsObject = {
        branch: string,
        latestCommit: string,
        uncommitedFilesList: Array<string>,
        totalUncommitedFiles: number,
        untrackedFilesList: Array<string>,
        totalUntrackedFiles: number,
        unpushedCommitsList: Array<string>,
        totalUnpushedCommits: number,
    }
}

export enum CloneTargetMode {
    REMOTE_HEAD = 0,
    REMOTE_COMMIT = 1,
    REMOTE_BRANCH = 2,
    LOCAL_BRANCH = 3,
}

export enum GitAuthMethod {
    NO_AUTH = 0,
    BASIC_AUTH = 1,
    BASIC_AUTH_OTS = 2,
}
