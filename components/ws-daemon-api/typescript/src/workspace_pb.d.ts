/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: wsbs
// file: workspace.proto

import * as jspb from "google-protobuf";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";

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

export class PauseTheiaRequest extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PauseTheiaRequest.AsObject;
  static toObject(includeInstance: boolean, msg: PauseTheiaRequest): PauseTheiaRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: PauseTheiaRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PauseTheiaRequest;
  static deserializeBinaryFromReader(message: PauseTheiaRequest, reader: jspb.BinaryReader): PauseTheiaRequest;
}

export namespace PauseTheiaRequest {
  export type AsObject = {
  }
}

export class PauseTheiaResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PauseTheiaResponse.AsObject;
  static toObject(includeInstance: boolean, msg: PauseTheiaResponse): PauseTheiaResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: PauseTheiaResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PauseTheiaResponse;
  static deserializeBinaryFromReader(message: PauseTheiaResponse, reader: jspb.BinaryReader): PauseTheiaResponse;
}

export namespace PauseTheiaResponse {
  export type AsObject = {
  }
}

export class GitStatusRequest extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GitStatusRequest.AsObject;
  static toObject(includeInstance: boolean, msg: GitStatusRequest): GitStatusRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GitStatusRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GitStatusRequest;
  static deserializeBinaryFromReader(message: GitStatusRequest, reader: jspb.BinaryReader): GitStatusRequest;
}

export namespace GitStatusRequest {
  export type AsObject = {
  }
}

export class GitStatusResponse extends jspb.Message {
  hasRepo(): boolean;
  clearRepo(): void;
  getRepo(): content_service_api_initializer_pb.GitStatus | undefined;
  setRepo(value?: content_service_api_initializer_pb.GitStatus): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GitStatusResponse.AsObject;
  static toObject(includeInstance: boolean, msg: GitStatusResponse): GitStatusResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GitStatusResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GitStatusResponse;
  static deserializeBinaryFromReader(message: GitStatusResponse, reader: jspb.BinaryReader): GitStatusResponse;
}

export namespace GitStatusResponse {
  export type AsObject = {
    repo?: content_service_api_initializer_pb.GitStatus.AsObject,
  }
}

export class UidmapCanaryResponse extends jspb.Message {
  getMessage(): string;
  setMessage(value: string): void;

  getErrorCode(): number;
  setErrorCode(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UidmapCanaryResponse.AsObject;
  static toObject(includeInstance: boolean, msg: UidmapCanaryResponse): UidmapCanaryResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: UidmapCanaryResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): UidmapCanaryResponse;
  static deserializeBinaryFromReader(message: UidmapCanaryResponse, reader: jspb.BinaryReader): UidmapCanaryResponse;
}

export namespace UidmapCanaryResponse {
  export type AsObject = {
    message: string,
    errorCode: number,
  }
}

export class UidmapCanaryRequest extends jspb.Message {
  getPid(): number;
  setPid(value: number): void;

  getGid(): boolean;
  setGid(value: boolean): void;

  clearMappingList(): void;
  getMappingList(): Array<UidmapCanaryRequest.Mapping>;
  setMappingList(value: Array<UidmapCanaryRequest.Mapping>): void;
  addMapping(value?: UidmapCanaryRequest.Mapping, index?: number): UidmapCanaryRequest.Mapping;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UidmapCanaryRequest.AsObject;
  static toObject(includeInstance: boolean, msg: UidmapCanaryRequest): UidmapCanaryRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: UidmapCanaryRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): UidmapCanaryRequest;
  static deserializeBinaryFromReader(message: UidmapCanaryRequest, reader: jspb.BinaryReader): UidmapCanaryRequest;
}

export namespace UidmapCanaryRequest {
  export type AsObject = {
    pid: number,
    gid: boolean,
    mappingList: Array<UidmapCanaryRequest.Mapping.AsObject>,
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

