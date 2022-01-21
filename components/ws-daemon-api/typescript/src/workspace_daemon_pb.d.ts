/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: iws
// file: workspace_daemon.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from 'google-protobuf';

export class PrepareForUserNSRequest extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PrepareForUserNSRequest.AsObject;
  static toObject(includeInstance: boolean, msg: PrepareForUserNSRequest): PrepareForUserNSRequest.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: PrepareForUserNSRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PrepareForUserNSRequest;
  static deserializeBinaryFromReader(
    message: PrepareForUserNSRequest,
    reader: jspb.BinaryReader,
  ): PrepareForUserNSRequest;
}

export namespace PrepareForUserNSRequest {
  export type AsObject = {};
}

export class PrepareForUserNSResponse extends jspb.Message {
  getFsShift(): FSShiftMethod;
  setFsShift(value: FSShiftMethod): PrepareForUserNSResponse;
  getFullWorkspaceBackup(): boolean;
  setFullWorkspaceBackup(value: boolean): PrepareForUserNSResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PrepareForUserNSResponse.AsObject;
  static toObject(includeInstance: boolean, msg: PrepareForUserNSResponse): PrepareForUserNSResponse.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: PrepareForUserNSResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PrepareForUserNSResponse;
  static deserializeBinaryFromReader(
    message: PrepareForUserNSResponse,
    reader: jspb.BinaryReader,
  ): PrepareForUserNSResponse;
}

export namespace PrepareForUserNSResponse {
  export type AsObject = {
    fsShift: FSShiftMethod;
    fullWorkspaceBackup: boolean;
  };
}

export class WriteIDMappingResponse extends jspb.Message {
  getMessage(): string;
  setMessage(value: string): WriteIDMappingResponse;
  getErrorCode(): number;
  setErrorCode(value: number): WriteIDMappingResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WriteIDMappingResponse.AsObject;
  static toObject(includeInstance: boolean, msg: WriteIDMappingResponse): WriteIDMappingResponse.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: WriteIDMappingResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WriteIDMappingResponse;
  static deserializeBinaryFromReader(
    message: WriteIDMappingResponse,
    reader: jspb.BinaryReader,
  ): WriteIDMappingResponse;
}

export namespace WriteIDMappingResponse {
  export type AsObject = {
    message: string;
    errorCode: number;
  };
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
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: WriteIDMappingRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WriteIDMappingRequest;
  static deserializeBinaryFromReader(message: WriteIDMappingRequest, reader: jspb.BinaryReader): WriteIDMappingRequest;
}

export namespace WriteIDMappingRequest {
  export type AsObject = {
    pid: number;
    gid: boolean;
    mappingList: Array<WriteIDMappingRequest.Mapping.AsObject>;
  };

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
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: Mapping, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Mapping;
    static deserializeBinaryFromReader(message: Mapping, reader: jspb.BinaryReader): Mapping;
  }

  export namespace Mapping {
    export type AsObject = {
      containerId: number;
      hostId: number;
      size: number;
    };
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
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: MountProcRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MountProcRequest;
  static deserializeBinaryFromReader(message: MountProcRequest, reader: jspb.BinaryReader): MountProcRequest;
}

export namespace MountProcRequest {
  export type AsObject = {
    target: string;
    pid: number;
  };
}

export class MountProcResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MountProcResponse.AsObject;
  static toObject(includeInstance: boolean, msg: MountProcResponse): MountProcResponse.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: MountProcResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MountProcResponse;
  static deserializeBinaryFromReader(message: MountProcResponse, reader: jspb.BinaryReader): MountProcResponse;
}

export namespace MountProcResponse {
  export type AsObject = {};
}

export class UmountProcRequest extends jspb.Message {
  getTarget(): string;
  setTarget(value: string): UmountProcRequest;
  getPid(): number;
  setPid(value: number): UmountProcRequest;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UmountProcRequest.AsObject;
  static toObject(includeInstance: boolean, msg: UmountProcRequest): UmountProcRequest.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: UmountProcRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): UmountProcRequest;
  static deserializeBinaryFromReader(message: UmountProcRequest, reader: jspb.BinaryReader): UmountProcRequest;
}

export namespace UmountProcRequest {
  export type AsObject = {
    target: string;
    pid: number;
  };
}

export class UmountProcResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UmountProcResponse.AsObject;
  static toObject(includeInstance: boolean, msg: UmountProcResponse): UmountProcResponse.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: UmountProcResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): UmountProcResponse;
  static deserializeBinaryFromReader(message: UmountProcResponse, reader: jspb.BinaryReader): UmountProcResponse;
}

export namespace UmountProcResponse {
  export type AsObject = {};
}

export class TeardownRequest extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TeardownRequest.AsObject;
  static toObject(includeInstance: boolean, msg: TeardownRequest): TeardownRequest.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: TeardownRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TeardownRequest;
  static deserializeBinaryFromReader(message: TeardownRequest, reader: jspb.BinaryReader): TeardownRequest;
}

export namespace TeardownRequest {
  export type AsObject = {};
}

export class TeardownResponse extends jspb.Message {
  getSuccess(): boolean;
  setSuccess(value: boolean): TeardownResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TeardownResponse.AsObject;
  static toObject(includeInstance: boolean, msg: TeardownResponse): TeardownResponse.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: TeardownResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TeardownResponse;
  static deserializeBinaryFromReader(message: TeardownResponse, reader: jspb.BinaryReader): TeardownResponse;
}

export namespace TeardownResponse {
  export type AsObject = {
    success: boolean;
  };
}

export enum FSShiftMethod {
  SHIFTFS = 0,
  FUSE = 1,
}
