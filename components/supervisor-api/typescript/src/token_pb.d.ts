/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: supervisor
// file: token.proto

/* tslint:disable */

import * as jspb from "google-protobuf";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";

export class GetTokenRequest extends jspb.Message { 
    getHost(): string;
    setHost(value: string): void;

    clearScopeList(): void;
    getScopeList(): Array<string>;
    setScopeList(value: Array<string>): void;
    addScope(value: string, index?: number): string;

    getDescription(): string;
    setDescription(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetTokenRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetTokenRequest): GetTokenRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetTokenRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetTokenRequest;
    static deserializeBinaryFromReader(message: GetTokenRequest, reader: jspb.BinaryReader): GetTokenRequest;
}

export namespace GetTokenRequest {
    export type AsObject = {
        host: string,
        scopeList: Array<string>,
        description: string,
    }
}

export class GetTokenResponse extends jspb.Message { 
    getToken(): string;
    setToken(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetTokenResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetTokenResponse): GetTokenResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetTokenResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetTokenResponse;
    static deserializeBinaryFromReader(message: GetTokenResponse, reader: jspb.BinaryReader): GetTokenResponse;
}

export namespace GetTokenResponse {
    export type AsObject = {
        token: string,
    }
}

export class SetTokenRequest extends jspb.Message { 
    getHost(): string;
    setHost(value: string): void;

    clearScopeList(): void;
    getScopeList(): Array<string>;
    setScopeList(value: Array<string>): void;
    addScope(value: string, index?: number): string;

    getToken(): string;
    setToken(value: string): void;


    hasExpiryDate(): boolean;
    clearExpiryDate(): void;
    getExpiryDate(): google_protobuf_timestamp_pb.Timestamp | undefined;
    setExpiryDate(value?: google_protobuf_timestamp_pb.Timestamp): void;

    getReuse(): TokenReuse;
    setReuse(value: TokenReuse): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetTokenRequest.AsObject;
    static toObject(includeInstance: boolean, msg: SetTokenRequest): SetTokenRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetTokenRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetTokenRequest;
    static deserializeBinaryFromReader(message: SetTokenRequest, reader: jspb.BinaryReader): SetTokenRequest;
}

export namespace SetTokenRequest {
    export type AsObject = {
        host: string,
        scopeList: Array<string>,
        token: string,
        expiryDate?: google_protobuf_timestamp_pb.Timestamp.AsObject,
        reuse: TokenReuse,
    }
}

export class SetTokenResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetTokenResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SetTokenResponse): SetTokenResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetTokenResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetTokenResponse;
    static deserializeBinaryFromReader(message: SetTokenResponse, reader: jspb.BinaryReader): SetTokenResponse;
}

export namespace SetTokenResponse {
    export type AsObject = {
    }
}

export class ClearTokenRequest extends jspb.Message { 

    hasValue(): boolean;
    clearValue(): void;
    getValue(): string;
    setValue(value: string): void;


    hasAll(): boolean;
    clearAll(): void;
    getAll(): boolean;
    setAll(value: boolean): void;


    getTokenCase(): ClearTokenRequest.TokenCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ClearTokenRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ClearTokenRequest): ClearTokenRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ClearTokenRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ClearTokenRequest;
    static deserializeBinaryFromReader(message: ClearTokenRequest, reader: jspb.BinaryReader): ClearTokenRequest;
}

export namespace ClearTokenRequest {
    export type AsObject = {
        value: string,
        all: boolean,
    }

    export enum TokenCase {
        TOKEN_NOT_SET = 0,
    
    VALUE = 1,

    ALL = 2,

    }

}

export class ClearTokenResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ClearTokenResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ClearTokenResponse): ClearTokenResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ClearTokenResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ClearTokenResponse;
    static deserializeBinaryFromReader(message: ClearTokenResponse, reader: jspb.BinaryReader): ClearTokenResponse;
}

export namespace ClearTokenResponse {
    export type AsObject = {
    }
}

export class ProvideTokenRequest extends jspb.Message { 

    hasRegistration(): boolean;
    clearRegistration(): void;
    getRegistration(): ProvideTokenRequest.RegisterProvider | undefined;
    setRegistration(value?: ProvideTokenRequest.RegisterProvider): void;


    hasAnswer(): boolean;
    clearAnswer(): void;
    getAnswer(): SetTokenRequest | undefined;
    setAnswer(value?: SetTokenRequest): void;


    getMessageCase(): ProvideTokenRequest.MessageCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ProvideTokenRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ProvideTokenRequest): ProvideTokenRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ProvideTokenRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ProvideTokenRequest;
    static deserializeBinaryFromReader(message: ProvideTokenRequest, reader: jspb.BinaryReader): ProvideTokenRequest;
}

export namespace ProvideTokenRequest {
    export type AsObject = {
        registration?: ProvideTokenRequest.RegisterProvider.AsObject,
        answer?: SetTokenRequest.AsObject,
    }


    export class RegisterProvider extends jspb.Message { 
    getHost(): string;
    setHost(value: string): void;


        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): RegisterProvider.AsObject;
        static toObject(includeInstance: boolean, msg: RegisterProvider): RegisterProvider.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: RegisterProvider, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): RegisterProvider;
        static deserializeBinaryFromReader(message: RegisterProvider, reader: jspb.BinaryReader): RegisterProvider;
    }

    export namespace RegisterProvider {
        export type AsObject = {
        host: string,
        }
    }


    export enum MessageCase {
        MESSAGE_NOT_SET = 0,
    
    REGISTRATION = 1,

    ANSWER = 2,

    }

}

export class ProvideTokenResponse extends jspb.Message { 

    hasRequest(): boolean;
    clearRequest(): void;
    getRequest(): GetTokenRequest | undefined;
    setRequest(value?: GetTokenRequest): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ProvideTokenResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ProvideTokenResponse): ProvideTokenResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ProvideTokenResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ProvideTokenResponse;
    static deserializeBinaryFromReader(message: ProvideTokenResponse, reader: jspb.BinaryReader): ProvideTokenResponse;
}

export namespace ProvideTokenResponse {
    export type AsObject = {
        request?: GetTokenRequest.AsObject,
    }
}

export enum TokenReuse {
    REUSE_NEVER = 0,
    REUSE_EXACTLY = 1,
    REUSE_WHEN_POSSIBLE = 2,
}
