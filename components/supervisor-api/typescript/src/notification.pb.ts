/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "supervisor";

export interface NotifyRequest {
  level: NotifyRequest_Level;
  message: string;
  /** if actions are empty, Notify will return immediately */
  actions: string[];
}

export enum NotifyRequest_Level {
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function notifyRequest_LevelFromJSON(object: any): NotifyRequest_Level {
  switch (object) {
    case 0:
    case "ERROR":
      return NotifyRequest_Level.ERROR;
    case 1:
    case "WARNING":
      return NotifyRequest_Level.WARNING;
    case 2:
    case "INFO":
      return NotifyRequest_Level.INFO;
    case -1:
    case "UNRECOGNIZED":
    default:
      return NotifyRequest_Level.UNRECOGNIZED;
  }
}

export function notifyRequest_LevelToJSON(object: NotifyRequest_Level): string {
  switch (object) {
    case NotifyRequest_Level.ERROR:
      return "ERROR";
    case NotifyRequest_Level.WARNING:
      return "WARNING";
    case NotifyRequest_Level.INFO:
      return "INFO";
    case NotifyRequest_Level.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function notifyRequest_LevelToNumber(object: NotifyRequest_Level): number {
  switch (object) {
    case NotifyRequest_Level.ERROR:
      return 0;
    case NotifyRequest_Level.WARNING:
      return 1;
    case NotifyRequest_Level.INFO:
      return 2;
    case NotifyRequest_Level.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface NotifyResponse {
  /** action chosen by the user or empty string if cancelled */
  action: string;
}

export interface SubscribeRequest {
}

export interface SubscribeResponse {
  requestId: number;
  request: NotifyRequest | undefined;
}

export interface RespondRequest {
  requestId: number;
  response: NotifyResponse | undefined;
}

export interface RespondResponse {
}

export interface NotifyActiveRequest {
  open: NotifyActiveRequest_OpenData | undefined;
  preview: NotifyActiveRequest_PreviewData | undefined;
}

/** open a file in editor */
export interface NotifyActiveRequest_OpenData {
  urls: string[];
  /** wait until all opened files are closed */
  await: boolean;
}

/** ask editor to open a URL in its preview */
export interface NotifyActiveRequest_PreviewData {
  url: string;
  /** open the URL in a new browser tab */
  external: boolean;
}

export interface NotifyActiveResponse {
}

export interface SubscribeActiveRequest {
}

export interface SubscribeActiveResponse {
  requestId: number;
  request: NotifyActiveRequest | undefined;
}

export interface NotifyActiveRespondRequest {
  requestId: number;
  response: NotifyActiveResponse | undefined;
}

export interface NotifyActiveRespondResponse {
}

function createBaseNotifyRequest(): NotifyRequest {
  return { level: NotifyRequest_Level.ERROR, message: "", actions: [] };
}

export const NotifyRequest = {
  encode(message: NotifyRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.level !== NotifyRequest_Level.ERROR) {
      writer.uint32(8).int32(notifyRequest_LevelToNumber(message.level));
    }
    if (message.message !== "") {
      writer.uint32(18).string(message.message);
    }
    for (const v of message.actions) {
      writer.uint32(26).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.level = notifyRequest_LevelFromJSON(reader.int32());
          break;
        case 2:
          message.message = reader.string();
          break;
        case 3:
          message.actions.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): NotifyRequest {
    return {
      level: isSet(object.level) ? notifyRequest_LevelFromJSON(object.level) : NotifyRequest_Level.ERROR,
      message: isSet(object.message) ? String(object.message) : "",
      actions: Array.isArray(object?.actions) ? object.actions.map((e: any) => String(e)) : [],
    };
  },

  toJSON(message: NotifyRequest): unknown {
    const obj: any = {};
    message.level !== undefined && (obj.level = notifyRequest_LevelToJSON(message.level));
    message.message !== undefined && (obj.message = message.message);
    if (message.actions) {
      obj.actions = message.actions.map((e) => e);
    } else {
      obj.actions = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<NotifyRequest>): NotifyRequest {
    const message = createBaseNotifyRequest();
    message.level = object.level ?? NotifyRequest_Level.ERROR;
    message.message = object.message ?? "";
    message.actions = object.actions?.map((e) => e) || [];
    return message;
  },
};

function createBaseNotifyResponse(): NotifyResponse {
  return { action: "" };
}

export const NotifyResponse = {
  encode(message: NotifyResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.action !== "") {
      writer.uint32(10).string(message.action);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.action = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): NotifyResponse {
    return { action: isSet(object.action) ? String(object.action) : "" };
  },

  toJSON(message: NotifyResponse): unknown {
    const obj: any = {};
    message.action !== undefined && (obj.action = message.action);
    return obj;
  },

  fromPartial(object: DeepPartial<NotifyResponse>): NotifyResponse {
    const message = createBaseNotifyResponse();
    message.action = object.action ?? "";
    return message;
  },
};

function createBaseSubscribeRequest(): SubscribeRequest {
  return {};
}

export const SubscribeRequest = {
  encode(_: SubscribeRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubscribeRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubscribeRequest();
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

  fromJSON(_: any): SubscribeRequest {
    return {};
  },

  toJSON(_: SubscribeRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<SubscribeRequest>): SubscribeRequest {
    const message = createBaseSubscribeRequest();
    return message;
  },
};

function createBaseSubscribeResponse(): SubscribeResponse {
  return { requestId: 0, request: undefined };
}

export const SubscribeResponse = {
  encode(message: SubscribeResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.requestId !== 0) {
      writer.uint32(8).uint64(message.requestId);
    }
    if (message.request !== undefined) {
      NotifyRequest.encode(message.request, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubscribeResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubscribeResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestId = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.request = NotifyRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SubscribeResponse {
    return {
      requestId: isSet(object.requestId) ? Number(object.requestId) : 0,
      request: isSet(object.request) ? NotifyRequest.fromJSON(object.request) : undefined,
    };
  },

  toJSON(message: SubscribeResponse): unknown {
    const obj: any = {};
    message.requestId !== undefined && (obj.requestId = Math.round(message.requestId));
    message.request !== undefined &&
      (obj.request = message.request ? NotifyRequest.toJSON(message.request) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<SubscribeResponse>): SubscribeResponse {
    const message = createBaseSubscribeResponse();
    message.requestId = object.requestId ?? 0;
    message.request = (object.request !== undefined && object.request !== null)
      ? NotifyRequest.fromPartial(object.request)
      : undefined;
    return message;
  },
};

function createBaseRespondRequest(): RespondRequest {
  return { requestId: 0, response: undefined };
}

export const RespondRequest = {
  encode(message: RespondRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.requestId !== 0) {
      writer.uint32(8).uint64(message.requestId);
    }
    if (message.response !== undefined) {
      NotifyResponse.encode(message.response, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RespondRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRespondRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestId = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.response = NotifyResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RespondRequest {
    return {
      requestId: isSet(object.requestId) ? Number(object.requestId) : 0,
      response: isSet(object.response) ? NotifyResponse.fromJSON(object.response) : undefined,
    };
  },

  toJSON(message: RespondRequest): unknown {
    const obj: any = {};
    message.requestId !== undefined && (obj.requestId = Math.round(message.requestId));
    message.response !== undefined &&
      (obj.response = message.response ? NotifyResponse.toJSON(message.response) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<RespondRequest>): RespondRequest {
    const message = createBaseRespondRequest();
    message.requestId = object.requestId ?? 0;
    message.response = (object.response !== undefined && object.response !== null)
      ? NotifyResponse.fromPartial(object.response)
      : undefined;
    return message;
  },
};

function createBaseRespondResponse(): RespondResponse {
  return {};
}

export const RespondResponse = {
  encode(_: RespondResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RespondResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRespondResponse();
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

  fromJSON(_: any): RespondResponse {
    return {};
  },

  toJSON(_: RespondResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<RespondResponse>): RespondResponse {
    const message = createBaseRespondResponse();
    return message;
  },
};

function createBaseNotifyActiveRequest(): NotifyActiveRequest {
  return { open: undefined, preview: undefined };
}

export const NotifyActiveRequest = {
  encode(message: NotifyActiveRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.open !== undefined) {
      NotifyActiveRequest_OpenData.encode(message.open, writer.uint32(10).fork()).ldelim();
    }
    if (message.preview !== undefined) {
      NotifyActiveRequest_PreviewData.encode(message.preview, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyActiveRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyActiveRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.open = NotifyActiveRequest_OpenData.decode(reader, reader.uint32());
          break;
        case 2:
          message.preview = NotifyActiveRequest_PreviewData.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): NotifyActiveRequest {
    return {
      open: isSet(object.open) ? NotifyActiveRequest_OpenData.fromJSON(object.open) : undefined,
      preview: isSet(object.preview) ? NotifyActiveRequest_PreviewData.fromJSON(object.preview) : undefined,
    };
  },

  toJSON(message: NotifyActiveRequest): unknown {
    const obj: any = {};
    message.open !== undefined &&
      (obj.open = message.open ? NotifyActiveRequest_OpenData.toJSON(message.open) : undefined);
    message.preview !== undefined &&
      (obj.preview = message.preview ? NotifyActiveRequest_PreviewData.toJSON(message.preview) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<NotifyActiveRequest>): NotifyActiveRequest {
    const message = createBaseNotifyActiveRequest();
    message.open = (object.open !== undefined && object.open !== null)
      ? NotifyActiveRequest_OpenData.fromPartial(object.open)
      : undefined;
    message.preview = (object.preview !== undefined && object.preview !== null)
      ? NotifyActiveRequest_PreviewData.fromPartial(object.preview)
      : undefined;
    return message;
  },
};

function createBaseNotifyActiveRequest_OpenData(): NotifyActiveRequest_OpenData {
  return { urls: [], await: false };
}

export const NotifyActiveRequest_OpenData = {
  encode(message: NotifyActiveRequest_OpenData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.urls) {
      writer.uint32(10).string(v!);
    }
    if (message.await === true) {
      writer.uint32(16).bool(message.await);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyActiveRequest_OpenData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyActiveRequest_OpenData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.urls.push(reader.string());
          break;
        case 2:
          message.await = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): NotifyActiveRequest_OpenData {
    return {
      urls: Array.isArray(object?.urls) ? object.urls.map((e: any) => String(e)) : [],
      await: isSet(object.await) ? Boolean(object.await) : false,
    };
  },

  toJSON(message: NotifyActiveRequest_OpenData): unknown {
    const obj: any = {};
    if (message.urls) {
      obj.urls = message.urls.map((e) => e);
    } else {
      obj.urls = [];
    }
    message.await !== undefined && (obj.await = message.await);
    return obj;
  },

  fromPartial(object: DeepPartial<NotifyActiveRequest_OpenData>): NotifyActiveRequest_OpenData {
    const message = createBaseNotifyActiveRequest_OpenData();
    message.urls = object.urls?.map((e) => e) || [];
    message.await = object.await ?? false;
    return message;
  },
};

function createBaseNotifyActiveRequest_PreviewData(): NotifyActiveRequest_PreviewData {
  return { url: "", external: false };
}

export const NotifyActiveRequest_PreviewData = {
  encode(message: NotifyActiveRequest_PreviewData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.url !== "") {
      writer.uint32(10).string(message.url);
    }
    if (message.external === true) {
      writer.uint32(16).bool(message.external);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyActiveRequest_PreviewData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyActiveRequest_PreviewData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.url = reader.string();
          break;
        case 2:
          message.external = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): NotifyActiveRequest_PreviewData {
    return {
      url: isSet(object.url) ? String(object.url) : "",
      external: isSet(object.external) ? Boolean(object.external) : false,
    };
  },

  toJSON(message: NotifyActiveRequest_PreviewData): unknown {
    const obj: any = {};
    message.url !== undefined && (obj.url = message.url);
    message.external !== undefined && (obj.external = message.external);
    return obj;
  },

  fromPartial(object: DeepPartial<NotifyActiveRequest_PreviewData>): NotifyActiveRequest_PreviewData {
    const message = createBaseNotifyActiveRequest_PreviewData();
    message.url = object.url ?? "";
    message.external = object.external ?? false;
    return message;
  },
};

function createBaseNotifyActiveResponse(): NotifyActiveResponse {
  return {};
}

export const NotifyActiveResponse = {
  encode(_: NotifyActiveResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyActiveResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyActiveResponse();
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

  fromJSON(_: any): NotifyActiveResponse {
    return {};
  },

  toJSON(_: NotifyActiveResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<NotifyActiveResponse>): NotifyActiveResponse {
    const message = createBaseNotifyActiveResponse();
    return message;
  },
};

function createBaseSubscribeActiveRequest(): SubscribeActiveRequest {
  return {};
}

export const SubscribeActiveRequest = {
  encode(_: SubscribeActiveRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubscribeActiveRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubscribeActiveRequest();
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

  fromJSON(_: any): SubscribeActiveRequest {
    return {};
  },

  toJSON(_: SubscribeActiveRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<SubscribeActiveRequest>): SubscribeActiveRequest {
    const message = createBaseSubscribeActiveRequest();
    return message;
  },
};

function createBaseSubscribeActiveResponse(): SubscribeActiveResponse {
  return { requestId: 0, request: undefined };
}

export const SubscribeActiveResponse = {
  encode(message: SubscribeActiveResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.requestId !== 0) {
      writer.uint32(8).uint64(message.requestId);
    }
    if (message.request !== undefined) {
      NotifyActiveRequest.encode(message.request, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubscribeActiveResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSubscribeActiveResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestId = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.request = NotifyActiveRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SubscribeActiveResponse {
    return {
      requestId: isSet(object.requestId) ? Number(object.requestId) : 0,
      request: isSet(object.request) ? NotifyActiveRequest.fromJSON(object.request) : undefined,
    };
  },

  toJSON(message: SubscribeActiveResponse): unknown {
    const obj: any = {};
    message.requestId !== undefined && (obj.requestId = Math.round(message.requestId));
    message.request !== undefined &&
      (obj.request = message.request ? NotifyActiveRequest.toJSON(message.request) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<SubscribeActiveResponse>): SubscribeActiveResponse {
    const message = createBaseSubscribeActiveResponse();
    message.requestId = object.requestId ?? 0;
    message.request = (object.request !== undefined && object.request !== null)
      ? NotifyActiveRequest.fromPartial(object.request)
      : undefined;
    return message;
  },
};

function createBaseNotifyActiveRespondRequest(): NotifyActiveRespondRequest {
  return { requestId: 0, response: undefined };
}

export const NotifyActiveRespondRequest = {
  encode(message: NotifyActiveRespondRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.requestId !== 0) {
      writer.uint32(8).uint64(message.requestId);
    }
    if (message.response !== undefined) {
      NotifyActiveResponse.encode(message.response, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyActiveRespondRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyActiveRespondRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.requestId = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.response = NotifyActiveResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): NotifyActiveRespondRequest {
    return {
      requestId: isSet(object.requestId) ? Number(object.requestId) : 0,
      response: isSet(object.response) ? NotifyActiveResponse.fromJSON(object.response) : undefined,
    };
  },

  toJSON(message: NotifyActiveRespondRequest): unknown {
    const obj: any = {};
    message.requestId !== undefined && (obj.requestId = Math.round(message.requestId));
    message.response !== undefined &&
      (obj.response = message.response ? NotifyActiveResponse.toJSON(message.response) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<NotifyActiveRespondRequest>): NotifyActiveRespondRequest {
    const message = createBaseNotifyActiveRespondRequest();
    message.requestId = object.requestId ?? 0;
    message.response = (object.response !== undefined && object.response !== null)
      ? NotifyActiveResponse.fromPartial(object.response)
      : undefined;
    return message;
  },
};

function createBaseNotifyActiveRespondResponse(): NotifyActiveRespondResponse {
  return {};
}

export const NotifyActiveRespondResponse = {
  encode(_: NotifyActiveRespondResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NotifyActiveRespondResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNotifyActiveRespondResponse();
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

  fromJSON(_: any): NotifyActiveRespondResponse {
    return {};
  },

  toJSON(_: NotifyActiveRespondResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<NotifyActiveRespondResponse>): NotifyActiveRespondResponse {
    const message = createBaseNotifyActiveRespondResponse();
    return message;
  },
};

/**
 * Notification serivce allows external processes to notify the user and ask for
 * decisions.
 */
export type NotificationServiceDefinition = typeof NotificationServiceDefinition;
export const NotificationServiceDefinition = {
  name: "NotificationService",
  fullName: "supervisor.NotificationService",
  methods: {
    /**
     * Prompts the user and asks for a decision. Typically called by some external
     * process. If the list of actions is empty this service returns immediately,
     * otherwise it blocks until the user has made their choice.
     */
    notify: {
      name: "Notify",
      requestType: NotifyRequest,
      requestStream: false,
      responseType: NotifyResponse,
      responseStream: false,
      options: {},
    },
    /** Subscribe to notifications. Typically called by the IDE. */
    subscribe: {
      name: "Subscribe",
      requestType: SubscribeRequest,
      requestStream: false,
      responseType: SubscribeResponse,
      responseStream: true,
      options: {},
    },
    /**
     * Report a user's choice as a response to a notification. Typically called by
     * the IDE.
     */
    respond: {
      name: "Respond",
      requestType: RespondRequest,
      requestStream: false,
      responseType: RespondResponse,
      responseStream: false,
      options: {},
    },
    /**
     * Called by the IDE to inform supervisor about which is the latest client
     * actively used by the user. We consider active the last IDE with focus.
     * Only 1 stream is kept open at any given time. A new subscription
     * overrides the previous one, causing the stream to close.
     * Supervisor will respond with a stream to which the IDE will listen
     * waiting to receive actions to run, for example: `open` or `preview`
     */
    subscribeActive: {
      name: "SubscribeActive",
      requestType: SubscribeActiveRequest,
      requestStream: false,
      responseType: SubscribeActiveResponse,
      responseStream: true,
      options: {},
    },
    /**
     * Used by gp-cli to ask supervisor to request the active client
     * to run a given command (eg. open or preview)
     */
    notifyActive: {
      name: "NotifyActive",
      requestType: NotifyActiveRequest,
      requestStream: false,
      responseType: NotifyActiveResponse,
      responseStream: false,
      options: {},
    },
    /**
     * Used by the IDE to inform supervisor about the result (eg. success or
     * failure) of the action (eg. open or preview) requested via NotifyActive
     */
    notifyActiveRespond: {
      name: "NotifyActiveRespond",
      requestType: NotifyActiveRespondRequest,
      requestStream: false,
      responseType: NotifyActiveRespondResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface NotificationServiceServiceImplementation<CallContextExt = {}> {
  /**
   * Prompts the user and asks for a decision. Typically called by some external
   * process. If the list of actions is empty this service returns immediately,
   * otherwise it blocks until the user has made their choice.
   */
  notify(request: NotifyRequest, context: CallContext & CallContextExt): Promise<DeepPartial<NotifyResponse>>;
  /** Subscribe to notifications. Typically called by the IDE. */
  subscribe(
    request: SubscribeRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<SubscribeResponse>>;
  /**
   * Report a user's choice as a response to a notification. Typically called by
   * the IDE.
   */
  respond(request: RespondRequest, context: CallContext & CallContextExt): Promise<DeepPartial<RespondResponse>>;
  /**
   * Called by the IDE to inform supervisor about which is the latest client
   * actively used by the user. We consider active the last IDE with focus.
   * Only 1 stream is kept open at any given time. A new subscription
   * overrides the previous one, causing the stream to close.
   * Supervisor will respond with a stream to which the IDE will listen
   * waiting to receive actions to run, for example: `open` or `preview`
   */
  subscribeActive(
    request: SubscribeActiveRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<SubscribeActiveResponse>>;
  /**
   * Used by gp-cli to ask supervisor to request the active client
   * to run a given command (eg. open or preview)
   */
  notifyActive(
    request: NotifyActiveRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<NotifyActiveResponse>>;
  /**
   * Used by the IDE to inform supervisor about the result (eg. success or
   * failure) of the action (eg. open or preview) requested via NotifyActive
   */
  notifyActiveRespond(
    request: NotifyActiveRespondRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<NotifyActiveRespondResponse>>;
}

export interface NotificationServiceClient<CallOptionsExt = {}> {
  /**
   * Prompts the user and asks for a decision. Typically called by some external
   * process. If the list of actions is empty this service returns immediately,
   * otherwise it blocks until the user has made their choice.
   */
  notify(request: DeepPartial<NotifyRequest>, options?: CallOptions & CallOptionsExt): Promise<NotifyResponse>;
  /** Subscribe to notifications. Typically called by the IDE. */
  subscribe(
    request: DeepPartial<SubscribeRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<SubscribeResponse>;
  /**
   * Report a user's choice as a response to a notification. Typically called by
   * the IDE.
   */
  respond(request: DeepPartial<RespondRequest>, options?: CallOptions & CallOptionsExt): Promise<RespondResponse>;
  /**
   * Called by the IDE to inform supervisor about which is the latest client
   * actively used by the user. We consider active the last IDE with focus.
   * Only 1 stream is kept open at any given time. A new subscription
   * overrides the previous one, causing the stream to close.
   * Supervisor will respond with a stream to which the IDE will listen
   * waiting to receive actions to run, for example: `open` or `preview`
   */
  subscribeActive(
    request: DeepPartial<SubscribeActiveRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<SubscribeActiveResponse>;
  /**
   * Used by gp-cli to ask supervisor to request the active client
   * to run a given command (eg. open or preview)
   */
  notifyActive(
    request: DeepPartial<NotifyActiveRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<NotifyActiveResponse>;
  /**
   * Used by the IDE to inform supervisor about the result (eg. success or
   * failure) of the action (eg. open or preview) requested via NotifyActive
   */
  notifyActiveRespond(
    request: DeepPartial<NotifyActiveRespondRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<NotifyActiveRespondResponse>;
}

export interface DataLoaderOptions {
  cache?: boolean;
}

export interface DataLoaders {
  rpcDataLoaderOptions?: DataLoaderOptions;
  getDataLoader<T>(identifier: string, constructorFn: () => T): T;
}

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
var globalThis: any = (() => {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw "Unable to locate global object";
})();

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  return long.toNumber();
}

// If you get a compile-error about 'Constructor<Long> and ... have no overlap',
// add '--ts_proto_opt=esModuleInterop=true' as a flag when calling 'protoc'.
if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
