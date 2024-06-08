/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// package: iws
// file: workspace_daemon.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class PrepareForUserNSRequest extends jspb.Message {
    getUsernsPid(): number;
    setUsernsPid(value: number): PrepareForUserNSRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrepareForUserNSRequest.AsObject;
    static toObject(includeInstance: boolean, msg: PrepareForUserNSRequest): PrepareForUserNSRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrepareForUserNSRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrepareForUserNSRequest;
    static deserializeBinaryFromReader(message: PrepareForUserNSRequest, reader: jspb.BinaryReader): PrepareForUserNSRequest;
}

export namespace PrepareForUserNSRequest {
    export type AsObject = {
        usernsPid: number,
    }
}

export class PrepareForUserNSResponse extends jspb.Message {
    getFsShift(): FSShiftMethod;
    setFsShift(value: FSShiftMethod): PrepareForUserNSResponse;
    getPersistentVolumeClaim(): boolean;
    setPersistentVolumeClaim(value: boolean): PrepareForUserNSResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): PrepareForUserNSResponse.AsObject;
    static toObject(includeInstance: boolean, msg: PrepareForUserNSResponse): PrepareForUserNSResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: PrepareForUserNSResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): PrepareForUserNSResponse;
    static deserializeBinaryFromReader(message: PrepareForUserNSResponse, reader: jspb.BinaryReader): PrepareForUserNSResponse;
}

export namespace PrepareForUserNSResponse {
    export type AsObject = {
        fsShift: FSShiftMethod,
        persistentVolumeClaim: boolean,
    }
}

export class WriteIDMappingResponse extends jspb.Message {
    getMessage(): string;
    setMessage(value: string): WriteIDMappingResponse;
    getErrorCode(): number;
    setErrorCode(value: number): WriteIDMappingResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WriteIDMappingResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WriteIDMappingResponse): WriteIDMappingResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WriteIDMappingResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WriteIDMappingResponse;
    static deserializeBinaryFromReader(message: WriteIDMappingResponse, reader: jspb.BinaryReader): WriteIDMappingResponse;
}

export namespace WriteIDMappingResponse {
    export type AsObject = {
        message: string,
        errorCode: number,
    }
}

export class WriteIDMappingRequest extends jspb.Message {
    getPid(): number;
    setPid(value: number): WriteIDMappingRequest;
    getGid(): boolean;
    setGid(value: boolean): WriteIDMappingRequest;
    clearMappingList(): void;
    getMappingList(): Array<WriteIDMappingRequest.Mapping>;
    setMappingList(value: Array<WriteIDMappingRequest.Mapping>): WriteIDMappingRequest;
    addMapping(value?: WriteIDMappingRequest.Mapping, index?: number): WriteIDMappingRequest.Mapping;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WriteIDMappingRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WriteIDMappingRequest): WriteIDMappingRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WriteIDMappingRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WriteIDMappingRequest;
    static deserializeBinaryFromReader(message: WriteIDMappingRequest, reader: jspb.BinaryReader): WriteIDMappingRequest;
}

export namespace WriteIDMappingRequest {
    export type AsObject = {
        pid: number,
        gid: boolean,
        mappingList: Array<WriteIDMappingRequest.Mapping.AsObject>,
    }


    export class Mapping extends jspb.Message {
        getContainerId(): number;
        setContainerId(value: number): Mapping;
        getHostId(): number;
        setHostId(value: number): Mapping;
        getSize(): number;
        setSize(value: number): Mapping;

        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): Mapping.AsObject;
        static toObject(includeInstance: boolean, msg: Mapping): Mapping.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: Mapping, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): Mapping;
        static deserializeBinaryFromReader(message: Mapping, reader: jspb.BinaryReader): Mapping;
    }

    export namespace Mapping {
        export type AsObject = {
            containerId: number,
            hostId: number,
            size: number,
        }
    }

}

export class EvacuateCGroupRequest extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): EvacuateCGroupRequest.AsObject;
    static toObject(includeInstance: boolean, msg: EvacuateCGroupRequest): EvacuateCGroupRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: EvacuateCGroupRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): EvacuateCGroupRequest;
    static deserializeBinaryFromReader(message: EvacuateCGroupRequest, reader: jspb.BinaryReader): EvacuateCGroupRequest;
}

export namespace EvacuateCGroupRequest {
    export type AsObject = {
    }
}

export class EvacuateCGroupResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): EvacuateCGroupResponse.AsObject;
    static toObject(includeInstance: boolean, msg: EvacuateCGroupResponse): EvacuateCGroupResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: EvacuateCGroupResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): EvacuateCGroupResponse;
    static deserializeBinaryFromReader(message: EvacuateCGroupResponse, reader: jspb.BinaryReader): EvacuateCGroupResponse;
}

export namespace EvacuateCGroupResponse {
    export type AsObject = {
    }
}

export class MountProcRequest extends jspb.Message {
    getTarget(): string;
    setTarget(value: string): MountProcRequest;
    getPid(): number;
    setPid(value: number): MountProcRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MountProcRequest.AsObject;
    static toObject(includeInstance: boolean, msg: MountProcRequest): MountProcRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MountProcRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MountProcRequest;
    static deserializeBinaryFromReader(message: MountProcRequest, reader: jspb.BinaryReader): MountProcRequest;
}

export namespace MountProcRequest {
    export type AsObject = {
        target: string,
        pid: number,
    }
}

export class MountProcResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MountProcResponse.AsObject;
    static toObject(includeInstance: boolean, msg: MountProcResponse): MountProcResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MountProcResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MountProcResponse;
    static deserializeBinaryFromReader(message: MountProcResponse, reader: jspb.BinaryReader): MountProcResponse;
}

export namespace MountProcResponse {
    export type AsObject = {
    }
}

export class UmountProcRequest extends jspb.Message {
    getTarget(): string;
    setTarget(value: string): UmountProcRequest;
    getPid(): number;
    setPid(value: number): UmountProcRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UmountProcRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UmountProcRequest): UmountProcRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UmountProcRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UmountProcRequest;
    static deserializeBinaryFromReader(message: UmountProcRequest, reader: jspb.BinaryReader): UmountProcRequest;
}

export namespace UmountProcRequest {
    export type AsObject = {
        target: string,
        pid: number,
    }
}

export class UmountProcResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UmountProcResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UmountProcResponse): UmountProcResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UmountProcResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UmountProcResponse;
    static deserializeBinaryFromReader(message: UmountProcResponse, reader: jspb.BinaryReader): UmountProcResponse;
}

export namespace UmountProcResponse {
    export type AsObject = {
    }
}

export class MountNfsRequest extends jspb.Message {
    getSource(): string;
    setSource(value: string): MountNfsRequest;
    getTarget(): string;
    setTarget(value: string): MountNfsRequest;
    getArgs(): string;
    setArgs(value: string): MountNfsRequest;
    getPid(): number;
    setPid(value: number): MountNfsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MountNfsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: MountNfsRequest): MountNfsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MountNfsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MountNfsRequest;
    static deserializeBinaryFromReader(message: MountNfsRequest, reader: jspb.BinaryReader): MountNfsRequest;
}

export namespace MountNfsRequest {
    export type AsObject = {
        source: string,
        target: string,
        args: string,
        pid: number,
    }
}

export class MountNfsResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): MountNfsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: MountNfsResponse): MountNfsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: MountNfsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): MountNfsResponse;
    static deserializeBinaryFromReader(message: MountNfsResponse, reader: jspb.BinaryReader): MountNfsResponse;
}

export namespace MountNfsResponse {
    export type AsObject = {
    }
}

export class UmountNfsRequest extends jspb.Message {
    getTarget(): string;
    setTarget(value: string): UmountNfsRequest;
    getPid(): number;
    setPid(value: number): UmountNfsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UmountNfsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UmountNfsRequest): UmountNfsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UmountNfsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UmountNfsRequest;
    static deserializeBinaryFromReader(message: UmountNfsRequest, reader: jspb.BinaryReader): UmountNfsRequest;
}

export namespace UmountNfsRequest {
    export type AsObject = {
        target: string,
        pid: number,
    }
}

export class UmountNfsResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UmountNfsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UmountNfsResponse): UmountNfsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UmountNfsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UmountNfsResponse;
    static deserializeBinaryFromReader(message: UmountNfsResponse, reader: jspb.BinaryReader): UmountNfsResponse;
}

export namespace UmountNfsResponse {
    export type AsObject = {
    }
}

export class TeardownRequest extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): TeardownRequest.AsObject;
    static toObject(includeInstance: boolean, msg: TeardownRequest): TeardownRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: TeardownRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): TeardownRequest;
    static deserializeBinaryFromReader(message: TeardownRequest, reader: jspb.BinaryReader): TeardownRequest;
}

export namespace TeardownRequest {
    export type AsObject = {
    }
}

export class TeardownResponse extends jspb.Message {
    getSuccess(): boolean;
    setSuccess(value: boolean): TeardownResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): TeardownResponse.AsObject;
    static toObject(includeInstance: boolean, msg: TeardownResponse): TeardownResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: TeardownResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): TeardownResponse;
    static deserializeBinaryFromReader(message: TeardownResponse, reader: jspb.BinaryReader): TeardownResponse;
}

export namespace TeardownResponse {
    export type AsObject = {
        success: boolean,
    }
}

export class SetupPairVethsRequest extends jspb.Message {
    getPid(): number;
    setPid(value: number): SetupPairVethsRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetupPairVethsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: SetupPairVethsRequest): SetupPairVethsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetupPairVethsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetupPairVethsRequest;
    static deserializeBinaryFromReader(message: SetupPairVethsRequest, reader: jspb.BinaryReader): SetupPairVethsRequest;
}

export namespace SetupPairVethsRequest {
    export type AsObject = {
        pid: number,
    }
}

export class SetupPairVethsResponse extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetupPairVethsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SetupPairVethsResponse): SetupPairVethsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetupPairVethsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetupPairVethsResponse;
    static deserializeBinaryFromReader(message: SetupPairVethsResponse, reader: jspb.BinaryReader): SetupPairVethsResponse;
}

export namespace SetupPairVethsResponse {
    export type AsObject = {
    }
}

export class WorkspaceInfoRequest extends jspb.Message {

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInfoRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInfoRequest): WorkspaceInfoRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceInfoRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInfoRequest;
    static deserializeBinaryFromReader(message: WorkspaceInfoRequest, reader: jspb.BinaryReader): WorkspaceInfoRequest;
}

export namespace WorkspaceInfoRequest {
    export type AsObject = {
    }
}

export class WorkspaceInfoResponse extends jspb.Message {

    hasResources(): boolean;
    clearResources(): void;
    getResources(): Resources | undefined;
    setResources(value?: Resources): WorkspaceInfoResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WorkspaceInfoResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WorkspaceInfoResponse): WorkspaceInfoResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WorkspaceInfoResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WorkspaceInfoResponse;
    static deserializeBinaryFromReader(message: WorkspaceInfoResponse, reader: jspb.BinaryReader): WorkspaceInfoResponse;
}

export namespace WorkspaceInfoResponse {
    export type AsObject = {
        resources?: Resources.AsObject,
    }
}

export class Resources extends jspb.Message {

    hasCpu(): boolean;
    clearCpu(): void;
    getCpu(): Cpu | undefined;
    setCpu(value?: Cpu): Resources;

    hasMemory(): boolean;
    clearMemory(): void;
    getMemory(): Memory | undefined;
    setMemory(value?: Memory): Resources;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Resources.AsObject;
    static toObject(includeInstance: boolean, msg: Resources): Resources.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Resources, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Resources;
    static deserializeBinaryFromReader(message: Resources, reader: jspb.BinaryReader): Resources;
}

export namespace Resources {
    export type AsObject = {
        cpu?: Cpu.AsObject,
        memory?: Memory.AsObject,
    }
}

export class Cpu extends jspb.Message {
    getUsed(): number;
    setUsed(value: number): Cpu;
    getLimit(): number;
    setLimit(value: number): Cpu;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Cpu.AsObject;
    static toObject(includeInstance: boolean, msg: Cpu): Cpu.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Cpu, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Cpu;
    static deserializeBinaryFromReader(message: Cpu, reader: jspb.BinaryReader): Cpu;
}

export namespace Cpu {
    export type AsObject = {
        used: number,
        limit: number,
    }
}

export class Memory extends jspb.Message {
    getUsed(): number;
    setUsed(value: number): Memory;
    getLimit(): number;
    setLimit(value: number): Memory;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Memory.AsObject;
    static toObject(includeInstance: boolean, msg: Memory): Memory.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Memory, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Memory;
    static deserializeBinaryFromReader(message: Memory, reader: jspb.BinaryReader): Memory;
}

export namespace Memory {
    export type AsObject = {
        used: number,
        limit: number,
    }
}

export enum FSShiftMethod {
    SHIFTFS = 0,
    IDMAPPED = 2,
}
