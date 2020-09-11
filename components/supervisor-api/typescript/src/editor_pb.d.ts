// package: supervisor
// file: editor.proto

/* tslint:disable */

import * as jspb from "google-protobuf";

export class Editor extends jspb.Message { 
    getTitle(): string;
    setTitle(value: string): void;

    getFilename(): string;
    setFilename(value: string): void;

    getIndex(): number;
    setIndex(value: number): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Editor.AsObject;
    static toObject(includeInstance: boolean, msg: Editor): Editor.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Editor, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Editor;
    static deserializeBinaryFromReader(message: Editor, reader: jspb.BinaryReader): Editor;
}

export namespace Editor {
    export type AsObject = {
        title: string,
        filename: string,
        index: number,
    }
}

export class ListEditorsRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListEditorsRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ListEditorsRequest): ListEditorsRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListEditorsRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListEditorsRequest;
    static deserializeBinaryFromReader(message: ListEditorsRequest, reader: jspb.BinaryReader): ListEditorsRequest;
}

export namespace ListEditorsRequest {
    export type AsObject = {
    }
}

export class ListEditorsResponse extends jspb.Message { 
    clearEditorsList(): void;
    getEditorsList(): Array<Editor>;
    setEditorsList(value: Array<Editor>): void;
    addEditors(value?: Editor, index?: number): Editor;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ListEditorsResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ListEditorsResponse): ListEditorsResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ListEditorsResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ListEditorsResponse;
    static deserializeBinaryFromReader(message: ListEditorsResponse, reader: jspb.BinaryReader): ListEditorsResponse;
}

export namespace ListEditorsResponse {
    export type AsObject = {
        editorsList: Array<Editor.AsObject>,
    }
}

export class OpenEditorRequest extends jspb.Message { 
    getPath(): string;
    setPath(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OpenEditorRequest.AsObject;
    static toObject(includeInstance: boolean, msg: OpenEditorRequest): OpenEditorRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: OpenEditorRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OpenEditorRequest;
    static deserializeBinaryFromReader(message: OpenEditorRequest, reader: jspb.BinaryReader): OpenEditorRequest;
}

export namespace OpenEditorRequest {
    export type AsObject = {
        path: string,
    }
}

export class OpenEditorResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OpenEditorResponse.AsObject;
    static toObject(includeInstance: boolean, msg: OpenEditorResponse): OpenEditorResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: OpenEditorResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OpenEditorResponse;
    static deserializeBinaryFromReader(message: OpenEditorResponse, reader: jspb.BinaryReader): OpenEditorResponse;
}

export namespace OpenEditorResponse {
    export type AsObject = {
    }
}

export class CloseEditorRequest extends jspb.Message { 
    getPath(): string;
    setPath(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CloseEditorRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CloseEditorRequest): CloseEditorRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CloseEditorRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CloseEditorRequest;
    static deserializeBinaryFromReader(message: CloseEditorRequest, reader: jspb.BinaryReader): CloseEditorRequest;
}

export namespace CloseEditorRequest {
    export type AsObject = {
        path: string,
    }
}

export class CloseEditorResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CloseEditorResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CloseEditorResponse): CloseEditorResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CloseEditorResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CloseEditorResponse;
    static deserializeBinaryFromReader(message: CloseEditorResponse, reader: jspb.BinaryReader): CloseEditorResponse;
}

export namespace CloseEditorResponse {
    export type AsObject = {
    }
}

export class GetActiveEditorRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetActiveEditorRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetActiveEditorRequest): GetActiveEditorRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetActiveEditorRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetActiveEditorRequest;
    static deserializeBinaryFromReader(message: GetActiveEditorRequest, reader: jspb.BinaryReader): GetActiveEditorRequest;
}

export namespace GetActiveEditorRequest {
    export type AsObject = {
    }
}

export class GetActiveEditorResponse extends jspb.Message { 

    hasActive(): boolean;
    clearActive(): void;
    getActive(): Editor | undefined;
    setActive(value?: Editor): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetActiveEditorResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetActiveEditorResponse): GetActiveEditorResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetActiveEditorResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetActiveEditorResponse;
    static deserializeBinaryFromReader(message: GetActiveEditorResponse, reader: jspb.BinaryReader): GetActiveEditorResponse;
}

export namespace GetActiveEditorResponse {
    export type AsObject = {
        active?: Editor.AsObject,
    }
}

export class SetActiveEditorRequest extends jspb.Message { 
    getPath(): string;
    setPath(value: string): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetActiveEditorRequest.AsObject;
    static toObject(includeInstance: boolean, msg: SetActiveEditorRequest): SetActiveEditorRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetActiveEditorRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetActiveEditorRequest;
    static deserializeBinaryFromReader(message: SetActiveEditorRequest, reader: jspb.BinaryReader): SetActiveEditorRequest;
}

export namespace SetActiveEditorRequest {
    export type AsObject = {
        path: string,
    }
}

export class SetActiveEditorResponse extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetActiveEditorResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SetActiveEditorResponse): SetActiveEditorResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetActiveEditorResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetActiveEditorResponse;
    static deserializeBinaryFromReader(message: SetActiveEditorResponse, reader: jspb.BinaryReader): SetActiveEditorResponse;
}

export namespace SetActiveEditorResponse {
    export type AsObject = {
    }
}
