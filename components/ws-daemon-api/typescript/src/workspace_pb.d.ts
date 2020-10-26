/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: iws
// file: workspace.proto

import * as jspb from "google-protobuf";

export class WriteIDMappingResponse extends jspb.Message {
  getMessage(): string;
  setMessage(value: string): void;

  getErrorCode(): number;
  setErrorCode(value: number): void;

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
  setPid(value: number): void;

  getGid(): boolean;
  setGid(value: boolean): void;

  clearMappingList(): void;
  getMappingList(): Array<WriteIDMappingRequest.Mapping>;
  setMappingList(value: Array<WriteIDMappingRequest.Mapping>): void;
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
    setContainerId(value: number): void;

    getHostId(): number;
    setHostId(value: number): void;

    getSize(): number;
    setSize(value: number): void;

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

export class MountShiftfsMarkRequest extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MountShiftfsMarkRequest.AsObject;
  static toObject(includeInstance: boolean, msg: MountShiftfsMarkRequest): MountShiftfsMarkRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: MountShiftfsMarkRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MountShiftfsMarkRequest;
  static deserializeBinaryFromReader(message: MountShiftfsMarkRequest, reader: jspb.BinaryReader): MountShiftfsMarkRequest;
}

export namespace MountShiftfsMarkRequest {
  export type AsObject = {
  }
}

export class MountShiftfsMarkResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MountShiftfsMarkResponse.AsObject;
  static toObject(includeInstance: boolean, msg: MountShiftfsMarkResponse): MountShiftfsMarkResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: MountShiftfsMarkResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MountShiftfsMarkResponse;
  static deserializeBinaryFromReader(message: MountShiftfsMarkResponse, reader: jspb.BinaryReader): MountShiftfsMarkResponse;
}

export namespace MountShiftfsMarkResponse {
  export type AsObject = {
  }
}

export class MountProcRequest extends jspb.Message {
  getTarget(): string;
  setTarget(value: string): void;

  getPid(): number;
  setPid(value: number): void;

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
  setSuccess(value: boolean): void;

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

