/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { ZedToken } from "./core.pb";

export const protobufPackage = "authzed.api.v1";

/** ReadSchemaRequest returns the schema from the database. */
export interface ReadSchemaRequest {
}

/**
 * ReadSchemaResponse is the resulting data after having read the Object
 * Definitions from a Schema.
 */
export interface ReadSchemaResponse {
  /** schema_text is the textual form of the current schema in the system */
  schemaText: string;
  /** read_at is the ZedToken at which the schema was read. */
  readAt: ZedToken | undefined;
}

/**
 * WriteSchemaRequest is the required data used to "upsert" the Schema of a
 * Permissions System.
 */
export interface WriteSchemaRequest {
  /**
   * The Schema containing one or more Object Definitions that will be written
   * to the Permissions System.
   */
  schema: string;
}

/**
 * WriteSchemaResponse is the resulting data after having written a Schema to
 * a Permissions System.
 */
export interface WriteSchemaResponse {
  /** written_at is the ZedToken at which the schema was written. */
  writtenAt: ZedToken | undefined;
}

function createBaseReadSchemaRequest(): ReadSchemaRequest {
  return {};
}

export const ReadSchemaRequest = {
  encode(_: ReadSchemaRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReadSchemaRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReadSchemaRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(_: any): ReadSchemaRequest {
    return {};
  },

  toJSON(_: ReadSchemaRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ReadSchemaRequest>): ReadSchemaRequest {
    const message = createBaseReadSchemaRequest();
    return message;
  },
};

function createBaseReadSchemaResponse(): ReadSchemaResponse {
  return { schemaText: "", readAt: undefined };
}

export const ReadSchemaResponse = {
  encode(message: ReadSchemaResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schemaText !== "") {
      writer.uint32(10).string(message.schemaText);
    }
    if (message.readAt !== undefined) {
      ZedToken.encode(message.readAt, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReadSchemaResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReadSchemaResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schemaText = reader.string();
          break;
        case 2:
          message.readAt = ZedToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ReadSchemaResponse {
    return {
      schemaText: isSet(object.schemaText) ? String(object.schemaText) : "",
      readAt: isSet(object.readAt) ? ZedToken.fromJSON(object.readAt) : undefined,
    };
  },

  toJSON(message: ReadSchemaResponse): unknown {
    const obj: any = {};
    message.schemaText !== undefined && (obj.schemaText = message.schemaText);
    message.readAt !== undefined && (obj.readAt = message.readAt ? ZedToken.toJSON(message.readAt) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ReadSchemaResponse>): ReadSchemaResponse {
    const message = createBaseReadSchemaResponse();
    message.schemaText = object.schemaText ?? "";
    message.readAt = (object.readAt !== undefined && object.readAt !== null)
      ? ZedToken.fromPartial(object.readAt)
      : undefined;
    return message;
  },
};

function createBaseWriteSchemaRequest(): WriteSchemaRequest {
  return { schema: "" };
}

export const WriteSchemaRequest = {
  encode(message: WriteSchemaRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schema !== "") {
      writer.uint32(10).string(message.schema);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WriteSchemaRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWriteSchemaRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.schema = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteSchemaRequest {
    return { schema: isSet(object.schema) ? String(object.schema) : "" };
  },

  toJSON(message: WriteSchemaRequest): unknown {
    const obj: any = {};
    message.schema !== undefined && (obj.schema = message.schema);
    return obj;
  },

  fromPartial(object: DeepPartial<WriteSchemaRequest>): WriteSchemaRequest {
    const message = createBaseWriteSchemaRequest();
    message.schema = object.schema ?? "";
    return message;
  },
};

function createBaseWriteSchemaResponse(): WriteSchemaResponse {
  return { writtenAt: undefined };
}

export const WriteSchemaResponse = {
  encode(message: WriteSchemaResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.writtenAt !== undefined) {
      ZedToken.encode(message.writtenAt, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WriteSchemaResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWriteSchemaResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.writtenAt = ZedToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteSchemaResponse {
    return { writtenAt: isSet(object.writtenAt) ? ZedToken.fromJSON(object.writtenAt) : undefined };
  },

  toJSON(message: WriteSchemaResponse): unknown {
    const obj: any = {};
    message.writtenAt !== undefined &&
      (obj.writtenAt = message.writtenAt ? ZedToken.toJSON(message.writtenAt) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<WriteSchemaResponse>): WriteSchemaResponse {
    const message = createBaseWriteSchemaResponse();
    message.writtenAt = (object.writtenAt !== undefined && object.writtenAt !== null)
      ? ZedToken.fromPartial(object.writtenAt)
      : undefined;
    return message;
  },
};

/** SchemaService implements operations on a Permissions System's Schema. */
export type SchemaServiceDefinition = typeof SchemaServiceDefinition;
export const SchemaServiceDefinition = {
  name: "SchemaService",
  fullName: "authzed.api.v1.SchemaService",
  methods: {
    /**
     * Read returns the current Object Definitions for a Permissions System.
     *
     * Errors include:
     * - INVALID_ARGUMENT: a provided value has failed to semantically validate
     * - NOT_FOUND: no schema has been defined
     */
    readSchema: {
      name: "ReadSchema",
      requestType: ReadSchemaRequest,
      requestStream: false,
      responseType: ReadSchemaResponse,
      responseStream: false,
      options: {},
    },
    /** Write overwrites the current Object Definitions for a Permissions System. */
    writeSchema: {
      name: "WriteSchema",
      requestType: WriteSchemaRequest,
      requestStream: false,
      responseType: WriteSchemaResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface SchemaServiceServiceImplementation<CallContextExt = {}> {
  /**
   * Read returns the current Object Definitions for a Permissions System.
   *
   * Errors include:
   * - INVALID_ARGUMENT: a provided value has failed to semantically validate
   * - NOT_FOUND: no schema has been defined
   */
  readSchema(
    request: ReadSchemaRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ReadSchemaResponse>>;
  /** Write overwrites the current Object Definitions for a Permissions System. */
  writeSchema(
    request: WriteSchemaRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<WriteSchemaResponse>>;
}

export interface SchemaServiceClient<CallOptionsExt = {}> {
  /**
   * Read returns the current Object Definitions for a Permissions System.
   *
   * Errors include:
   * - INVALID_ARGUMENT: a provided value has failed to semantically validate
   * - NOT_FOUND: no schema has been defined
   */
  readSchema(
    request: DeepPartial<ReadSchemaRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ReadSchemaResponse>;
  /** Write overwrites the current Object Definitions for a Permissions System. */
  writeSchema(
    request: DeepPartial<WriteSchemaRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<WriteSchemaResponse>;
}

export interface DataLoaderOptions {
  cache?: boolean;
}

export interface DataLoaders {
  rpcDataLoaderOptions?: DataLoaderOptions;
  getDataLoader<T>(identifier: string, constructorFn: () => T): T;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
