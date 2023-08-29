/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "authzed.api.v1alpha1";

/**
 * ReadSchemaRequest is the required data to read Object Definitions from
 * a Schema.
 */
export interface ReadSchemaRequest {
  /**
   * The list of names of the Object Definitions that are being requested.
   *
   * These names must be fully qualified with their namespace (e.g.
   * myblog/post).
   */
  objectDefinitionsNames: string[];
}

/**
 * ReadSchemaResponse is the resulting data after having read the Object
 * Definitions from a Schema.
 */
export interface ReadSchemaResponse {
  /** The Object Definitions that were requested. */
  objectDefinitions: string[];
  /** The computed revision of the returned object definitions. */
  computedDefinitionsRevision: string;
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
  /**
   * If specified, the existing revision of object definitions in the schema that must be present for
   * the write to succeed. If the revision specified differs (i.e. the underlying schema has changed),
   * the write call will fail with a FAILED_PRECONDITION error.
   */
  optionalDefinitionsRevisionPrecondition: string;
}

/**
 * WriteSchemaResponse is the resulting data after having written a Schema to
 * a Permissions System.
 */
export interface WriteSchemaResponse {
  /** The names of the Object Definitions that were written. */
  objectDefinitionsNames: string[];
  /** The computed revision of the written object definitions. */
  computedDefinitionsRevision: string;
}

function createBaseReadSchemaRequest(): ReadSchemaRequest {
  return { objectDefinitionsNames: [] };
}

export const ReadSchemaRequest = {
  encode(message: ReadSchemaRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.objectDefinitionsNames) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ReadSchemaRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseReadSchemaRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.objectDefinitionsNames.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ReadSchemaRequest {
    return {
      objectDefinitionsNames: Array.isArray(object?.objectDefinitionsNames)
        ? object.objectDefinitionsNames.map((e: any) => String(e))
        : [],
    };
  },

  toJSON(message: ReadSchemaRequest): unknown {
    const obj: any = {};
    if (message.objectDefinitionsNames) {
      obj.objectDefinitionsNames = message.objectDefinitionsNames.map((e) => e);
    } else {
      obj.objectDefinitionsNames = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<ReadSchemaRequest>): ReadSchemaRequest {
    const message = createBaseReadSchemaRequest();
    message.objectDefinitionsNames = object.objectDefinitionsNames?.map((e) => e) || [];
    return message;
  },
};

function createBaseReadSchemaResponse(): ReadSchemaResponse {
  return { objectDefinitions: [], computedDefinitionsRevision: "" };
}

export const ReadSchemaResponse = {
  encode(message: ReadSchemaResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.objectDefinitions) {
      writer.uint32(10).string(v!);
    }
    if (message.computedDefinitionsRevision !== "") {
      writer.uint32(18).string(message.computedDefinitionsRevision);
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
          message.objectDefinitions.push(reader.string());
          break;
        case 2:
          message.computedDefinitionsRevision = reader.string();
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
      objectDefinitions: Array.isArray(object?.objectDefinitions)
        ? object.objectDefinitions.map((e: any) => String(e))
        : [],
      computedDefinitionsRevision: isSet(object.computedDefinitionsRevision)
        ? String(object.computedDefinitionsRevision)
        : "",
    };
  },

  toJSON(message: ReadSchemaResponse): unknown {
    const obj: any = {};
    if (message.objectDefinitions) {
      obj.objectDefinitions = message.objectDefinitions.map((e) => e);
    } else {
      obj.objectDefinitions = [];
    }
    message.computedDefinitionsRevision !== undefined &&
      (obj.computedDefinitionsRevision = message.computedDefinitionsRevision);
    return obj;
  },

  fromPartial(object: DeepPartial<ReadSchemaResponse>): ReadSchemaResponse {
    const message = createBaseReadSchemaResponse();
    message.objectDefinitions = object.objectDefinitions?.map((e) => e) || [];
    message.computedDefinitionsRevision = object.computedDefinitionsRevision ?? "";
    return message;
  },
};

function createBaseWriteSchemaRequest(): WriteSchemaRequest {
  return { schema: "", optionalDefinitionsRevisionPrecondition: "" };
}

export const WriteSchemaRequest = {
  encode(message: WriteSchemaRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.schema !== "") {
      writer.uint32(10).string(message.schema);
    }
    if (message.optionalDefinitionsRevisionPrecondition !== "") {
      writer.uint32(18).string(message.optionalDefinitionsRevisionPrecondition);
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
        case 2:
          message.optionalDefinitionsRevisionPrecondition = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteSchemaRequest {
    return {
      schema: isSet(object.schema) ? String(object.schema) : "",
      optionalDefinitionsRevisionPrecondition: isSet(object.optionalDefinitionsRevisionPrecondition)
        ? String(object.optionalDefinitionsRevisionPrecondition)
        : "",
    };
  },

  toJSON(message: WriteSchemaRequest): unknown {
    const obj: any = {};
    message.schema !== undefined && (obj.schema = message.schema);
    message.optionalDefinitionsRevisionPrecondition !== undefined &&
      (obj.optionalDefinitionsRevisionPrecondition = message.optionalDefinitionsRevisionPrecondition);
    return obj;
  },

  fromPartial(object: DeepPartial<WriteSchemaRequest>): WriteSchemaRequest {
    const message = createBaseWriteSchemaRequest();
    message.schema = object.schema ?? "";
    message.optionalDefinitionsRevisionPrecondition = object.optionalDefinitionsRevisionPrecondition ?? "";
    return message;
  },
};

function createBaseWriteSchemaResponse(): WriteSchemaResponse {
  return { objectDefinitionsNames: [], computedDefinitionsRevision: "" };
}

export const WriteSchemaResponse = {
  encode(message: WriteSchemaResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.objectDefinitionsNames) {
      writer.uint32(10).string(v!);
    }
    if (message.computedDefinitionsRevision !== "") {
      writer.uint32(18).string(message.computedDefinitionsRevision);
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
          message.objectDefinitionsNames.push(reader.string());
          break;
        case 2:
          message.computedDefinitionsRevision = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteSchemaResponse {
    return {
      objectDefinitionsNames: Array.isArray(object?.objectDefinitionsNames)
        ? object.objectDefinitionsNames.map((e: any) => String(e))
        : [],
      computedDefinitionsRevision: isSet(object.computedDefinitionsRevision)
        ? String(object.computedDefinitionsRevision)
        : "",
    };
  },

  toJSON(message: WriteSchemaResponse): unknown {
    const obj: any = {};
    if (message.objectDefinitionsNames) {
      obj.objectDefinitionsNames = message.objectDefinitionsNames.map((e) => e);
    } else {
      obj.objectDefinitionsNames = [];
    }
    message.computedDefinitionsRevision !== undefined &&
      (obj.computedDefinitionsRevision = message.computedDefinitionsRevision);
    return obj;
  },

  fromPartial(object: DeepPartial<WriteSchemaResponse>): WriteSchemaResponse {
    const message = createBaseWriteSchemaResponse();
    message.objectDefinitionsNames = object.objectDefinitionsNames?.map((e) => e) || [];
    message.computedDefinitionsRevision = object.computedDefinitionsRevision ?? "";
    return message;
  },
};

/** SchemaService implements operations on a Permissions System's Schema. */
export type SchemaServiceDefinition = typeof SchemaServiceDefinition;
export const SchemaServiceDefinition = {
  name: "SchemaService",
  fullName: "authzed.api.v1alpha1.SchemaService",
  methods: {
    /**
     * Read returns the current Object Definitions for a Permissions System.
     *
     * Errors include:
     * - INVALID_ARGUMENT: a provided value has failed to semantically validate
     * - NOT_FOUND: one of the Object Definitions being requested does not exist
     */
    readSchema: {
      name: "ReadSchema",
      requestType: ReadSchemaRequest,
      requestStream: false,
      responseType: ReadSchemaResponse,
      responseStream: false,
      options: {},
    },
    /**
     * Write overwrites the current Object Definitions for a Permissions System.
     *
     * Any Object Definitions that exist, but are not included will be deleted.
     */
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
   * - NOT_FOUND: one of the Object Definitions being requested does not exist
   */
  readSchema(
    request: ReadSchemaRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ReadSchemaResponse>>;
  /**
   * Write overwrites the current Object Definitions for a Permissions System.
   *
   * Any Object Definitions that exist, but are not included will be deleted.
   */
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
   * - NOT_FOUND: one of the Object Definitions being requested does not exist
   */
  readSchema(
    request: DeepPartial<ReadSchemaRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ReadSchemaResponse>;
  /**
   * Write overwrites the current Object Definitions for a Permissions System.
   *
   * Any Object Definitions that exist, but are not included will be deleted.
   */
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
