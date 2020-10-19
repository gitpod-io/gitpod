// package: wsdaemon
// file: daemon.proto

import * as jspb from "google-protobuf";
import * as content_service_api_initializer_pb from "@gitpod/content-service/lib";

export class InitWorkspaceRequest extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  hasMetadata(): boolean;
  clearMetadata(): void;
  getMetadata(): WorkspaceMetadata | undefined;
  setMetadata(value?: WorkspaceMetadata): void;

  hasInitializer(): boolean;
  clearInitializer(): void;
  getInitializer(): content_service_api_initializer_pb.WorkspaceInitializer | undefined;
  setInitializer(value?: content_service_api_initializer_pb.WorkspaceInitializer): void;

  getFullWorkspaceBackup(): boolean;
  setFullWorkspaceBackup(value: boolean): void;

  getContentManifest(): Uint8Array | string;
  getContentManifest_asU8(): Uint8Array;
  getContentManifest_asB64(): string;
  setContentManifest(value: Uint8Array | string): void;

  getShiftfsMarkMount(): boolean;
  setShiftfsMarkMount(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): InitWorkspaceRequest.AsObject;
  static toObject(includeInstance: boolean, msg: InitWorkspaceRequest): InitWorkspaceRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: InitWorkspaceRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): InitWorkspaceRequest;
  static deserializeBinaryFromReader(message: InitWorkspaceRequest, reader: jspb.BinaryReader): InitWorkspaceRequest;
}

export namespace InitWorkspaceRequest {
  export type AsObject = {
    id: string,
    metadata?: WorkspaceMetadata.AsObject,
    initializer?: content_service_api_initializer_pb.WorkspaceInitializer.AsObject,
    fullWorkspaceBackup: boolean,
    contentManifest: Uint8Array | string,
    shiftfsMarkMount: boolean,
  }
}

export class WorkspaceMetadata extends jspb.Message {
  getOwner(): string;
  setOwner(value: string): void;

  getMetaId(): string;
  setMetaId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WorkspaceMetadata.AsObject;
  static toObject(includeInstance: boolean, msg: WorkspaceMetadata): WorkspaceMetadata.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: WorkspaceMetadata, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WorkspaceMetadata;
  static deserializeBinaryFromReader(message: WorkspaceMetadata, reader: jspb.BinaryReader): WorkspaceMetadata;
}

export namespace WorkspaceMetadata {
  export type AsObject = {
    owner: string,
    metaId: string,
  }
}

export class InitWorkspaceResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): InitWorkspaceResponse.AsObject;
  static toObject(includeInstance: boolean, msg: InitWorkspaceResponse): InitWorkspaceResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: InitWorkspaceResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): InitWorkspaceResponse;
  static deserializeBinaryFromReader(message: InitWorkspaceResponse, reader: jspb.BinaryReader): InitWorkspaceResponse;
}

export namespace InitWorkspaceResponse {
  export type AsObject = {
  }
}

export class WaitForInitRequest extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WaitForInitRequest.AsObject;
  static toObject(includeInstance: boolean, msg: WaitForInitRequest): WaitForInitRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: WaitForInitRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WaitForInitRequest;
  static deserializeBinaryFromReader(message: WaitForInitRequest, reader: jspb.BinaryReader): WaitForInitRequest;
}

export namespace WaitForInitRequest {
  export type AsObject = {
    id: string,
  }
}

export class WaitForInitResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WaitForInitResponse.AsObject;
  static toObject(includeInstance: boolean, msg: WaitForInitResponse): WaitForInitResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: WaitForInitResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WaitForInitResponse;
  static deserializeBinaryFromReader(message: WaitForInitResponse, reader: jspb.BinaryReader): WaitForInitResponse;
}

export namespace WaitForInitResponse {
  export type AsObject = {
  }
}

export class TakeSnapshotRequest extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TakeSnapshotRequest.AsObject;
  static toObject(includeInstance: boolean, msg: TakeSnapshotRequest): TakeSnapshotRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: TakeSnapshotRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TakeSnapshotRequest;
  static deserializeBinaryFromReader(message: TakeSnapshotRequest, reader: jspb.BinaryReader): TakeSnapshotRequest;
}

export namespace TakeSnapshotRequest {
  export type AsObject = {
    id: string,
  }
}

export class TakeSnapshotResponse extends jspb.Message {
  getUrl(): string;
  setUrl(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TakeSnapshotResponse.AsObject;
  static toObject(includeInstance: boolean, msg: TakeSnapshotResponse): TakeSnapshotResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: TakeSnapshotResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TakeSnapshotResponse;
  static deserializeBinaryFromReader(message: TakeSnapshotResponse, reader: jspb.BinaryReader): TakeSnapshotResponse;
}

export namespace TakeSnapshotResponse {
  export type AsObject = {
    url: string,
  }
}

export class DisposeWorkspaceRequest extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  getBackup(): boolean;
  setBackup(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DisposeWorkspaceRequest.AsObject;
  static toObject(includeInstance: boolean, msg: DisposeWorkspaceRequest): DisposeWorkspaceRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DisposeWorkspaceRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DisposeWorkspaceRequest;
  static deserializeBinaryFromReader(message: DisposeWorkspaceRequest, reader: jspb.BinaryReader): DisposeWorkspaceRequest;
}

export namespace DisposeWorkspaceRequest {
  export type AsObject = {
    id: string,
    backup: boolean,
  }
}

export class DisposeWorkspaceResponse extends jspb.Message {
  hasGitStatus(): boolean;
  clearGitStatus(): void;
  getGitStatus(): content_service_api_initializer_pb.GitStatus | undefined;
  setGitStatus(value?: content_service_api_initializer_pb.GitStatus): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DisposeWorkspaceResponse.AsObject;
  static toObject(includeInstance: boolean, msg: DisposeWorkspaceResponse): DisposeWorkspaceResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DisposeWorkspaceResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DisposeWorkspaceResponse;
  static deserializeBinaryFromReader(message: DisposeWorkspaceResponse, reader: jspb.BinaryReader): DisposeWorkspaceResponse;
}

export namespace DisposeWorkspaceResponse {
  export type AsObject = {
    gitStatus?: content_service_api_initializer_pb.GitStatus.AsObject,
  }
}

export interface WorkspaceContentStateMap {
  NONE: 0;
  SETTING_UP: 1;
  AVAILABLE: 2;
  WRAPPING_UP: 3;
}

export const WorkspaceContentState: WorkspaceContentStateMap;

