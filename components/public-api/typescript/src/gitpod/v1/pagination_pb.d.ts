// package: gitpod.v1
// file: gitpod/v1/pagination.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class Pagination extends jspb.Message { 
    getPageSize(): number;
    setPageSize(value: number): Pagination;
    getPageToken(): string;
    setPageToken(value: string): Pagination;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Pagination.AsObject;
    static toObject(includeInstance: boolean, msg: Pagination): Pagination.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Pagination, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Pagination;
    static deserializeBinaryFromReader(message: Pagination, reader: jspb.BinaryReader): Pagination;
}

export namespace Pagination {
    export type AsObject = {
        pageSize: number,
        pageToken: string,
    }
}
