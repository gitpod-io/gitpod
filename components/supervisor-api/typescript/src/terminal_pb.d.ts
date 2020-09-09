// package: supervisor
// file: terminal.proto

/* tslint:disable */

import * as jspb from "google-protobuf";

export class OpenTerminalRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OpenTerminalRequest.AsObject;
    static toObject(includeInstance: boolean, msg: OpenTerminalRequest): OpenTerminalRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: OpenTerminalRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OpenTerminalRequest;
    static deserializeBinaryFromReader(message: OpenTerminalRequest, reader: jspb.BinaryReader): OpenTerminalRequest;
}

export namespace OpenTerminalRequest {
    export type AsObject = {
    }
}

export class OpenTerminalResponse extends jspb.Message { 
    getAlias(): string;
    setAlias(value: string): void;

    getStarterToken(): string;
    setStarterToken(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OpenTerminalResponse.AsObject;
    static toObject(includeInstance: boolean, msg: OpenTerminalResponse): OpenTerminalResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: OpenTerminalResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OpenTerminalResponse;
    static deserializeBinaryFromReader(message: OpenTerminalResponse, reader: jspb.BinaryReader): OpenTerminalResponse;
}

export namespace OpenTerminalResponse {
    export type AsObject = {
        alias: string,
        starterToken: string,
    }
}

export class ListTerminalsRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListTerminalsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListTerminalsRequest): ListTerminalsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListTerminalsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListTerminalsRequest;
    static deserializeBinaryFromReader(message: ListTerminalsRequest, reader: jspb.BinaryReader): ListTerminalsRequest;
}

export namespace ListTerminalsRequest {
    export type AsObject = {
    }
}

export class ListTerminalsResponse extends jspb.Message { 
    clearTerminalsList(): void;
    getTerminalsList(): Array<ListTerminalsResponse.Terminal>;
    setTerminalsList(value: Array<ListTerminalsResponse.Terminal>): void;
    addTerminals(value?: ListTerminalsResponse.Terminal, index?: number): ListTerminalsResponse.Terminal;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListTerminalsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListTerminalsResponse): ListTerminalsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListTerminalsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListTerminalsResponse;
    static deserializeBinaryFromReader(message: ListTerminalsResponse, reader: jspb.BinaryReader): ListTerminalsResponse;
}

export namespace ListTerminalsResponse {
    export type AsObject = {
        terminalsList: Array<ListTerminalsResponse.Terminal.AsObject>,
    }


    export class Terminal extends jspb.Message { 
    getAlias(): string;
    setAlias(value: string): void;

    clearCommandList(): void;
    getCommandList(): Array<string>;
    setCommandList(value: Array<string>): void;
    addCommand(value: string, index?: number): string;

    getTitle(): string;
    setTitle(value: string): void;


        serializeBinary(): Uint8Array;
        toObject(includeInstance?: boolean): Terminal.AsObject;
        static toObject(includeInstance: boolean, msg: Terminal): Terminal.AsObject;
        static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
        static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
        static serializeBinaryToWriter(message: Terminal, writer: jspb.BinaryWriter): void;
        static deserializeBinary(bytes: Uint8Array): Terminal;
        static deserializeBinaryFromReader(message: Terminal, reader: jspb.BinaryReader): Terminal;
    }

    export namespace Terminal {
        export type AsObject = {
        alias: string,
        commandList: Array<string>,
        title: string,
        }
    }

}

export class ListenTerminalRequest extends jspb.Message { 
    getAlias(): string;
    setAlias(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenTerminalRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListenTerminalRequest): ListenTerminalRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenTerminalRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenTerminalRequest;
    static deserializeBinaryFromReader(message: ListenTerminalRequest, reader: jspb.BinaryReader): ListenTerminalRequest;
}

export namespace ListenTerminalRequest {
    export type AsObject = {
        alias: string,
    }
}

export class ListenTerminalResponse extends jspb.Message { 

    hasStdout(): boolean;
    clearStdout(): void;
    getStdout(): Uint8Array | string;
    getStdout_asU8(): Uint8Array;
    getStdout_asB64(): string;
    setStdout(value: Uint8Array | string): void;


    hasStderr(): boolean;
    clearStderr(): void;
    getStderr(): Uint8Array | string;
    getStderr_asU8(): Uint8Array;
    getStderr_asB64(): string;
    setStderr(value: Uint8Array | string): void;


    getOutputCase(): ListenTerminalResponse.OutputCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListenTerminalResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListenTerminalResponse): ListenTerminalResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListenTerminalResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListenTerminalResponse;
    static deserializeBinaryFromReader(message: ListenTerminalResponse, reader: jspb.BinaryReader): ListenTerminalResponse;
}

export namespace ListenTerminalResponse {
    export type AsObject = {
        stdout: Uint8Array | string,
        stderr: Uint8Array | string,
    }

    export enum OutputCase {
        OUTPUT_NOT_SET = 0,
    
    STDOUT = 1,

    STDERR = 2,

    }

}

export class WriteTerminalRequest extends jspb.Message { 
    getAlias(): string;
    setAlias(value: string): void;

    getStdin(): Uint8Array | string;
    getStdin_asU8(): Uint8Array;
    getStdin_asB64(): string;
    setStdin(value: Uint8Array | string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WriteTerminalRequest.AsObject;
    static toObject(includeInstance: boolean, msg: WriteTerminalRequest): WriteTerminalRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WriteTerminalRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WriteTerminalRequest;
    static deserializeBinaryFromReader(message: WriteTerminalRequest, reader: jspb.BinaryReader): WriteTerminalRequest;
}

export namespace WriteTerminalRequest {
    export type AsObject = {
        alias: string,
        stdin: Uint8Array | string,
    }
}

export class WriteTerminalResponse extends jspb.Message { 
    getBytesWritten(): number;
    setBytesWritten(value: number): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): WriteTerminalResponse.AsObject;
    static toObject(includeInstance: boolean, msg: WriteTerminalResponse): WriteTerminalResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: WriteTerminalResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): WriteTerminalResponse;
    static deserializeBinaryFromReader(message: WriteTerminalResponse, reader: jspb.BinaryReader): WriteTerminalResponse;
}

export namespace WriteTerminalResponse {
    export type AsObject = {
        bytesWritten: number,
    }
}

export class SetTerminalSizeRequest extends jspb.Message { 
    getAlias(): string;
    setAlias(value: string): void;


    hasToken(): boolean;
    clearToken(): void;
    getToken(): string;
    setToken(value: string): void;


    hasForce(): boolean;
    clearForce(): void;
    getForce(): boolean;
    setForce(value: boolean): void;

    getRows(): number;
    setRows(value: number): void;

    getCols(): number;
    setCols(value: number): void;

    getWidthpx(): number;
    setWidthpx(value: number): void;

    getHeightpx(): number;
    setHeightpx(value: number): void;


    getPriorityCase(): SetTerminalSizeRequest.PriorityCase;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetTerminalSizeRequest.AsObject;
    static toObject(includeInstance: boolean, msg: SetTerminalSizeRequest): SetTerminalSizeRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetTerminalSizeRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetTerminalSizeRequest;
    static deserializeBinaryFromReader(message: SetTerminalSizeRequest, reader: jspb.BinaryReader): SetTerminalSizeRequest;
}

export namespace SetTerminalSizeRequest {
    export type AsObject = {
        alias: string,
        token: string,
        force: boolean,
        rows: number,
        cols: number,
        widthpx: number,
        heightpx: number,
    }

    export enum PriorityCase {
        PRIORITY_NOT_SET = 0,
    
    TOKEN = 2,

    FORCE = 3,

    }

}

export class SetTerminalSizeResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetTerminalSizeResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SetTerminalSizeResponse): SetTerminalSizeResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetTerminalSizeResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetTerminalSizeResponse;
    static deserializeBinaryFromReader(message: SetTerminalSizeResponse, reader: jspb.BinaryReader): SetTerminalSizeResponse;
}

export namespace SetTerminalSizeResponse {
    export type AsObject = {
    }
}
