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

export enum TerminalTitleSource {
  /** process - From the foreground process */
  process = "process",
  /** api - From SetTitle API */
  api = "api",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function terminalTitleSourceFromJSON(object: any): TerminalTitleSource {
  switch (object) {
    case 0:
    case "process":
      return TerminalTitleSource.process;
    case 1:
    case "api":
      return TerminalTitleSource.api;
    case -1:
    case "UNRECOGNIZED":
    default:
      return TerminalTitleSource.UNRECOGNIZED;
  }
}

export function terminalTitleSourceToJSON(object: TerminalTitleSource): string {
  switch (object) {
    case TerminalTitleSource.process:
      return "process";
    case TerminalTitleSource.api:
      return "api";
    case TerminalTitleSource.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function terminalTitleSourceToNumber(object: TerminalTitleSource): number {
  switch (object) {
    case TerminalTitleSource.process:
      return 0;
    case TerminalTitleSource.api:
      return 1;
    case TerminalTitleSource.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface TerminalSize {
  rows: number;
  cols: number;
  widthPx: number;
  heightPx: number;
}

export interface OpenTerminalRequest {
  workdir: string;
  env: { [key: string]: string };
  annotations: { [key: string]: string };
  shell: string;
  shellArgs: string[];
  size: TerminalSize | undefined;
}

export interface OpenTerminalRequest_EnvEntry {
  key: string;
  value: string;
}

export interface OpenTerminalRequest_AnnotationsEntry {
  key: string;
  value: string;
}

export interface OpenTerminalResponse {
  terminal:
    | Terminal
    | undefined;
  /**
   * starter_token can be used to change the terminal size if there are
   * multiple listerns, without having to force your way in.
   */
  starterToken: string;
}

export interface ShutdownTerminalRequest {
  alias: string;
}

export interface ShutdownTerminalResponse {
}

export interface Terminal {
  alias: string;
  command: string[];
  title: string;
  pid: number;
  initialWorkdir: string;
  currentWorkdir: string;
  annotations: { [key: string]: string };
  titleSource: TerminalTitleSource;
}

export interface Terminal_AnnotationsEntry {
  key: string;
  value: string;
}

export interface GetTerminalRequest {
  alias: string;
}

export interface ListTerminalsRequest {
}

export interface ListTerminalsResponse {
  terminals: Terminal[];
}

export interface ListenTerminalRequest {
  alias: string;
}

export interface ListenTerminalResponse {
  data: Uint8Array | undefined;
  exitCode: number | undefined;
  title:
    | string
    | undefined;
  /** only present if output is title */
  titleSource: TerminalTitleSource;
}

export interface WriteTerminalRequest {
  alias: string;
  stdin: Uint8Array;
}

export interface WriteTerminalResponse {
  bytesWritten: number;
}

export interface SetTerminalSizeRequest {
  alias: string;
  token: string | undefined;
  force: boolean | undefined;
  size: TerminalSize | undefined;
}

export interface SetTerminalSizeResponse {
}

export interface SetTerminalTitleRequest {
  alias: string;
  /** omitting title will reset to process title */
  title: string;
}

export interface SetTerminalTitleResponse {
}

export interface UpdateTerminalAnnotationsRequest {
  alias: string;
  /** annotations to create or update */
  changed: { [key: string]: string };
  /** annotations to remove */
  deleted: string[];
}

export interface UpdateTerminalAnnotationsRequest_ChangedEntry {
  key: string;
  value: string;
}

export interface UpdateTerminalAnnotationsResponse {
}

function createBaseTerminalSize(): TerminalSize {
  return { rows: 0, cols: 0, widthPx: 0, heightPx: 0 };
}

export const TerminalSize = {
  encode(message: TerminalSize, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.rows !== 0) {
      writer.uint32(8).uint32(message.rows);
    }
    if (message.cols !== 0) {
      writer.uint32(16).uint32(message.cols);
    }
    if (message.widthPx !== 0) {
      writer.uint32(24).uint32(message.widthPx);
    }
    if (message.heightPx !== 0) {
      writer.uint32(32).uint32(message.heightPx);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TerminalSize {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTerminalSize();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.rows = reader.uint32();
          break;
        case 2:
          message.cols = reader.uint32();
          break;
        case 3:
          message.widthPx = reader.uint32();
          break;
        case 4:
          message.heightPx = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TerminalSize {
    return {
      rows: isSet(object.rows) ? Number(object.rows) : 0,
      cols: isSet(object.cols) ? Number(object.cols) : 0,
      widthPx: isSet(object.widthPx) ? Number(object.widthPx) : 0,
      heightPx: isSet(object.heightPx) ? Number(object.heightPx) : 0,
    };
  },

  toJSON(message: TerminalSize): unknown {
    const obj: any = {};
    message.rows !== undefined && (obj.rows = Math.round(message.rows));
    message.cols !== undefined && (obj.cols = Math.round(message.cols));
    message.widthPx !== undefined && (obj.widthPx = Math.round(message.widthPx));
    message.heightPx !== undefined && (obj.heightPx = Math.round(message.heightPx));
    return obj;
  },

  fromPartial(object: DeepPartial<TerminalSize>): TerminalSize {
    const message = createBaseTerminalSize();
    message.rows = object.rows ?? 0;
    message.cols = object.cols ?? 0;
    message.widthPx = object.widthPx ?? 0;
    message.heightPx = object.heightPx ?? 0;
    return message;
  },
};

function createBaseOpenTerminalRequest(): OpenTerminalRequest {
  return { workdir: "", env: {}, annotations: {}, shell: "", shellArgs: [], size: undefined };
}

export const OpenTerminalRequest = {
  encode(message: OpenTerminalRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.workdir !== "") {
      writer.uint32(10).string(message.workdir);
    }
    Object.entries(message.env).forEach(([key, value]) => {
      OpenTerminalRequest_EnvEntry.encode({ key: key as any, value }, writer.uint32(18).fork()).ldelim();
    });
    Object.entries(message.annotations).forEach(([key, value]) => {
      OpenTerminalRequest_AnnotationsEntry.encode({ key: key as any, value }, writer.uint32(26).fork()).ldelim();
    });
    if (message.shell !== "") {
      writer.uint32(34).string(message.shell);
    }
    for (const v of message.shellArgs) {
      writer.uint32(42).string(v!);
    }
    if (message.size !== undefined) {
      TerminalSize.encode(message.size, writer.uint32(50).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OpenTerminalRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOpenTerminalRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.workdir = reader.string();
          break;
        case 2:
          const entry2 = OpenTerminalRequest_EnvEntry.decode(reader, reader.uint32());
          if (entry2.value !== undefined) {
            message.env[entry2.key] = entry2.value;
          }
          break;
        case 3:
          const entry3 = OpenTerminalRequest_AnnotationsEntry.decode(reader, reader.uint32());
          if (entry3.value !== undefined) {
            message.annotations[entry3.key] = entry3.value;
          }
          break;
        case 4:
          message.shell = reader.string();
          break;
        case 5:
          message.shellArgs.push(reader.string());
          break;
        case 6:
          message.size = TerminalSize.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OpenTerminalRequest {
    return {
      workdir: isSet(object.workdir) ? String(object.workdir) : "",
      env: isObject(object.env)
        ? Object.entries(object.env).reduce<{ [key: string]: string }>((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {})
        : {},
      annotations: isObject(object.annotations)
        ? Object.entries(object.annotations).reduce<{ [key: string]: string }>((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {})
        : {},
      shell: isSet(object.shell) ? String(object.shell) : "",
      shellArgs: Array.isArray(object?.shellArgs) ? object.shellArgs.map((e: any) => String(e)) : [],
      size: isSet(object.size) ? TerminalSize.fromJSON(object.size) : undefined,
    };
  },

  toJSON(message: OpenTerminalRequest): unknown {
    const obj: any = {};
    message.workdir !== undefined && (obj.workdir = message.workdir);
    obj.env = {};
    if (message.env) {
      Object.entries(message.env).forEach(([k, v]) => {
        obj.env[k] = v;
      });
    }
    obj.annotations = {};
    if (message.annotations) {
      Object.entries(message.annotations).forEach(([k, v]) => {
        obj.annotations[k] = v;
      });
    }
    message.shell !== undefined && (obj.shell = message.shell);
    if (message.shellArgs) {
      obj.shellArgs = message.shellArgs.map((e) => e);
    } else {
      obj.shellArgs = [];
    }
    message.size !== undefined && (obj.size = message.size ? TerminalSize.toJSON(message.size) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<OpenTerminalRequest>): OpenTerminalRequest {
    const message = createBaseOpenTerminalRequest();
    message.workdir = object.workdir ?? "";
    message.env = Object.entries(object.env ?? {}).reduce<{ [key: string]: string }>((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = String(value);
      }
      return acc;
    }, {});
    message.annotations = Object.entries(object.annotations ?? {}).reduce<{ [key: string]: string }>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      },
      {},
    );
    message.shell = object.shell ?? "";
    message.shellArgs = object.shellArgs?.map((e) => e) || [];
    message.size = (object.size !== undefined && object.size !== null)
      ? TerminalSize.fromPartial(object.size)
      : undefined;
    return message;
  },
};

function createBaseOpenTerminalRequest_EnvEntry(): OpenTerminalRequest_EnvEntry {
  return { key: "", value: "" };
}

export const OpenTerminalRequest_EnvEntry = {
  encode(message: OpenTerminalRequest_EnvEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OpenTerminalRequest_EnvEntry {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOpenTerminalRequest_EnvEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.key = reader.string();
          break;
        case 2:
          message.value = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OpenTerminalRequest_EnvEntry {
    return { key: isSet(object.key) ? String(object.key) : "", value: isSet(object.value) ? String(object.value) : "" };
  },

  toJSON(message: OpenTerminalRequest_EnvEntry): unknown {
    const obj: any = {};
    message.key !== undefined && (obj.key = message.key);
    message.value !== undefined && (obj.value = message.value);
    return obj;
  },

  fromPartial(object: DeepPartial<OpenTerminalRequest_EnvEntry>): OpenTerminalRequest_EnvEntry {
    const message = createBaseOpenTerminalRequest_EnvEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseOpenTerminalRequest_AnnotationsEntry(): OpenTerminalRequest_AnnotationsEntry {
  return { key: "", value: "" };
}

export const OpenTerminalRequest_AnnotationsEntry = {
  encode(message: OpenTerminalRequest_AnnotationsEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OpenTerminalRequest_AnnotationsEntry {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOpenTerminalRequest_AnnotationsEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.key = reader.string();
          break;
        case 2:
          message.value = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OpenTerminalRequest_AnnotationsEntry {
    return { key: isSet(object.key) ? String(object.key) : "", value: isSet(object.value) ? String(object.value) : "" };
  },

  toJSON(message: OpenTerminalRequest_AnnotationsEntry): unknown {
    const obj: any = {};
    message.key !== undefined && (obj.key = message.key);
    message.value !== undefined && (obj.value = message.value);
    return obj;
  },

  fromPartial(object: DeepPartial<OpenTerminalRequest_AnnotationsEntry>): OpenTerminalRequest_AnnotationsEntry {
    const message = createBaseOpenTerminalRequest_AnnotationsEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseOpenTerminalResponse(): OpenTerminalResponse {
  return { terminal: undefined, starterToken: "" };
}

export const OpenTerminalResponse = {
  encode(message: OpenTerminalResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.terminal !== undefined) {
      Terminal.encode(message.terminal, writer.uint32(10).fork()).ldelim();
    }
    if (message.starterToken !== "") {
      writer.uint32(18).string(message.starterToken);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OpenTerminalResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOpenTerminalResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.terminal = Terminal.decode(reader, reader.uint32());
          break;
        case 2:
          message.starterToken = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OpenTerminalResponse {
    return {
      terminal: isSet(object.terminal) ? Terminal.fromJSON(object.terminal) : undefined,
      starterToken: isSet(object.starterToken) ? String(object.starterToken) : "",
    };
  },

  toJSON(message: OpenTerminalResponse): unknown {
    const obj: any = {};
    message.terminal !== undefined && (obj.terminal = message.terminal ? Terminal.toJSON(message.terminal) : undefined);
    message.starterToken !== undefined && (obj.starterToken = message.starterToken);
    return obj;
  },

  fromPartial(object: DeepPartial<OpenTerminalResponse>): OpenTerminalResponse {
    const message = createBaseOpenTerminalResponse();
    message.terminal = (object.terminal !== undefined && object.terminal !== null)
      ? Terminal.fromPartial(object.terminal)
      : undefined;
    message.starterToken = object.starterToken ?? "";
    return message;
  },
};

function createBaseShutdownTerminalRequest(): ShutdownTerminalRequest {
  return { alias: "" };
}

export const ShutdownTerminalRequest = {
  encode(message: ShutdownTerminalRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ShutdownTerminalRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseShutdownTerminalRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ShutdownTerminalRequest {
    return { alias: isSet(object.alias) ? String(object.alias) : "" };
  },

  toJSON(message: ShutdownTerminalRequest): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    return obj;
  },

  fromPartial(object: DeepPartial<ShutdownTerminalRequest>): ShutdownTerminalRequest {
    const message = createBaseShutdownTerminalRequest();
    message.alias = object.alias ?? "";
    return message;
  },
};

function createBaseShutdownTerminalResponse(): ShutdownTerminalResponse {
  return {};
}

export const ShutdownTerminalResponse = {
  encode(_: ShutdownTerminalResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ShutdownTerminalResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseShutdownTerminalResponse();
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

  fromJSON(_: any): ShutdownTerminalResponse {
    return {};
  },

  toJSON(_: ShutdownTerminalResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ShutdownTerminalResponse>): ShutdownTerminalResponse {
    const message = createBaseShutdownTerminalResponse();
    return message;
  },
};

function createBaseTerminal(): Terminal {
  return {
    alias: "",
    command: [],
    title: "",
    pid: 0,
    initialWorkdir: "",
    currentWorkdir: "",
    annotations: {},
    titleSource: TerminalTitleSource.process,
  };
}

export const Terminal = {
  encode(message: Terminal, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    for (const v of message.command) {
      writer.uint32(18).string(v!);
    }
    if (message.title !== "") {
      writer.uint32(26).string(message.title);
    }
    if (message.pid !== 0) {
      writer.uint32(32).int64(message.pid);
    }
    if (message.initialWorkdir !== "") {
      writer.uint32(42).string(message.initialWorkdir);
    }
    if (message.currentWorkdir !== "") {
      writer.uint32(50).string(message.currentWorkdir);
    }
    Object.entries(message.annotations).forEach(([key, value]) => {
      Terminal_AnnotationsEntry.encode({ key: key as any, value }, writer.uint32(58).fork()).ldelim();
    });
    if (message.titleSource !== TerminalTitleSource.process) {
      writer.uint32(64).int32(terminalTitleSourceToNumber(message.titleSource));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Terminal {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTerminal();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        case 2:
          message.command.push(reader.string());
          break;
        case 3:
          message.title = reader.string();
          break;
        case 4:
          message.pid = longToNumber(reader.int64() as Long);
          break;
        case 5:
          message.initialWorkdir = reader.string();
          break;
        case 6:
          message.currentWorkdir = reader.string();
          break;
        case 7:
          const entry7 = Terminal_AnnotationsEntry.decode(reader, reader.uint32());
          if (entry7.value !== undefined) {
            message.annotations[entry7.key] = entry7.value;
          }
          break;
        case 8:
          message.titleSource = terminalTitleSourceFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Terminal {
    return {
      alias: isSet(object.alias) ? String(object.alias) : "",
      command: Array.isArray(object?.command) ? object.command.map((e: any) => String(e)) : [],
      title: isSet(object.title) ? String(object.title) : "",
      pid: isSet(object.pid) ? Number(object.pid) : 0,
      initialWorkdir: isSet(object.initialWorkdir) ? String(object.initialWorkdir) : "",
      currentWorkdir: isSet(object.currentWorkdir) ? String(object.currentWorkdir) : "",
      annotations: isObject(object.annotations)
        ? Object.entries(object.annotations).reduce<{ [key: string]: string }>((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {})
        : {},
      titleSource: isSet(object.titleSource)
        ? terminalTitleSourceFromJSON(object.titleSource)
        : TerminalTitleSource.process,
    };
  },

  toJSON(message: Terminal): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    if (message.command) {
      obj.command = message.command.map((e) => e);
    } else {
      obj.command = [];
    }
    message.title !== undefined && (obj.title = message.title);
    message.pid !== undefined && (obj.pid = Math.round(message.pid));
    message.initialWorkdir !== undefined && (obj.initialWorkdir = message.initialWorkdir);
    message.currentWorkdir !== undefined && (obj.currentWorkdir = message.currentWorkdir);
    obj.annotations = {};
    if (message.annotations) {
      Object.entries(message.annotations).forEach(([k, v]) => {
        obj.annotations[k] = v;
      });
    }
    message.titleSource !== undefined && (obj.titleSource = terminalTitleSourceToJSON(message.titleSource));
    return obj;
  },

  fromPartial(object: DeepPartial<Terminal>): Terminal {
    const message = createBaseTerminal();
    message.alias = object.alias ?? "";
    message.command = object.command?.map((e) => e) || [];
    message.title = object.title ?? "";
    message.pid = object.pid ?? 0;
    message.initialWorkdir = object.initialWorkdir ?? "";
    message.currentWorkdir = object.currentWorkdir ?? "";
    message.annotations = Object.entries(object.annotations ?? {}).reduce<{ [key: string]: string }>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      },
      {},
    );
    message.titleSource = object.titleSource ?? TerminalTitleSource.process;
    return message;
  },
};

function createBaseTerminal_AnnotationsEntry(): Terminal_AnnotationsEntry {
  return { key: "", value: "" };
}

export const Terminal_AnnotationsEntry = {
  encode(message: Terminal_AnnotationsEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Terminal_AnnotationsEntry {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTerminal_AnnotationsEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.key = reader.string();
          break;
        case 2:
          message.value = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Terminal_AnnotationsEntry {
    return { key: isSet(object.key) ? String(object.key) : "", value: isSet(object.value) ? String(object.value) : "" };
  },

  toJSON(message: Terminal_AnnotationsEntry): unknown {
    const obj: any = {};
    message.key !== undefined && (obj.key = message.key);
    message.value !== undefined && (obj.value = message.value);
    return obj;
  },

  fromPartial(object: DeepPartial<Terminal_AnnotationsEntry>): Terminal_AnnotationsEntry {
    const message = createBaseTerminal_AnnotationsEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseGetTerminalRequest(): GetTerminalRequest {
  return { alias: "" };
}

export const GetTerminalRequest = {
  encode(message: GetTerminalRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetTerminalRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetTerminalRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetTerminalRequest {
    return { alias: isSet(object.alias) ? String(object.alias) : "" };
  },

  toJSON(message: GetTerminalRequest): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    return obj;
  },

  fromPartial(object: DeepPartial<GetTerminalRequest>): GetTerminalRequest {
    const message = createBaseGetTerminalRequest();
    message.alias = object.alias ?? "";
    return message;
  },
};

function createBaseListTerminalsRequest(): ListTerminalsRequest {
  return {};
}

export const ListTerminalsRequest = {
  encode(_: ListTerminalsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListTerminalsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListTerminalsRequest();
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

  fromJSON(_: any): ListTerminalsRequest {
    return {};
  },

  toJSON(_: ListTerminalsRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ListTerminalsRequest>): ListTerminalsRequest {
    const message = createBaseListTerminalsRequest();
    return message;
  },
};

function createBaseListTerminalsResponse(): ListTerminalsResponse {
  return { terminals: [] };
}

export const ListTerminalsResponse = {
  encode(message: ListTerminalsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.terminals) {
      Terminal.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListTerminalsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListTerminalsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.terminals.push(Terminal.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListTerminalsResponse {
    return {
      terminals: Array.isArray(object?.terminals) ? object.terminals.map((e: any) => Terminal.fromJSON(e)) : [],
    };
  },

  toJSON(message: ListTerminalsResponse): unknown {
    const obj: any = {};
    if (message.terminals) {
      obj.terminals = message.terminals.map((e) => e ? Terminal.toJSON(e) : undefined);
    } else {
      obj.terminals = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<ListTerminalsResponse>): ListTerminalsResponse {
    const message = createBaseListTerminalsResponse();
    message.terminals = object.terminals?.map((e) => Terminal.fromPartial(e)) || [];
    return message;
  },
};

function createBaseListenTerminalRequest(): ListenTerminalRequest {
  return { alias: "" };
}

export const ListenTerminalRequest = {
  encode(message: ListenTerminalRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListenTerminalRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListenTerminalRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListenTerminalRequest {
    return { alias: isSet(object.alias) ? String(object.alias) : "" };
  },

  toJSON(message: ListenTerminalRequest): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    return obj;
  },

  fromPartial(object: DeepPartial<ListenTerminalRequest>): ListenTerminalRequest {
    const message = createBaseListenTerminalRequest();
    message.alias = object.alias ?? "";
    return message;
  },
};

function createBaseListenTerminalResponse(): ListenTerminalResponse {
  return { data: undefined, exitCode: undefined, title: undefined, titleSource: TerminalTitleSource.process };
}

export const ListenTerminalResponse = {
  encode(message: ListenTerminalResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.data !== undefined) {
      writer.uint32(10).bytes(message.data);
    }
    if (message.exitCode !== undefined) {
      writer.uint32(16).int32(message.exitCode);
    }
    if (message.title !== undefined) {
      writer.uint32(26).string(message.title);
    }
    if (message.titleSource !== TerminalTitleSource.process) {
      writer.uint32(32).int32(terminalTitleSourceToNumber(message.titleSource));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListenTerminalResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListenTerminalResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.data = reader.bytes();
          break;
        case 2:
          message.exitCode = reader.int32();
          break;
        case 3:
          message.title = reader.string();
          break;
        case 4:
          message.titleSource = terminalTitleSourceFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListenTerminalResponse {
    return {
      data: isSet(object.data) ? bytesFromBase64(object.data) : undefined,
      exitCode: isSet(object.exitCode) ? Number(object.exitCode) : undefined,
      title: isSet(object.title) ? String(object.title) : undefined,
      titleSource: isSet(object.titleSource)
        ? terminalTitleSourceFromJSON(object.titleSource)
        : TerminalTitleSource.process,
    };
  },

  toJSON(message: ListenTerminalResponse): unknown {
    const obj: any = {};
    message.data !== undefined && (obj.data = message.data !== undefined ? base64FromBytes(message.data) : undefined);
    message.exitCode !== undefined && (obj.exitCode = Math.round(message.exitCode));
    message.title !== undefined && (obj.title = message.title);
    message.titleSource !== undefined && (obj.titleSource = terminalTitleSourceToJSON(message.titleSource));
    return obj;
  },

  fromPartial(object: DeepPartial<ListenTerminalResponse>): ListenTerminalResponse {
    const message = createBaseListenTerminalResponse();
    message.data = object.data ?? undefined;
    message.exitCode = object.exitCode ?? undefined;
    message.title = object.title ?? undefined;
    message.titleSource = object.titleSource ?? TerminalTitleSource.process;
    return message;
  },
};

function createBaseWriteTerminalRequest(): WriteTerminalRequest {
  return { alias: "", stdin: new Uint8Array() };
}

export const WriteTerminalRequest = {
  encode(message: WriteTerminalRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    if (message.stdin.length !== 0) {
      writer.uint32(18).bytes(message.stdin);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WriteTerminalRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWriteTerminalRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        case 2:
          message.stdin = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteTerminalRequest {
    return {
      alias: isSet(object.alias) ? String(object.alias) : "",
      stdin: isSet(object.stdin) ? bytesFromBase64(object.stdin) : new Uint8Array(),
    };
  },

  toJSON(message: WriteTerminalRequest): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    message.stdin !== undefined &&
      (obj.stdin = base64FromBytes(message.stdin !== undefined ? message.stdin : new Uint8Array()));
    return obj;
  },

  fromPartial(object: DeepPartial<WriteTerminalRequest>): WriteTerminalRequest {
    const message = createBaseWriteTerminalRequest();
    message.alias = object.alias ?? "";
    message.stdin = object.stdin ?? new Uint8Array();
    return message;
  },
};

function createBaseWriteTerminalResponse(): WriteTerminalResponse {
  return { bytesWritten: 0 };
}

export const WriteTerminalResponse = {
  encode(message: WriteTerminalResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.bytesWritten !== 0) {
      writer.uint32(8).uint32(message.bytesWritten);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WriteTerminalResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseWriteTerminalResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bytesWritten = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): WriteTerminalResponse {
    return { bytesWritten: isSet(object.bytesWritten) ? Number(object.bytesWritten) : 0 };
  },

  toJSON(message: WriteTerminalResponse): unknown {
    const obj: any = {};
    message.bytesWritten !== undefined && (obj.bytesWritten = Math.round(message.bytesWritten));
    return obj;
  },

  fromPartial(object: DeepPartial<WriteTerminalResponse>): WriteTerminalResponse {
    const message = createBaseWriteTerminalResponse();
    message.bytesWritten = object.bytesWritten ?? 0;
    return message;
  },
};

function createBaseSetTerminalSizeRequest(): SetTerminalSizeRequest {
  return { alias: "", token: undefined, force: undefined, size: undefined };
}

export const SetTerminalSizeRequest = {
  encode(message: SetTerminalSizeRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    if (message.token !== undefined) {
      writer.uint32(18).string(message.token);
    }
    if (message.force !== undefined) {
      writer.uint32(24).bool(message.force);
    }
    if (message.size !== undefined) {
      TerminalSize.encode(message.size, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTerminalSizeRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTerminalSizeRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        case 2:
          message.token = reader.string();
          break;
        case 3:
          message.force = reader.bool();
          break;
        case 4:
          message.size = TerminalSize.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetTerminalSizeRequest {
    return {
      alias: isSet(object.alias) ? String(object.alias) : "",
      token: isSet(object.token) ? String(object.token) : undefined,
      force: isSet(object.force) ? Boolean(object.force) : undefined,
      size: isSet(object.size) ? TerminalSize.fromJSON(object.size) : undefined,
    };
  },

  toJSON(message: SetTerminalSizeRequest): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    message.token !== undefined && (obj.token = message.token);
    message.force !== undefined && (obj.force = message.force);
    message.size !== undefined && (obj.size = message.size ? TerminalSize.toJSON(message.size) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<SetTerminalSizeRequest>): SetTerminalSizeRequest {
    const message = createBaseSetTerminalSizeRequest();
    message.alias = object.alias ?? "";
    message.token = object.token ?? undefined;
    message.force = object.force ?? undefined;
    message.size = (object.size !== undefined && object.size !== null)
      ? TerminalSize.fromPartial(object.size)
      : undefined;
    return message;
  },
};

function createBaseSetTerminalSizeResponse(): SetTerminalSizeResponse {
  return {};
}

export const SetTerminalSizeResponse = {
  encode(_: SetTerminalSizeResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTerminalSizeResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTerminalSizeResponse();
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

  fromJSON(_: any): SetTerminalSizeResponse {
    return {};
  },

  toJSON(_: SetTerminalSizeResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<SetTerminalSizeResponse>): SetTerminalSizeResponse {
    const message = createBaseSetTerminalSizeResponse();
    return message;
  },
};

function createBaseSetTerminalTitleRequest(): SetTerminalTitleRequest {
  return { alias: "", title: "" };
}

export const SetTerminalTitleRequest = {
  encode(message: SetTerminalTitleRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    if (message.title !== "") {
      writer.uint32(18).string(message.title);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTerminalTitleRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTerminalTitleRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        case 2:
          message.title = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetTerminalTitleRequest {
    return {
      alias: isSet(object.alias) ? String(object.alias) : "",
      title: isSet(object.title) ? String(object.title) : "",
    };
  },

  toJSON(message: SetTerminalTitleRequest): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    message.title !== undefined && (obj.title = message.title);
    return obj;
  },

  fromPartial(object: DeepPartial<SetTerminalTitleRequest>): SetTerminalTitleRequest {
    const message = createBaseSetTerminalTitleRequest();
    message.alias = object.alias ?? "";
    message.title = object.title ?? "";
    return message;
  },
};

function createBaseSetTerminalTitleResponse(): SetTerminalTitleResponse {
  return {};
}

export const SetTerminalTitleResponse = {
  encode(_: SetTerminalTitleResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTerminalTitleResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTerminalTitleResponse();
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

  fromJSON(_: any): SetTerminalTitleResponse {
    return {};
  },

  toJSON(_: SetTerminalTitleResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<SetTerminalTitleResponse>): SetTerminalTitleResponse {
    const message = createBaseSetTerminalTitleResponse();
    return message;
  },
};

function createBaseUpdateTerminalAnnotationsRequest(): UpdateTerminalAnnotationsRequest {
  return { alias: "", changed: {}, deleted: [] };
}

export const UpdateTerminalAnnotationsRequest = {
  encode(message: UpdateTerminalAnnotationsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== "") {
      writer.uint32(10).string(message.alias);
    }
    Object.entries(message.changed).forEach(([key, value]) => {
      UpdateTerminalAnnotationsRequest_ChangedEntry.encode({ key: key as any, value }, writer.uint32(18).fork())
        .ldelim();
    });
    for (const v of message.deleted) {
      writer.uint32(26).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateTerminalAnnotationsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateTerminalAnnotationsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.alias = reader.string();
          break;
        case 2:
          const entry2 = UpdateTerminalAnnotationsRequest_ChangedEntry.decode(reader, reader.uint32());
          if (entry2.value !== undefined) {
            message.changed[entry2.key] = entry2.value;
          }
          break;
        case 3:
          message.deleted.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateTerminalAnnotationsRequest {
    return {
      alias: isSet(object.alias) ? String(object.alias) : "",
      changed: isObject(object.changed)
        ? Object.entries(object.changed).reduce<{ [key: string]: string }>((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {})
        : {},
      deleted: Array.isArray(object?.deleted) ? object.deleted.map((e: any) => String(e)) : [],
    };
  },

  toJSON(message: UpdateTerminalAnnotationsRequest): unknown {
    const obj: any = {};
    message.alias !== undefined && (obj.alias = message.alias);
    obj.changed = {};
    if (message.changed) {
      Object.entries(message.changed).forEach(([k, v]) => {
        obj.changed[k] = v;
      });
    }
    if (message.deleted) {
      obj.deleted = message.deleted.map((e) => e);
    } else {
      obj.deleted = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<UpdateTerminalAnnotationsRequest>): UpdateTerminalAnnotationsRequest {
    const message = createBaseUpdateTerminalAnnotationsRequest();
    message.alias = object.alias ?? "";
    message.changed = Object.entries(object.changed ?? {}).reduce<{ [key: string]: string }>((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = String(value);
      }
      return acc;
    }, {});
    message.deleted = object.deleted?.map((e) => e) || [];
    return message;
  },
};

function createBaseUpdateTerminalAnnotationsRequest_ChangedEntry(): UpdateTerminalAnnotationsRequest_ChangedEntry {
  return { key: "", value: "" };
}

export const UpdateTerminalAnnotationsRequest_ChangedEntry = {
  encode(message: UpdateTerminalAnnotationsRequest_ChangedEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateTerminalAnnotationsRequest_ChangedEntry {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateTerminalAnnotationsRequest_ChangedEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.key = reader.string();
          break;
        case 2:
          message.value = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateTerminalAnnotationsRequest_ChangedEntry {
    return { key: isSet(object.key) ? String(object.key) : "", value: isSet(object.value) ? String(object.value) : "" };
  },

  toJSON(message: UpdateTerminalAnnotationsRequest_ChangedEntry): unknown {
    const obj: any = {};
    message.key !== undefined && (obj.key = message.key);
    message.value !== undefined && (obj.value = message.value);
    return obj;
  },

  fromPartial(
    object: DeepPartial<UpdateTerminalAnnotationsRequest_ChangedEntry>,
  ): UpdateTerminalAnnotationsRequest_ChangedEntry {
    const message = createBaseUpdateTerminalAnnotationsRequest_ChangedEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseUpdateTerminalAnnotationsResponse(): UpdateTerminalAnnotationsResponse {
  return {};
}

export const UpdateTerminalAnnotationsResponse = {
  encode(_: UpdateTerminalAnnotationsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateTerminalAnnotationsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateTerminalAnnotationsResponse();
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

  fromJSON(_: any): UpdateTerminalAnnotationsResponse {
    return {};
  },

  toJSON(_: UpdateTerminalAnnotationsResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<UpdateTerminalAnnotationsResponse>): UpdateTerminalAnnotationsResponse {
    const message = createBaseUpdateTerminalAnnotationsResponse();
    return message;
  },
};

export type TerminalServiceDefinition = typeof TerminalServiceDefinition;
export const TerminalServiceDefinition = {
  name: "TerminalService",
  fullName: "supervisor.TerminalService",
  methods: {
    /** Open opens a new terminal running the login shell */
    open: {
      name: "Open",
      requestType: OpenTerminalRequest,
      requestStream: false,
      responseType: OpenTerminalResponse,
      responseStream: false,
      options: {},
    },
    /**
     * Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
     * before closing the pseudo-terminal.
     */
    shutdown: {
      name: "Shutdown",
      requestType: ShutdownTerminalRequest,
      requestStream: false,
      responseType: ShutdownTerminalResponse,
      responseStream: false,
      options: {},
    },
    /** Get returns an opened terminal info */
    get: {
      name: "Get",
      requestType: GetTerminalRequest,
      requestStream: false,
      responseType: Terminal,
      responseStream: false,
      options: {},
    },
    /** List lists all open terminals */
    list: {
      name: "List",
      requestType: ListTerminalsRequest,
      requestStream: false,
      responseType: ListTerminalsResponse,
      responseStream: false,
      options: {},
    },
    /** Listen listens to a terminal */
    listen: {
      name: "Listen",
      requestType: ListenTerminalRequest,
      requestStream: false,
      responseType: ListenTerminalResponse,
      responseStream: true,
      options: {},
    },
    /** Write writes to a terminal */
    write: {
      name: "Write",
      requestType: WriteTerminalRequest,
      requestStream: false,
      responseType: WriteTerminalResponse,
      responseStream: false,
      options: {},
    },
    /** SetSize sets the terminal's size */
    setSize: {
      name: "SetSize",
      requestType: SetTerminalSizeRequest,
      requestStream: false,
      responseType: SetTerminalSizeResponse,
      responseStream: false,
      options: {},
    },
    /** SetTitle sets the terminal's title */
    setTitle: {
      name: "SetTitle",
      requestType: SetTerminalTitleRequest,
      requestStream: false,
      responseType: SetTerminalTitleResponse,
      responseStream: false,
      options: {},
    },
    /** UpdateAnnotations updates the terminal's annotations */
    updateAnnotations: {
      name: "UpdateAnnotations",
      requestType: UpdateTerminalAnnotationsRequest,
      requestStream: false,
      responseType: UpdateTerminalAnnotationsResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface TerminalServiceServiceImplementation<CallContextExt = {}> {
  /** Open opens a new terminal running the login shell */
  open(request: OpenTerminalRequest, context: CallContext & CallContextExt): Promise<DeepPartial<OpenTerminalResponse>>;
  /**
   * Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
   * before closing the pseudo-terminal.
   */
  shutdown(
    request: ShutdownTerminalRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ShutdownTerminalResponse>>;
  /** Get returns an opened terminal info */
  get(request: GetTerminalRequest, context: CallContext & CallContextExt): Promise<DeepPartial<Terminal>>;
  /** List lists all open terminals */
  list(
    request: ListTerminalsRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ListTerminalsResponse>>;
  /** Listen listens to a terminal */
  listen(
    request: ListenTerminalRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<ListenTerminalResponse>>;
  /** Write writes to a terminal */
  write(
    request: WriteTerminalRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<WriteTerminalResponse>>;
  /** SetSize sets the terminal's size */
  setSize(
    request: SetTerminalSizeRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<SetTerminalSizeResponse>>;
  /** SetTitle sets the terminal's title */
  setTitle(
    request: SetTerminalTitleRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<SetTerminalTitleResponse>>;
  /** UpdateAnnotations updates the terminal's annotations */
  updateAnnotations(
    request: UpdateTerminalAnnotationsRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<UpdateTerminalAnnotationsResponse>>;
}

export interface TerminalServiceClient<CallOptionsExt = {}> {
  /** Open opens a new terminal running the login shell */
  open(
    request: DeepPartial<OpenTerminalRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<OpenTerminalResponse>;
  /**
   * Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
   * before closing the pseudo-terminal.
   */
  shutdown(
    request: DeepPartial<ShutdownTerminalRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ShutdownTerminalResponse>;
  /** Get returns an opened terminal info */
  get(request: DeepPartial<GetTerminalRequest>, options?: CallOptions & CallOptionsExt): Promise<Terminal>;
  /** List lists all open terminals */
  list(
    request: DeepPartial<ListTerminalsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ListTerminalsResponse>;
  /** Listen listens to a terminal */
  listen(
    request: DeepPartial<ListenTerminalRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<ListenTerminalResponse>;
  /** Write writes to a terminal */
  write(
    request: DeepPartial<WriteTerminalRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<WriteTerminalResponse>;
  /** SetSize sets the terminal's size */
  setSize(
    request: DeepPartial<SetTerminalSizeRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<SetTerminalSizeResponse>;
  /** SetTitle sets the terminal's title */
  setTitle(
    request: DeepPartial<SetTerminalTitleRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<SetTerminalTitleResponse>;
  /** UpdateAnnotations updates the terminal's annotations */
  updateAnnotations(
    request: DeepPartial<UpdateTerminalAnnotationsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<UpdateTerminalAnnotationsResponse>;
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

function bytesFromBase64(b64: string): Uint8Array {
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin: string[] = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

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

function isObject(value: any): boolean {
  return typeof value === "object" && value !== null;
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
