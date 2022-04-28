// package: gitpod.v1
// file: gitpod/v1/prebuilds.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as gitpod_v1_workspaces_pb from "../../gitpod/v1/workspaces_pb";

export class GetPrebuildRequest extends jspb.Message {
    getPrebuildId(): string;
    setPrebuildId(value: string): GetPrebuildRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetPrebuildRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetPrebuildRequest): GetPrebuildRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetPrebuildRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetPrebuildRequest;
    static deserializeBinaryFromReader(message: GetPrebuildRequest, reader: jspb.BinaryReader): GetPrebuildRequest;
}

export namespace GetPrebuildRequest {
    export type AsObject = {
        prebuildId: string,
    }
}

export class GetPrebuildResponse extends jspb.Message {

    hasPrebuild(): boolean;
    clearPrebuild(): void;
    getPrebuild(): Prebuild | undefined;
    setPrebuild(value?: Prebuild): GetPrebuildResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetPrebuildResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetPrebuildResponse): GetPrebuildResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetPrebuildResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetPrebuildResponse;
    static deserializeBinaryFromReader(message: GetPrebuildResponse, reader: jspb.BinaryReader): GetPrebuildResponse;
}

export namespace GetPrebuildResponse {
    export type AsObject = {
        prebuild?: Prebuild.AsObject,
    }
}

export class GetRunningPrebuildRequest extends jspb.Message {
    getContextUrl(): string;
    setContextUrl(value: string): GetRunningPrebuildRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetRunningPrebuildRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetRunningPrebuildRequest): GetRunningPrebuildRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetRunningPrebuildRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetRunningPrebuildRequest;
    static deserializeBinaryFromReader(message: GetRunningPrebuildRequest, reader: jspb.BinaryReader): GetRunningPrebuildRequest;
}

export namespace GetRunningPrebuildRequest {
    export type AsObject = {
        contextUrl: string,
    }
}

export class GetRunningPrebuildResponse extends jspb.Message {

    hasPrebuild(): boolean;
    clearPrebuild(): void;
    getPrebuild(): Prebuild | undefined;
    setPrebuild(value?: Prebuild): GetRunningPrebuildResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetRunningPrebuildResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetRunningPrebuildResponse): GetRunningPrebuildResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetRunningPrebuildResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetRunningPrebuildResponse;
    static deserializeBinaryFromReader(message: GetRunningPrebuildResponse, reader: jspb.BinaryReader): GetRunningPrebuildResponse;
}

export namespace GetRunningPrebuildResponse {
    export type AsObject = {
        prebuild?: Prebuild.AsObject,
    }
}

export class ListenToPrebuildStatusRequest extends jspb.Message {
    getPrebuildId(): string;
    setPrebuildId(value: string): ListenToPrebuildStatusRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToPrebuildStatusRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToPrebuildStatusRequest): ListenToPrebuildStatusRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToPrebuildStatusRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToPrebuildStatusRequest;
    static deserializeBinaryFromReader(message: ListenToPrebuildStatusRequest, reader: jspb.BinaryReader): ListenToPrebuildStatusRequest;
}

export namespace ListenToPrebuildStatusRequest {
    export type AsObject = {
        prebuildId: string,
    }
}

export class ListenToPrebuildStatusResponse extends jspb.Message {

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): PrebuildStatus | undefined;
    setStatus(value?: PrebuildStatus): ListenToPrebuildStatusResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToPrebuildStatusResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToPrebuildStatusResponse): ListenToPrebuildStatusResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToPrebuildStatusResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToPrebuildStatusResponse;
    static deserializeBinaryFromReader(message: ListenToPrebuildStatusResponse, reader: jspb.BinaryReader): ListenToPrebuildStatusResponse;
}

export namespace ListenToPrebuildStatusResponse {
    export type AsObject = {
        status?: PrebuildStatus.AsObject,
    }
}

export class ListenToPrebuildLogsRequest extends jspb.Message {
    getPrebuildId(): string;
    setPrebuildId(value: string): ListenToPrebuildLogsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToPrebuildLogsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToPrebuildLogsRequest): ListenToPrebuildLogsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToPrebuildLogsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToPrebuildLogsRequest;
    static deserializeBinaryFromReader(message: ListenToPrebuildLogsRequest, reader: jspb.BinaryReader): ListenToPrebuildLogsRequest;
}

export namespace ListenToPrebuildLogsRequest {
    export type AsObject = {
        prebuildId: string,
    }
}

export class ListenToPrebuildLogsResponse extends jspb.Message {
    getLine(): string;
    setLine(value: string): ListenToPrebuildLogsResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenToPrebuildLogsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListenToPrebuildLogsResponse): ListenToPrebuildLogsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenToPrebuildLogsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenToPrebuildLogsResponse;
    static deserializeBinaryFromReader(message: ListenToPrebuildLogsResponse, reader: jspb.BinaryReader): ListenToPrebuildLogsResponse;
}

export namespace ListenToPrebuildLogsResponse {
    export type AsObject = {
        line: string,
    }
}

export class Prebuild extends jspb.Message {
    getPrebuildId(): string;
    setPrebuildId(value: string): Prebuild;

    hasSpec(): boolean;
    clearSpec(): void;
    getSpec(): PrebuildSpec | undefined;
    setSpec(value?: PrebuildSpec): Prebuild;

    hasStatus(): boolean;
    clearStatus(): void;
    getStatus(): PrebuildStatus | undefined;
    setStatus(value?: PrebuildStatus): Prebuild;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Prebuild.AsObject;
    static toObject(includeInstance: boolean, msg: Prebuild): Prebuild.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Prebuild, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Prebuild;
    static deserializeBinaryFromReader(message: Prebuild, reader: jspb.BinaryReader): Prebuild;
}

export namespace Prebuild {
    export type AsObject = {
        prebuildId: string,
        spec?: PrebuildSpec.AsObject,
        status?: PrebuildStatus.AsObject,
    }
}

export class PrebuildSpec extends jspb.Message {

    hasContext(): boolean;
    clearContext(): void;
    getContext(): gitpod_v1_workspaces_pb.WorkspaceContext | undefined;
    setContext(value?: gitpod_v1_workspaces_pb.WorkspaceContext): PrebuildSpec;
    getIncremental(): boolean;
    setIncremental(value: boolean): PrebuildSpec;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrebuildSpec.AsObject;
    static toObject(includeInstance: boolean, msg: PrebuildSpec): PrebuildSpec.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrebuildSpec, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrebuildSpec;
    static deserializeBinaryFromReader(message: PrebuildSpec, reader: jspb.BinaryReader): PrebuildSpec;
}

export namespace PrebuildSpec {
    export type AsObject = {
        context?: gitpod_v1_workspaces_pb.WorkspaceContext.AsObject,
        incremental: boolean,
    }
}

export class PrebuildStatus extends jspb.Message {
    getPhase(): PrebuildStatus.Phase;
    setPhase(value: PrebuildStatus.Phase): PrebuildStatus;
    getResult(): PrebuildStatus.Result;
    setResult(value: PrebuildStatus.Result): PrebuildStatus;
    getResultMessage(): string;
    setResultMessage(value: string): PrebuildStatus;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrebuildStatus.AsObject;
    static toObject(includeInstance: boolean, msg: PrebuildStatus): PrebuildStatus.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrebuildStatus, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrebuildStatus;
    static deserializeBinaryFromReader(message: PrebuildStatus, reader: jspb.BinaryReader): PrebuildStatus;
}

export namespace PrebuildStatus {
    export type AsObject = {
        phase: PrebuildStatus.Phase,
        result: PrebuildStatus.Result,
        resultMessage: string,
    }

    export enum Phase {
    PHASE_UNSPECIFIED = 0,
    PHASE_PENDING = 1,
    PHASE_RUNNING = 2,
    PHASE_DONE = 3,
    }

    export enum Result {
    RESULT_UNSPECIFIED = 0,
    RESULT_SUCCESS = 1,
    RESULT_USER_CANCELED = 2,
    RESULT_SYSTEM_FAILURE = 3,
    RESULT_TASK_FAILURE = 4,
    }

}
