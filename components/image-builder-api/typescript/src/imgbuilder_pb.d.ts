/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: builder
// file: imgbuilder.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";

export class BuildSource extends jspb.Message {

    hasRef(): boolean;
    clearRef(): void;
    getRef(): BuildSourceReference | undefined;
    setRef(value?: BuildSourceReference): BuildSource;

    hasFile(): boolean;
    clearFile(): void;
    getFile(): BuildSourceDockerfile | undefined;
    setFile(value?: BuildSourceDockerfile): BuildSource;

    getFromCase(): BuildSource.FromCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildSource.AsObject;
    static toObject(includeInstance: boolean, msg: BuildSource): BuildSource.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildSource, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildSource;
    static deserializeBinaryFromReader(message: BuildSource, reader: jspb.BinaryReader): BuildSource;
}

export namespace BuildSource {
    export type AsObject = {
        ref?: BuildSourceReference.AsObject,
        file?: BuildSourceDockerfile.AsObject,
    }

    export enum FromCase {
        FROM_NOT_SET = 0,
        REF = 1,
        FILE = 2,
    }

}

export class BuildSourceReference extends jspb.Message {
    getRef(): string;
    setRef(value: string): BuildSourceReference;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildSourceReference.AsObject;
    static toObject(includeInstance: boolean, msg: BuildSourceReference): BuildSourceReference.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildSourceReference, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildSourceReference;
    static deserializeBinaryFromReader(message: BuildSourceReference, reader: jspb.BinaryReader): BuildSourceReference;
}

export namespace BuildSourceReference {
    export type AsObject = {
        ref: string,
    }
}

export class BuildSourceDockerfile extends jspb.Message {

    hasSource(): boolean;
    clearSource(): void;
    getSource(): content_service_api_initializer_pb.WorkspaceInitializer | undefined;
    setSource(value?: content_service_api_initializer_pb.WorkspaceInitializer): BuildSourceDockerfile;
    getDockerfileVersion(): string;
    setDockerfileVersion(value: string): BuildSourceDockerfile;
    getDockerfilePath(): string;
    setDockerfilePath(value: string): BuildSourceDockerfile;
    getContextPath(): string;
    setContextPath(value: string): BuildSourceDockerfile;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildSourceDockerfile.AsObject;
    static toObject(includeInstance: boolean, msg: BuildSourceDockerfile): BuildSourceDockerfile.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildSourceDockerfile, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildSourceDockerfile;
    static deserializeBinaryFromReader(message: BuildSourceDockerfile, reader: jspb.BinaryReader): BuildSourceDockerfile;
}

export namespace BuildSourceDockerfile {
    export type AsObject = {
        source?: content_service_api_initializer_pb.WorkspaceInitializer.AsObject,
        dockerfileVersion: string,
        dockerfilePath: string,
        contextPath: string,
    }
}

export class ResolveBaseImageRequest extends jspb.Message {
    getRef(): string;
    setRef(value: string): ResolveBaseImageRequest;

    hasAuth(): boolean;
    clearAuth(): void;
    getAuth(): BuildRegistryAuth | undefined;
    setAuth(value?: BuildRegistryAuth): ResolveBaseImageRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ResolveBaseImageRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ResolveBaseImageRequest): ResolveBaseImageRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ResolveBaseImageRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ResolveBaseImageRequest;
    static deserializeBinaryFromReader(message: ResolveBaseImageRequest, reader: jspb.BinaryReader): ResolveBaseImageRequest;
}

export namespace ResolveBaseImageRequest {
    export type AsObject = {
        ref: string,
        auth?: BuildRegistryAuth.AsObject,
    }
}

export class ResolveBaseImageResponse extends jspb.Message {
    getRef(): string;
    setRef(value: string): ResolveBaseImageResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ResolveBaseImageResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ResolveBaseImageResponse): ResolveBaseImageResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ResolveBaseImageResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ResolveBaseImageResponse;
    static deserializeBinaryFromReader(message: ResolveBaseImageResponse, reader: jspb.BinaryReader): ResolveBaseImageResponse;
}

export namespace ResolveBaseImageResponse {
    export type AsObject = {
        ref: string,
    }
}

export class ResolveWorkspaceImageRequest extends jspb.Message {

    hasSource(): boolean;
    clearSource(): void;
    getSource(): BuildSource | undefined;
    setSource(value?: BuildSource): ResolveWorkspaceImageRequest;

    hasAuth(): boolean;
    clearAuth(): void;
    getAuth(): BuildRegistryAuth | undefined;
    setAuth(value?: BuildRegistryAuth): ResolveWorkspaceImageRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ResolveWorkspaceImageRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ResolveWorkspaceImageRequest): ResolveWorkspaceImageRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ResolveWorkspaceImageRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ResolveWorkspaceImageRequest;
    static deserializeBinaryFromReader(message: ResolveWorkspaceImageRequest, reader: jspb.BinaryReader): ResolveWorkspaceImageRequest;
}

export namespace ResolveWorkspaceImageRequest {
    export type AsObject = {
        source?: BuildSource.AsObject,
        auth?: BuildRegistryAuth.AsObject,
    }
}

export class ResolveWorkspaceImageResponse extends jspb.Message {
    getRef(): string;
    setRef(value: string): ResolveWorkspaceImageResponse;
    getBaseRef(): string;
    setBaseRef(value: string): ResolveWorkspaceImageResponse;
    getStatus(): BuildStatus;
    setStatus(value: BuildStatus): ResolveWorkspaceImageResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ResolveWorkspaceImageResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ResolveWorkspaceImageResponse): ResolveWorkspaceImageResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ResolveWorkspaceImageResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ResolveWorkspaceImageResponse;
    static deserializeBinaryFromReader(message: ResolveWorkspaceImageResponse, reader: jspb.BinaryReader): ResolveWorkspaceImageResponse;
}

export namespace ResolveWorkspaceImageResponse {
    export type AsObject = {
        ref: string,
        baseRef: string,
        status: BuildStatus,
    }
}

export class BuildRequest extends jspb.Message {

    hasSource(): boolean;
    clearSource(): void;
    getSource(): BuildSource | undefined;
    setSource(value?: BuildSource): BuildRequest;

    hasAuth(): boolean;
    clearAuth(): void;
    getAuth(): BuildRegistryAuth | undefined;
    setAuth(value?: BuildRegistryAuth): BuildRequest;
    getForceRebuild(): boolean;
    setForceRebuild(value: boolean): BuildRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildRequest.AsObject;
    static toObject(includeInstance: boolean, msg: BuildRequest): BuildRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildRequest;
    static deserializeBinaryFromReader(message: BuildRequest, reader: jspb.BinaryReader): BuildRequest;
}

export namespace BuildRequest {
    export type AsObject = {
        source?: BuildSource.AsObject,
        auth?: BuildRegistryAuth.AsObject,
        forceRebuild: boolean,
    }
}

export class BuildRegistryAuth extends jspb.Message {

    hasTotal(): boolean;
    clearTotal(): void;
    getTotal(): BuildRegistryAuthTotal | undefined;
    setTotal(value?: BuildRegistryAuthTotal): BuildRegistryAuth;

    hasSelective(): boolean;
    clearSelective(): void;
    getSelective(): BuildRegistryAuthSelective | undefined;
    setSelective(value?: BuildRegistryAuthSelective): BuildRegistryAuth;

    getAdditionalMap(): jspb.Map<string, string>;
    clearAdditionalMap(): void;

    getModeCase(): BuildRegistryAuth.ModeCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildRegistryAuth.AsObject;
    static toObject(includeInstance: boolean, msg: BuildRegistryAuth): BuildRegistryAuth.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildRegistryAuth, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildRegistryAuth;
    static deserializeBinaryFromReader(message: BuildRegistryAuth, reader: jspb.BinaryReader): BuildRegistryAuth;
}

export namespace BuildRegistryAuth {
    export type AsObject = {
        total?: BuildRegistryAuthTotal.AsObject,
        selective?: BuildRegistryAuthSelective.AsObject,

        additionalMap: Array<[string, string]>,
    }

    export enum ModeCase {
        MODE_NOT_SET = 0,
        TOTAL = 1,
        SELECTIVE = 2,
    }

}

export class BuildRegistryAuthTotal extends jspb.Message {
    getAllowAll(): boolean;
    setAllowAll(value: boolean): BuildRegistryAuthTotal;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildRegistryAuthTotal.AsObject;
    static toObject(includeInstance: boolean, msg: BuildRegistryAuthTotal): BuildRegistryAuthTotal.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildRegistryAuthTotal, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildRegistryAuthTotal;
    static deserializeBinaryFromReader(message: BuildRegistryAuthTotal, reader: jspb.BinaryReader): BuildRegistryAuthTotal;
}

export namespace BuildRegistryAuthTotal {
    export type AsObject = {
        allowAll: boolean,
    }
}

export class BuildRegistryAuthSelective extends jspb.Message {
    getAllowBaserep(): boolean;
    setAllowBaserep(value: boolean): BuildRegistryAuthSelective;
    getAllowWorkspacerep(): boolean;
    setAllowWorkspacerep(value: boolean): BuildRegistryAuthSelective;
    clearAnyOfList(): void;
    getAnyOfList(): Array<string>;
    setAnyOfList(value: Array<string>): BuildRegistryAuthSelective;
    addAnyOf(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildRegistryAuthSelective.AsObject;
    static toObject(includeInstance: boolean, msg: BuildRegistryAuthSelective): BuildRegistryAuthSelective.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildRegistryAuthSelective, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildRegistryAuthSelective;
    static deserializeBinaryFromReader(message: BuildRegistryAuthSelective, reader: jspb.BinaryReader): BuildRegistryAuthSelective;
}

export namespace BuildRegistryAuthSelective {
    export type AsObject = {
        allowBaserep: boolean,
        allowWorkspacerep: boolean,
        anyOfList: Array<string>,
    }
}

export class BuildResponse extends jspb.Message {
    getRef(): string;
    setRef(value: string): BuildResponse;
    getBaseRef(): string;
    setBaseRef(value: string): BuildResponse;
    getStatus(): BuildStatus;
    setStatus(value: BuildStatus): BuildResponse;
    getMessage(): string;
    setMessage(value: string): BuildResponse;

    hasInfo(): boolean;
    clearInfo(): void;
    getInfo(): BuildInfo | undefined;
    setInfo(value?: BuildInfo): BuildResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildResponse.AsObject;
    static toObject(includeInstance: boolean, msg: BuildResponse): BuildResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildResponse;
    static deserializeBinaryFromReader(message: BuildResponse, reader: jspb.BinaryReader): BuildResponse;
}

export namespace BuildResponse {
    export type AsObject = {
        ref: string,
        baseRef: string,
        status: BuildStatus,
        message: string,
        info?: BuildInfo.AsObject,
    }
}

export class LogsRequest extends jspb.Message {
    getBuildRef(): string;
    setBuildRef(value: string): LogsRequest;
    getCensored(): boolean;
    setCensored(value: boolean): LogsRequest;
    getBuildId(): string;
    setBuildId(value: string): LogsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): LogsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: LogsRequest): LogsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: LogsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): LogsRequest;
    static deserializeBinaryFromReader(message: LogsRequest, reader: jspb.BinaryReader): LogsRequest;
}

export namespace LogsRequest {
    export type AsObject = {
        buildRef: string,
        censored: boolean,
        buildId: string,
    }
}

export class LogsResponse extends jspb.Message {
    getContent(): Uint8Array | string;
    getContent_asU8(): Uint8Array;
    getContent_asB64(): string;
    setContent(value: Uint8Array | string): LogsResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): LogsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: LogsResponse): LogsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: LogsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): LogsResponse;
    static deserializeBinaryFromReader(message: LogsResponse, reader: jspb.BinaryReader): LogsResponse;
}

export namespace LogsResponse {
    export type AsObject = {
        content: Uint8Array | string,
    }
}

export class ListBuildsRequest extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListBuildsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListBuildsRequest): ListBuildsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListBuildsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListBuildsRequest;
    static deserializeBinaryFromReader(message: ListBuildsRequest, reader: jspb.BinaryReader): ListBuildsRequest;
}

export namespace ListBuildsRequest {
    export type AsObject = {
    }
}

export class ListBuildsResponse extends jspb.Message {
    clearBuildsList(): void;
    getBuildsList(): Array<BuildInfo>;
    setBuildsList(value: Array<BuildInfo>): ListBuildsResponse;
    addBuilds(value?: BuildInfo, index?: number): BuildInfo;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListBuildsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListBuildsResponse): ListBuildsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListBuildsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListBuildsResponse;
    static deserializeBinaryFromReader(message: ListBuildsResponse, reader: jspb.BinaryReader): ListBuildsResponse;
}

export namespace ListBuildsResponse {
    export type AsObject = {
        buildsList: Array<BuildInfo.AsObject>,
    }
}

export class BuildInfo extends jspb.Message {
    getRef(): string;
    setRef(value: string): BuildInfo;
    getBaseRef(): string;
    setBaseRef(value: string): BuildInfo;
    getStatus(): BuildStatus;
    setStatus(value: BuildStatus): BuildInfo;
    getStartedAt(): number;
    setStartedAt(value: number): BuildInfo;
    getBuildId(): string;
    setBuildId(value: string): BuildInfo;

    hasLogInfo(): boolean;
    clearLogInfo(): void;
    getLogInfo(): LogInfo | undefined;
    setLogInfo(value?: LogInfo): BuildInfo;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuildInfo.AsObject;
    static toObject(includeInstance: boolean, msg: BuildInfo): BuildInfo.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: BuildInfo, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuildInfo;
    static deserializeBinaryFromReader(message: BuildInfo, reader: jspb.BinaryReader): BuildInfo;
}

export namespace BuildInfo {
    export type AsObject = {
        ref: string,
        baseRef: string,
        status: BuildStatus,
        startedAt: number,
        buildId: string,
        logInfo?: LogInfo.AsObject,
    }
}

export class LogInfo extends jspb.Message {
    getUrl(): string;
    setUrl(value: string): LogInfo;

    getHeadersMap(): jspb.Map<string, string>;
    clearHeadersMap(): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): LogInfo.AsObject;
    static toObject(includeInstance: boolean, msg: LogInfo): LogInfo.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: LogInfo, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): LogInfo;
    static deserializeBinaryFromReader(message: LogInfo, reader: jspb.BinaryReader): LogInfo;
}

export namespace LogInfo {
    export type AsObject = {
        url: string,

        headersMap: Array<[string, string]>,
    }
}

export enum BuildStatus {
    UNKNOWN = 0,
    RUNNING = 1,
    DONE_SUCCESS = 2,
    DONE_FAILURE = 3,
}
