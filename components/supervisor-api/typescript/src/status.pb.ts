/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { TunnelVisiblity, tunnelVisiblityFromJSON, tunnelVisiblityToJSON, tunnelVisiblityToNumber } from "./port.pb";

export const protobufPackage = "supervisor";

export enum ContentSource {
  from_other = "from_other",
  from_backup = "from_backup",
  from_prebuild = "from_prebuild",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function contentSourceFromJSON(object: any): ContentSource {
  switch (object) {
    case 0:
    case "from_other":
      return ContentSource.from_other;
    case 1:
    case "from_backup":
      return ContentSource.from_backup;
    case 2:
    case "from_prebuild":
      return ContentSource.from_prebuild;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ContentSource.UNRECOGNIZED;
  }
}

export function contentSourceToJSON(object: ContentSource): string {
  switch (object) {
    case ContentSource.from_other:
      return "from_other";
    case ContentSource.from_backup:
      return "from_backup";
    case ContentSource.from_prebuild:
      return "from_prebuild";
    case ContentSource.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function contentSourceToNumber(object: ContentSource): number {
  switch (object) {
    case ContentSource.from_other:
      return 0;
    case ContentSource.from_backup:
      return 1;
    case ContentSource.from_prebuild:
      return 2;
    case ContentSource.UNRECOGNIZED:
    default:
      return -1;
  }
}

export enum PortVisibility {
  private = "private",
  public = "public",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function portVisibilityFromJSON(object: any): PortVisibility {
  switch (object) {
    case 0:
    case "private":
      return PortVisibility.private;
    case 1:
    case "public":
      return PortVisibility.public;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PortVisibility.UNRECOGNIZED;
  }
}

export function portVisibilityToJSON(object: PortVisibility): string {
  switch (object) {
    case PortVisibility.private:
      return "private";
    case PortVisibility.public:
      return "public";
    case PortVisibility.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function portVisibilityToNumber(object: PortVisibility): number {
  switch (object) {
    case PortVisibility.private:
      return 0;
    case PortVisibility.public:
      return 1;
    case PortVisibility.UNRECOGNIZED:
    default:
      return -1;
  }
}

/** DEPRECATED(use PortsStatus.OnOpenAction) */
export enum OnPortExposedAction {
  ignore = "ignore",
  open_browser = "open_browser",
  open_preview = "open_preview",
  notify = "notify",
  notify_private = "notify_private",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function onPortExposedActionFromJSON(object: any): OnPortExposedAction {
  switch (object) {
    case 0:
    case "ignore":
      return OnPortExposedAction.ignore;
    case 1:
    case "open_browser":
      return OnPortExposedAction.open_browser;
    case 2:
    case "open_preview":
      return OnPortExposedAction.open_preview;
    case 3:
    case "notify":
      return OnPortExposedAction.notify;
    case 4:
    case "notify_private":
      return OnPortExposedAction.notify_private;
    case -1:
    case "UNRECOGNIZED":
    default:
      return OnPortExposedAction.UNRECOGNIZED;
  }
}

export function onPortExposedActionToJSON(object: OnPortExposedAction): string {
  switch (object) {
    case OnPortExposedAction.ignore:
      return "ignore";
    case OnPortExposedAction.open_browser:
      return "open_browser";
    case OnPortExposedAction.open_preview:
      return "open_preview";
    case OnPortExposedAction.notify:
      return "notify";
    case OnPortExposedAction.notify_private:
      return "notify_private";
    case OnPortExposedAction.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function onPortExposedActionToNumber(object: OnPortExposedAction): number {
  switch (object) {
    case OnPortExposedAction.ignore:
      return 0;
    case OnPortExposedAction.open_browser:
      return 1;
    case OnPortExposedAction.open_preview:
      return 2;
    case OnPortExposedAction.notify:
      return 3;
    case OnPortExposedAction.notify_private:
      return 4;
    case OnPortExposedAction.UNRECOGNIZED:
    default:
      return -1;
  }
}

export enum PortAutoExposure {
  trying = "trying",
  succeeded = "succeeded",
  failed = "failed",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function portAutoExposureFromJSON(object: any): PortAutoExposure {
  switch (object) {
    case 0:
    case "trying":
      return PortAutoExposure.trying;
    case 1:
    case "succeeded":
      return PortAutoExposure.succeeded;
    case 2:
    case "failed":
      return PortAutoExposure.failed;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PortAutoExposure.UNRECOGNIZED;
  }
}

export function portAutoExposureToJSON(object: PortAutoExposure): string {
  switch (object) {
    case PortAutoExposure.trying:
      return "trying";
    case PortAutoExposure.succeeded:
      return "succeeded";
    case PortAutoExposure.failed:
      return "failed";
    case PortAutoExposure.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function portAutoExposureToNumber(object: PortAutoExposure): number {
  switch (object) {
    case PortAutoExposure.trying:
      return 0;
    case PortAutoExposure.succeeded:
      return 1;
    case PortAutoExposure.failed:
      return 2;
    case PortAutoExposure.UNRECOGNIZED:
    default:
      return -1;
  }
}

export enum TaskState {
  opening = "opening",
  running = "running",
  closed = "closed",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function taskStateFromJSON(object: any): TaskState {
  switch (object) {
    case 0:
    case "opening":
      return TaskState.opening;
    case 1:
    case "running":
      return TaskState.running;
    case 2:
    case "closed":
      return TaskState.closed;
    case -1:
    case "UNRECOGNIZED":
    default:
      return TaskState.UNRECOGNIZED;
  }
}

export function taskStateToJSON(object: TaskState): string {
  switch (object) {
    case TaskState.opening:
      return "opening";
    case TaskState.running:
      return "running";
    case TaskState.closed:
      return "closed";
    case TaskState.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function taskStateToNumber(object: TaskState): number {
  switch (object) {
    case TaskState.opening:
      return 0;
    case TaskState.running:
      return 1;
    case TaskState.closed:
      return 2;
    case TaskState.UNRECOGNIZED:
    default:
      return -1;
  }
}

export enum ResourceStatusSeverity {
  normal = "normal",
  warning = "warning",
  danger = "danger",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function resourceStatusSeverityFromJSON(object: any): ResourceStatusSeverity {
  switch (object) {
    case 0:
    case "normal":
      return ResourceStatusSeverity.normal;
    case 1:
    case "warning":
      return ResourceStatusSeverity.warning;
    case 2:
    case "danger":
      return ResourceStatusSeverity.danger;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ResourceStatusSeverity.UNRECOGNIZED;
  }
}

export function resourceStatusSeverityToJSON(object: ResourceStatusSeverity): string {
  switch (object) {
    case ResourceStatusSeverity.normal:
      return "normal";
    case ResourceStatusSeverity.warning:
      return "warning";
    case ResourceStatusSeverity.danger:
      return "danger";
    case ResourceStatusSeverity.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function resourceStatusSeverityToNumber(object: ResourceStatusSeverity): number {
  switch (object) {
    case ResourceStatusSeverity.normal:
      return 0;
    case ResourceStatusSeverity.warning:
      return 1;
    case ResourceStatusSeverity.danger:
      return 2;
    case ResourceStatusSeverity.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface SupervisorStatusRequest {
  /** if true this request will return either when it times out or when the supervisor is about to shutdown. */
  willShutdown: boolean;
}

export interface SupervisorStatusResponse {
  ok: boolean;
}

export interface IDEStatusRequest {
  /**
   * if true this request will return either when it times out or when the workspace IDE
   * has become available.
   */
  wait: boolean;
}

export interface IDEStatusResponse {
  ok: boolean;
  desktop: IDEStatusResponse_DesktopStatus | undefined;
}

export interface IDEStatusResponse_DesktopStatus {
  link: string;
  label: string;
  clientID: string;
  kind: string;
}

export interface ContentStatusRequest {
  /**
   * if true this request will return either when it times out or when the workspace content
   * has become available.
   */
  wait: boolean;
}

export interface ContentStatusResponse {
  /** true if the workspace content is available */
  available: boolean;
  /** source indicates where the workspace content came from */
  source: ContentSource;
}

export interface BackupStatusRequest {
}

export interface BackupStatusResponse {
  canaryAvailable: boolean;
}

export interface PortsStatusRequest {
  /**
   * if observe is true, we'll return a stream of changes rather than just the
   * current state of affairs.
   */
  observe: boolean;
}

export interface PortsStatusResponse {
  ports: PortsStatus[];
}

export interface ExposedPortInfo {
  /** public determines if the port is available without authentication or not */
  visibility: PortVisibility;
  /** url is the URL at which the port is available */
  url: string;
  /**
   * DEPRECATED(use PortsStatus.on_open instead): action hint on expose
   *
   * @deprecated
   */
  onExposed: OnPortExposedAction;
}

export interface TunneledPortInfo {
  /** target port is the desired port on the remote machine */
  targetPort: number;
  /**
   * visibility determines if the listener on remote machine should accept connections from localhost or network
   * visibility none means that the port should not be tunneled
   */
  visibility: TunnelVisiblity;
  /** map of remote clients indicates on which remote port each client is listening to */
  clients: { [key: string]: number };
}

export interface TunneledPortInfo_ClientsEntry {
  key: string;
  value: number;
}

export interface PortsStatus {
  /**
   * local_port is the port a service actually bound to. Some services bind
   * to localhost:<port>, in which case they cannot be made accessible from
   * outside the container. To help with this, supervisor then starts a proxy
   * that forwards traffic to this local port. In those cases, global_port
   * contains the port where the proxy is listening on.
   */
  localPort: number;
  /** served is true if there is a process in the workspace that serves this port. */
  served: boolean;
  /**
   * Exposed provides information when a port is exposed. If this field isn't set,
   * the port is not available from outside the workspace (i.e. the internet).
   */
  exposed:
    | ExposedPortInfo
    | undefined;
  /** AutoExposure indicates the state of auto exposure */
  autoExposure: PortAutoExposure;
  /**
   * Tunneled provides information when a port is tunneled. If not present then
   * the port is not tunneled.
   */
  tunneled:
    | TunneledPortInfo
    | undefined;
  /** Port description, obtained from Gitpod PortConfig. */
  description: string;
  /** Port name, obtained from Gitpod PortConfig. */
  name: string;
  /** Action hint on open */
  onOpen: PortsStatus_OnOpenAction;
}

export enum PortsStatus_OnOpenAction {
  ignore = "ignore",
  open_browser = "open_browser",
  open_preview = "open_preview",
  notify = "notify",
  notify_private = "notify_private",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function portsStatus_OnOpenActionFromJSON(object: any): PortsStatus_OnOpenAction {
  switch (object) {
    case 0:
    case "ignore":
      return PortsStatus_OnOpenAction.ignore;
    case 1:
    case "open_browser":
      return PortsStatus_OnOpenAction.open_browser;
    case 2:
    case "open_preview":
      return PortsStatus_OnOpenAction.open_preview;
    case 3:
    case "notify":
      return PortsStatus_OnOpenAction.notify;
    case 4:
    case "notify_private":
      return PortsStatus_OnOpenAction.notify_private;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PortsStatus_OnOpenAction.UNRECOGNIZED;
  }
}

export function portsStatus_OnOpenActionToJSON(object: PortsStatus_OnOpenAction): string {
  switch (object) {
    case PortsStatus_OnOpenAction.ignore:
      return "ignore";
    case PortsStatus_OnOpenAction.open_browser:
      return "open_browser";
    case PortsStatus_OnOpenAction.open_preview:
      return "open_preview";
    case PortsStatus_OnOpenAction.notify:
      return "notify";
    case PortsStatus_OnOpenAction.notify_private:
      return "notify_private";
    case PortsStatus_OnOpenAction.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function portsStatus_OnOpenActionToNumber(object: PortsStatus_OnOpenAction): number {
  switch (object) {
    case PortsStatus_OnOpenAction.ignore:
      return 0;
    case PortsStatus_OnOpenAction.open_browser:
      return 1;
    case PortsStatus_OnOpenAction.open_preview:
      return 2;
    case PortsStatus_OnOpenAction.notify:
      return 3;
    case PortsStatus_OnOpenAction.notify_private:
      return 4;
    case PortsStatus_OnOpenAction.UNRECOGNIZED:
    default:
      return -1;
  }
}

export interface TasksStatusRequest {
  /**
   * if observe is true, we'll return a stream of changes rather than just the
   * current state of affairs.
   */
  observe: boolean;
}

export interface TasksStatusResponse {
  tasks: TaskStatus[];
}

export interface TaskStatus {
  id: string;
  state: TaskState;
  terminal: string;
  presentation: TaskPresentation | undefined;
}

export interface TaskPresentation {
  name: string;
  openIn: string;
  openMode: string;
}

export interface ResourcesStatuRequest {
}

export interface ResourcesStatusResponse {
  /** Used memory and limit in bytes */
  memory:
    | ResourceStatus
    | undefined;
  /** Used CPU and limit in millicores. */
  cpu: ResourceStatus | undefined;
}

export interface ResourceStatus {
  used: number;
  limit: number;
  severity: ResourceStatusSeverity;
}

function createBaseSupervisorStatusRequest(): SupervisorStatusRequest {
  return { willShutdown: false };
}

export const SupervisorStatusRequest = {
  encode(message: SupervisorStatusRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.willShutdown === true) {
      writer.uint32(8).bool(message.willShutdown);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SupervisorStatusRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSupervisorStatusRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.willShutdown = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SupervisorStatusRequest {
    return { willShutdown: isSet(object.willShutdown) ? Boolean(object.willShutdown) : false };
  },

  toJSON(message: SupervisorStatusRequest): unknown {
    const obj: any = {};
    message.willShutdown !== undefined && (obj.willShutdown = message.willShutdown);
    return obj;
  },

  fromPartial(object: DeepPartial<SupervisorStatusRequest>): SupervisorStatusRequest {
    const message = createBaseSupervisorStatusRequest();
    message.willShutdown = object.willShutdown ?? false;
    return message;
  },
};

function createBaseSupervisorStatusResponse(): SupervisorStatusResponse {
  return { ok: false };
}

export const SupervisorStatusResponse = {
  encode(message: SupervisorStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.ok === true) {
      writer.uint32(8).bool(message.ok);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SupervisorStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSupervisorStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.ok = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SupervisorStatusResponse {
    return { ok: isSet(object.ok) ? Boolean(object.ok) : false };
  },

  toJSON(message: SupervisorStatusResponse): unknown {
    const obj: any = {};
    message.ok !== undefined && (obj.ok = message.ok);
    return obj;
  },

  fromPartial(object: DeepPartial<SupervisorStatusResponse>): SupervisorStatusResponse {
    const message = createBaseSupervisorStatusResponse();
    message.ok = object.ok ?? false;
    return message;
  },
};

function createBaseIDEStatusRequest(): IDEStatusRequest {
  return { wait: false };
}

export const IDEStatusRequest = {
  encode(message: IDEStatusRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.wait === true) {
      writer.uint32(8).bool(message.wait);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): IDEStatusRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseIDEStatusRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.wait = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): IDEStatusRequest {
    return { wait: isSet(object.wait) ? Boolean(object.wait) : false };
  },

  toJSON(message: IDEStatusRequest): unknown {
    const obj: any = {};
    message.wait !== undefined && (obj.wait = message.wait);
    return obj;
  },

  fromPartial(object: DeepPartial<IDEStatusRequest>): IDEStatusRequest {
    const message = createBaseIDEStatusRequest();
    message.wait = object.wait ?? false;
    return message;
  },
};

function createBaseIDEStatusResponse(): IDEStatusResponse {
  return { ok: false, desktop: undefined };
}

export const IDEStatusResponse = {
  encode(message: IDEStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.ok === true) {
      writer.uint32(8).bool(message.ok);
    }
    if (message.desktop !== undefined) {
      IDEStatusResponse_DesktopStatus.encode(message.desktop, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): IDEStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseIDEStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.ok = reader.bool();
          break;
        case 2:
          message.desktop = IDEStatusResponse_DesktopStatus.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): IDEStatusResponse {
    return {
      ok: isSet(object.ok) ? Boolean(object.ok) : false,
      desktop: isSet(object.desktop) ? IDEStatusResponse_DesktopStatus.fromJSON(object.desktop) : undefined,
    };
  },

  toJSON(message: IDEStatusResponse): unknown {
    const obj: any = {};
    message.ok !== undefined && (obj.ok = message.ok);
    message.desktop !== undefined &&
      (obj.desktop = message.desktop ? IDEStatusResponse_DesktopStatus.toJSON(message.desktop) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<IDEStatusResponse>): IDEStatusResponse {
    const message = createBaseIDEStatusResponse();
    message.ok = object.ok ?? false;
    message.desktop = (object.desktop !== undefined && object.desktop !== null)
      ? IDEStatusResponse_DesktopStatus.fromPartial(object.desktop)
      : undefined;
    return message;
  },
};

function createBaseIDEStatusResponse_DesktopStatus(): IDEStatusResponse_DesktopStatus {
  return { link: "", label: "", clientID: "", kind: "" };
}

export const IDEStatusResponse_DesktopStatus = {
  encode(message: IDEStatusResponse_DesktopStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.link !== "") {
      writer.uint32(10).string(message.link);
    }
    if (message.label !== "") {
      writer.uint32(18).string(message.label);
    }
    if (message.clientID !== "") {
      writer.uint32(26).string(message.clientID);
    }
    if (message.kind !== "") {
      writer.uint32(34).string(message.kind);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): IDEStatusResponse_DesktopStatus {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseIDEStatusResponse_DesktopStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.link = reader.string();
          break;
        case 2:
          message.label = reader.string();
          break;
        case 3:
          message.clientID = reader.string();
          break;
        case 4:
          message.kind = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): IDEStatusResponse_DesktopStatus {
    return {
      link: isSet(object.link) ? String(object.link) : "",
      label: isSet(object.label) ? String(object.label) : "",
      clientID: isSet(object.clientID) ? String(object.clientID) : "",
      kind: isSet(object.kind) ? String(object.kind) : "",
    };
  },

  toJSON(message: IDEStatusResponse_DesktopStatus): unknown {
    const obj: any = {};
    message.link !== undefined && (obj.link = message.link);
    message.label !== undefined && (obj.label = message.label);
    message.clientID !== undefined && (obj.clientID = message.clientID);
    message.kind !== undefined && (obj.kind = message.kind);
    return obj;
  },

  fromPartial(object: DeepPartial<IDEStatusResponse_DesktopStatus>): IDEStatusResponse_DesktopStatus {
    const message = createBaseIDEStatusResponse_DesktopStatus();
    message.link = object.link ?? "";
    message.label = object.label ?? "";
    message.clientID = object.clientID ?? "";
    message.kind = object.kind ?? "";
    return message;
  },
};

function createBaseContentStatusRequest(): ContentStatusRequest {
  return { wait: false };
}

export const ContentStatusRequest = {
  encode(message: ContentStatusRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.wait === true) {
      writer.uint32(8).bool(message.wait);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ContentStatusRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseContentStatusRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.wait = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ContentStatusRequest {
    return { wait: isSet(object.wait) ? Boolean(object.wait) : false };
  },

  toJSON(message: ContentStatusRequest): unknown {
    const obj: any = {};
    message.wait !== undefined && (obj.wait = message.wait);
    return obj;
  },

  fromPartial(object: DeepPartial<ContentStatusRequest>): ContentStatusRequest {
    const message = createBaseContentStatusRequest();
    message.wait = object.wait ?? false;
    return message;
  },
};

function createBaseContentStatusResponse(): ContentStatusResponse {
  return { available: false, source: ContentSource.from_other };
}

export const ContentStatusResponse = {
  encode(message: ContentStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.available === true) {
      writer.uint32(8).bool(message.available);
    }
    if (message.source !== ContentSource.from_other) {
      writer.uint32(16).int32(contentSourceToNumber(message.source));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ContentStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseContentStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.available = reader.bool();
          break;
        case 2:
          message.source = contentSourceFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ContentStatusResponse {
    return {
      available: isSet(object.available) ? Boolean(object.available) : false,
      source: isSet(object.source) ? contentSourceFromJSON(object.source) : ContentSource.from_other,
    };
  },

  toJSON(message: ContentStatusResponse): unknown {
    const obj: any = {};
    message.available !== undefined && (obj.available = message.available);
    message.source !== undefined && (obj.source = contentSourceToJSON(message.source));
    return obj;
  },

  fromPartial(object: DeepPartial<ContentStatusResponse>): ContentStatusResponse {
    const message = createBaseContentStatusResponse();
    message.available = object.available ?? false;
    message.source = object.source ?? ContentSource.from_other;
    return message;
  },
};

function createBaseBackupStatusRequest(): BackupStatusRequest {
  return {};
}

export const BackupStatusRequest = {
  encode(_: BackupStatusRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BackupStatusRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBackupStatusRequest();
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

  fromJSON(_: any): BackupStatusRequest {
    return {};
  },

  toJSON(_: BackupStatusRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<BackupStatusRequest>): BackupStatusRequest {
    const message = createBaseBackupStatusRequest();
    return message;
  },
};

function createBaseBackupStatusResponse(): BackupStatusResponse {
  return { canaryAvailable: false };
}

export const BackupStatusResponse = {
  encode(message: BackupStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.canaryAvailable === true) {
      writer.uint32(8).bool(message.canaryAvailable);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BackupStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBackupStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.canaryAvailable = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BackupStatusResponse {
    return { canaryAvailable: isSet(object.canaryAvailable) ? Boolean(object.canaryAvailable) : false };
  },

  toJSON(message: BackupStatusResponse): unknown {
    const obj: any = {};
    message.canaryAvailable !== undefined && (obj.canaryAvailable = message.canaryAvailable);
    return obj;
  },

  fromPartial(object: DeepPartial<BackupStatusResponse>): BackupStatusResponse {
    const message = createBaseBackupStatusResponse();
    message.canaryAvailable = object.canaryAvailable ?? false;
    return message;
  },
};

function createBasePortsStatusRequest(): PortsStatusRequest {
  return { observe: false };
}

export const PortsStatusRequest = {
  encode(message: PortsStatusRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.observe === true) {
      writer.uint32(8).bool(message.observe);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PortsStatusRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePortsStatusRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.observe = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PortsStatusRequest {
    return { observe: isSet(object.observe) ? Boolean(object.observe) : false };
  },

  toJSON(message: PortsStatusRequest): unknown {
    const obj: any = {};
    message.observe !== undefined && (obj.observe = message.observe);
    return obj;
  },

  fromPartial(object: DeepPartial<PortsStatusRequest>): PortsStatusRequest {
    const message = createBasePortsStatusRequest();
    message.observe = object.observe ?? false;
    return message;
  },
};

function createBasePortsStatusResponse(): PortsStatusResponse {
  return { ports: [] };
}

export const PortsStatusResponse = {
  encode(message: PortsStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.ports) {
      PortsStatus.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PortsStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePortsStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.ports.push(PortsStatus.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PortsStatusResponse {
    return { ports: Array.isArray(object?.ports) ? object.ports.map((e: any) => PortsStatus.fromJSON(e)) : [] };
  },

  toJSON(message: PortsStatusResponse): unknown {
    const obj: any = {};
    if (message.ports) {
      obj.ports = message.ports.map((e) => e ? PortsStatus.toJSON(e) : undefined);
    } else {
      obj.ports = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<PortsStatusResponse>): PortsStatusResponse {
    const message = createBasePortsStatusResponse();
    message.ports = object.ports?.map((e) => PortsStatus.fromPartial(e)) || [];
    return message;
  },
};

function createBaseExposedPortInfo(): ExposedPortInfo {
  return { visibility: PortVisibility.private, url: "", onExposed: OnPortExposedAction.ignore };
}

export const ExposedPortInfo = {
  encode(message: ExposedPortInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.visibility !== PortVisibility.private) {
      writer.uint32(8).int32(portVisibilityToNumber(message.visibility));
    }
    if (message.url !== "") {
      writer.uint32(18).string(message.url);
    }
    if (message.onExposed !== OnPortExposedAction.ignore) {
      writer.uint32(24).int32(onPortExposedActionToNumber(message.onExposed));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ExposedPortInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseExposedPortInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.visibility = portVisibilityFromJSON(reader.int32());
          break;
        case 2:
          message.url = reader.string();
          break;
        case 3:
          message.onExposed = onPortExposedActionFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ExposedPortInfo {
    return {
      visibility: isSet(object.visibility) ? portVisibilityFromJSON(object.visibility) : PortVisibility.private,
      url: isSet(object.url) ? String(object.url) : "",
      onExposed: isSet(object.onExposed) ? onPortExposedActionFromJSON(object.onExposed) : OnPortExposedAction.ignore,
    };
  },

  toJSON(message: ExposedPortInfo): unknown {
    const obj: any = {};
    message.visibility !== undefined && (obj.visibility = portVisibilityToJSON(message.visibility));
    message.url !== undefined && (obj.url = message.url);
    message.onExposed !== undefined && (obj.onExposed = onPortExposedActionToJSON(message.onExposed));
    return obj;
  },

  fromPartial(object: DeepPartial<ExposedPortInfo>): ExposedPortInfo {
    const message = createBaseExposedPortInfo();
    message.visibility = object.visibility ?? PortVisibility.private;
    message.url = object.url ?? "";
    message.onExposed = object.onExposed ?? OnPortExposedAction.ignore;
    return message;
  },
};

function createBaseTunneledPortInfo(): TunneledPortInfo {
  return { targetPort: 0, visibility: TunnelVisiblity.none, clients: {} };
}

export const TunneledPortInfo = {
  encode(message: TunneledPortInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.targetPort !== 0) {
      writer.uint32(8).uint32(message.targetPort);
    }
    if (message.visibility !== TunnelVisiblity.none) {
      writer.uint32(16).int32(tunnelVisiblityToNumber(message.visibility));
    }
    Object.entries(message.clients).forEach(([key, value]) => {
      TunneledPortInfo_ClientsEntry.encode({ key: key as any, value }, writer.uint32(26).fork()).ldelim();
    });
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TunneledPortInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTunneledPortInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.targetPort = reader.uint32();
          break;
        case 2:
          message.visibility = tunnelVisiblityFromJSON(reader.int32());
          break;
        case 3:
          const entry3 = TunneledPortInfo_ClientsEntry.decode(reader, reader.uint32());
          if (entry3.value !== undefined) {
            message.clients[entry3.key] = entry3.value;
          }
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TunneledPortInfo {
    return {
      targetPort: isSet(object.targetPort) ? Number(object.targetPort) : 0,
      visibility: isSet(object.visibility) ? tunnelVisiblityFromJSON(object.visibility) : TunnelVisiblity.none,
      clients: isObject(object.clients)
        ? Object.entries(object.clients).reduce<{ [key: string]: number }>((acc, [key, value]) => {
          acc[key] = Number(value);
          return acc;
        }, {})
        : {},
    };
  },

  toJSON(message: TunneledPortInfo): unknown {
    const obj: any = {};
    message.targetPort !== undefined && (obj.targetPort = Math.round(message.targetPort));
    message.visibility !== undefined && (obj.visibility = tunnelVisiblityToJSON(message.visibility));
    obj.clients = {};
    if (message.clients) {
      Object.entries(message.clients).forEach(([k, v]) => {
        obj.clients[k] = Math.round(v);
      });
    }
    return obj;
  },

  fromPartial(object: DeepPartial<TunneledPortInfo>): TunneledPortInfo {
    const message = createBaseTunneledPortInfo();
    message.targetPort = object.targetPort ?? 0;
    message.visibility = object.visibility ?? TunnelVisiblity.none;
    message.clients = Object.entries(object.clients ?? {}).reduce<{ [key: string]: number }>((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = Number(value);
      }
      return acc;
    }, {});
    return message;
  },
};

function createBaseTunneledPortInfo_ClientsEntry(): TunneledPortInfo_ClientsEntry {
  return { key: "", value: 0 };
}

export const TunneledPortInfo_ClientsEntry = {
  encode(message: TunneledPortInfo_ClientsEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== 0) {
      writer.uint32(16).uint32(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TunneledPortInfo_ClientsEntry {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTunneledPortInfo_ClientsEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.key = reader.string();
          break;
        case 2:
          message.value = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TunneledPortInfo_ClientsEntry {
    return { key: isSet(object.key) ? String(object.key) : "", value: isSet(object.value) ? Number(object.value) : 0 };
  },

  toJSON(message: TunneledPortInfo_ClientsEntry): unknown {
    const obj: any = {};
    message.key !== undefined && (obj.key = message.key);
    message.value !== undefined && (obj.value = Math.round(message.value));
    return obj;
  },

  fromPartial(object: DeepPartial<TunneledPortInfo_ClientsEntry>): TunneledPortInfo_ClientsEntry {
    const message = createBaseTunneledPortInfo_ClientsEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? 0;
    return message;
  },
};

function createBasePortsStatus(): PortsStatus {
  return {
    localPort: 0,
    served: false,
    exposed: undefined,
    autoExposure: PortAutoExposure.trying,
    tunneled: undefined,
    description: "",
    name: "",
    onOpen: PortsStatus_OnOpenAction.ignore,
  };
}

export const PortsStatus = {
  encode(message: PortsStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.localPort !== 0) {
      writer.uint32(8).uint32(message.localPort);
    }
    if (message.served === true) {
      writer.uint32(32).bool(message.served);
    }
    if (message.exposed !== undefined) {
      ExposedPortInfo.encode(message.exposed, writer.uint32(42).fork()).ldelim();
    }
    if (message.autoExposure !== PortAutoExposure.trying) {
      writer.uint32(56).int32(portAutoExposureToNumber(message.autoExposure));
    }
    if (message.tunneled !== undefined) {
      TunneledPortInfo.encode(message.tunneled, writer.uint32(50).fork()).ldelim();
    }
    if (message.description !== "") {
      writer.uint32(66).string(message.description);
    }
    if (message.name !== "") {
      writer.uint32(74).string(message.name);
    }
    if (message.onOpen !== PortsStatus_OnOpenAction.ignore) {
      writer.uint32(80).int32(portsStatus_OnOpenActionToNumber(message.onOpen));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PortsStatus {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePortsStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.localPort = reader.uint32();
          break;
        case 4:
          message.served = reader.bool();
          break;
        case 5:
          message.exposed = ExposedPortInfo.decode(reader, reader.uint32());
          break;
        case 7:
          message.autoExposure = portAutoExposureFromJSON(reader.int32());
          break;
        case 6:
          message.tunneled = TunneledPortInfo.decode(reader, reader.uint32());
          break;
        case 8:
          message.description = reader.string();
          break;
        case 9:
          message.name = reader.string();
          break;
        case 10:
          message.onOpen = portsStatus_OnOpenActionFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PortsStatus {
    return {
      localPort: isSet(object.localPort) ? Number(object.localPort) : 0,
      served: isSet(object.served) ? Boolean(object.served) : false,
      exposed: isSet(object.exposed) ? ExposedPortInfo.fromJSON(object.exposed) : undefined,
      autoExposure: isSet(object.autoExposure)
        ? portAutoExposureFromJSON(object.autoExposure)
        : PortAutoExposure.trying,
      tunneled: isSet(object.tunneled) ? TunneledPortInfo.fromJSON(object.tunneled) : undefined,
      description: isSet(object.description) ? String(object.description) : "",
      name: isSet(object.name) ? String(object.name) : "",
      onOpen: isSet(object.onOpen) ? portsStatus_OnOpenActionFromJSON(object.onOpen) : PortsStatus_OnOpenAction.ignore,
    };
  },

  toJSON(message: PortsStatus): unknown {
    const obj: any = {};
    message.localPort !== undefined && (obj.localPort = Math.round(message.localPort));
    message.served !== undefined && (obj.served = message.served);
    message.exposed !== undefined &&
      (obj.exposed = message.exposed ? ExposedPortInfo.toJSON(message.exposed) : undefined);
    message.autoExposure !== undefined && (obj.autoExposure = portAutoExposureToJSON(message.autoExposure));
    message.tunneled !== undefined &&
      (obj.tunneled = message.tunneled ? TunneledPortInfo.toJSON(message.tunneled) : undefined);
    message.description !== undefined && (obj.description = message.description);
    message.name !== undefined && (obj.name = message.name);
    message.onOpen !== undefined && (obj.onOpen = portsStatus_OnOpenActionToJSON(message.onOpen));
    return obj;
  },

  fromPartial(object: DeepPartial<PortsStatus>): PortsStatus {
    const message = createBasePortsStatus();
    message.localPort = object.localPort ?? 0;
    message.served = object.served ?? false;
    message.exposed = (object.exposed !== undefined && object.exposed !== null)
      ? ExposedPortInfo.fromPartial(object.exposed)
      : undefined;
    message.autoExposure = object.autoExposure ?? PortAutoExposure.trying;
    message.tunneled = (object.tunneled !== undefined && object.tunneled !== null)
      ? TunneledPortInfo.fromPartial(object.tunneled)
      : undefined;
    message.description = object.description ?? "";
    message.name = object.name ?? "";
    message.onOpen = object.onOpen ?? PortsStatus_OnOpenAction.ignore;
    return message;
  },
};

function createBaseTasksStatusRequest(): TasksStatusRequest {
  return { observe: false };
}

export const TasksStatusRequest = {
  encode(message: TasksStatusRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.observe === true) {
      writer.uint32(8).bool(message.observe);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TasksStatusRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTasksStatusRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.observe = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TasksStatusRequest {
    return { observe: isSet(object.observe) ? Boolean(object.observe) : false };
  },

  toJSON(message: TasksStatusRequest): unknown {
    const obj: any = {};
    message.observe !== undefined && (obj.observe = message.observe);
    return obj;
  },

  fromPartial(object: DeepPartial<TasksStatusRequest>): TasksStatusRequest {
    const message = createBaseTasksStatusRequest();
    message.observe = object.observe ?? false;
    return message;
  },
};

function createBaseTasksStatusResponse(): TasksStatusResponse {
  return { tasks: [] };
}

export const TasksStatusResponse = {
  encode(message: TasksStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.tasks) {
      TaskStatus.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TasksStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTasksStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tasks.push(TaskStatus.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TasksStatusResponse {
    return { tasks: Array.isArray(object?.tasks) ? object.tasks.map((e: any) => TaskStatus.fromJSON(e)) : [] };
  },

  toJSON(message: TasksStatusResponse): unknown {
    const obj: any = {};
    if (message.tasks) {
      obj.tasks = message.tasks.map((e) => e ? TaskStatus.toJSON(e) : undefined);
    } else {
      obj.tasks = [];
    }
    return obj;
  },

  fromPartial(object: DeepPartial<TasksStatusResponse>): TasksStatusResponse {
    const message = createBaseTasksStatusResponse();
    message.tasks = object.tasks?.map((e) => TaskStatus.fromPartial(e)) || [];
    return message;
  },
};

function createBaseTaskStatus(): TaskStatus {
  return { id: "", state: TaskState.opening, terminal: "", presentation: undefined };
}

export const TaskStatus = {
  encode(message: TaskStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.state !== TaskState.opening) {
      writer.uint32(16).int32(taskStateToNumber(message.state));
    }
    if (message.terminal !== "") {
      writer.uint32(26).string(message.terminal);
    }
    if (message.presentation !== undefined) {
      TaskPresentation.encode(message.presentation, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TaskStatus {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTaskStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.state = taskStateFromJSON(reader.int32());
          break;
        case 3:
          message.terminal = reader.string();
          break;
        case 4:
          message.presentation = TaskPresentation.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TaskStatus {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      state: isSet(object.state) ? taskStateFromJSON(object.state) : TaskState.opening,
      terminal: isSet(object.terminal) ? String(object.terminal) : "",
      presentation: isSet(object.presentation) ? TaskPresentation.fromJSON(object.presentation) : undefined,
    };
  },

  toJSON(message: TaskStatus): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.state !== undefined && (obj.state = taskStateToJSON(message.state));
    message.terminal !== undefined && (obj.terminal = message.terminal);
    message.presentation !== undefined &&
      (obj.presentation = message.presentation ? TaskPresentation.toJSON(message.presentation) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<TaskStatus>): TaskStatus {
    const message = createBaseTaskStatus();
    message.id = object.id ?? "";
    message.state = object.state ?? TaskState.opening;
    message.terminal = object.terminal ?? "";
    message.presentation = (object.presentation !== undefined && object.presentation !== null)
      ? TaskPresentation.fromPartial(object.presentation)
      : undefined;
    return message;
  },
};

function createBaseTaskPresentation(): TaskPresentation {
  return { name: "", openIn: "", openMode: "" };
}

export const TaskPresentation = {
  encode(message: TaskPresentation, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.openIn !== "") {
      writer.uint32(18).string(message.openIn);
    }
    if (message.openMode !== "") {
      writer.uint32(26).string(message.openMode);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TaskPresentation {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTaskPresentation();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        case 2:
          message.openIn = reader.string();
          break;
        case 3:
          message.openMode = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TaskPresentation {
    return {
      name: isSet(object.name) ? String(object.name) : "",
      openIn: isSet(object.openIn) ? String(object.openIn) : "",
      openMode: isSet(object.openMode) ? String(object.openMode) : "",
    };
  },

  toJSON(message: TaskPresentation): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    message.openIn !== undefined && (obj.openIn = message.openIn);
    message.openMode !== undefined && (obj.openMode = message.openMode);
    return obj;
  },

  fromPartial(object: DeepPartial<TaskPresentation>): TaskPresentation {
    const message = createBaseTaskPresentation();
    message.name = object.name ?? "";
    message.openIn = object.openIn ?? "";
    message.openMode = object.openMode ?? "";
    return message;
  },
};

function createBaseResourcesStatuRequest(): ResourcesStatuRequest {
  return {};
}

export const ResourcesStatuRequest = {
  encode(_: ResourcesStatuRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResourcesStatuRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResourcesStatuRequest();
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

  fromJSON(_: any): ResourcesStatuRequest {
    return {};
  },

  toJSON(_: ResourcesStatuRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<ResourcesStatuRequest>): ResourcesStatuRequest {
    const message = createBaseResourcesStatuRequest();
    return message;
  },
};

function createBaseResourcesStatusResponse(): ResourcesStatusResponse {
  return { memory: undefined, cpu: undefined };
}

export const ResourcesStatusResponse = {
  encode(message: ResourcesStatusResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.memory !== undefined) {
      ResourceStatus.encode(message.memory, writer.uint32(10).fork()).ldelim();
    }
    if (message.cpu !== undefined) {
      ResourceStatus.encode(message.cpu, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResourcesStatusResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResourcesStatusResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.memory = ResourceStatus.decode(reader, reader.uint32());
          break;
        case 2:
          message.cpu = ResourceStatus.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ResourcesStatusResponse {
    return {
      memory: isSet(object.memory) ? ResourceStatus.fromJSON(object.memory) : undefined,
      cpu: isSet(object.cpu) ? ResourceStatus.fromJSON(object.cpu) : undefined,
    };
  },

  toJSON(message: ResourcesStatusResponse): unknown {
    const obj: any = {};
    message.memory !== undefined && (obj.memory = message.memory ? ResourceStatus.toJSON(message.memory) : undefined);
    message.cpu !== undefined && (obj.cpu = message.cpu ? ResourceStatus.toJSON(message.cpu) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<ResourcesStatusResponse>): ResourcesStatusResponse {
    const message = createBaseResourcesStatusResponse();
    message.memory = (object.memory !== undefined && object.memory !== null)
      ? ResourceStatus.fromPartial(object.memory)
      : undefined;
    message.cpu = (object.cpu !== undefined && object.cpu !== null)
      ? ResourceStatus.fromPartial(object.cpu)
      : undefined;
    return message;
  },
};

function createBaseResourceStatus(): ResourceStatus {
  return { used: 0, limit: 0, severity: ResourceStatusSeverity.normal };
}

export const ResourceStatus = {
  encode(message: ResourceStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.used !== 0) {
      writer.uint32(8).int64(message.used);
    }
    if (message.limit !== 0) {
      writer.uint32(16).int64(message.limit);
    }
    if (message.severity !== ResourceStatusSeverity.normal) {
      writer.uint32(24).int32(resourceStatusSeverityToNumber(message.severity));
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResourceStatus {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResourceStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.used = longToNumber(reader.int64() as Long);
          break;
        case 2:
          message.limit = longToNumber(reader.int64() as Long);
          break;
        case 3:
          message.severity = resourceStatusSeverityFromJSON(reader.int32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ResourceStatus {
    return {
      used: isSet(object.used) ? Number(object.used) : 0,
      limit: isSet(object.limit) ? Number(object.limit) : 0,
      severity: isSet(object.severity)
        ? resourceStatusSeverityFromJSON(object.severity)
        : ResourceStatusSeverity.normal,
    };
  },

  toJSON(message: ResourceStatus): unknown {
    const obj: any = {};
    message.used !== undefined && (obj.used = Math.round(message.used));
    message.limit !== undefined && (obj.limit = Math.round(message.limit));
    message.severity !== undefined && (obj.severity = resourceStatusSeverityToJSON(message.severity));
    return obj;
  },

  fromPartial(object: DeepPartial<ResourceStatus>): ResourceStatus {
    const message = createBaseResourceStatus();
    message.used = object.used ?? 0;
    message.limit = object.limit ?? 0;
    message.severity = object.severity ?? ResourceStatusSeverity.normal;
    return message;
  },
};

/** StatusService provides status feedback for the various in-workspace services. */
export type StatusServiceDefinition = typeof StatusServiceDefinition;
export const StatusServiceDefinition = {
  name: "StatusService",
  fullName: "supervisor.StatusService",
  methods: {
    /** SupervisorStatus returns once supervisor is running. */
    supervisorStatus: {
      name: "SupervisorStatus",
      requestType: SupervisorStatusRequest,
      requestStream: false,
      responseType: SupervisorStatusResponse,
      responseStream: false,
      options: {},
    },
    /** IDEStatus returns OK if the IDE can serve requests. */
    iDEStatus: {
      name: "IDEStatus",
      requestType: IDEStatusRequest,
      requestStream: false,
      responseType: IDEStatusResponse,
      responseStream: false,
      options: {},
    },
    /**
     * ContentStatus returns the status of the workspace content. When used with `wait`, the call
     * returns when the content has become available.
     */
    contentStatus: {
      name: "ContentStatus",
      requestType: ContentStatusRequest,
      requestStream: false,
      responseType: ContentStatusResponse,
      responseStream: false,
      options: {},
    },
    /**
     * BackupStatus offers feedback on the workspace backup status. This status information can
     * be relayed to the user to provide transparency as to how "safe" their files/content
     * data are w.r.t. to being lost.
     */
    backupStatus: {
      name: "BackupStatus",
      requestType: BackupStatusRequest,
      requestStream: false,
      responseType: BackupStatusResponse,
      responseStream: false,
      options: {},
    },
    /** PortsStatus provides feedback about the network ports currently in use. */
    portsStatus: {
      name: "PortsStatus",
      requestType: PortsStatusRequest,
      requestStream: false,
      responseType: PortsStatusResponse,
      responseStream: true,
      options: {},
    },
    /** TasksStatus provides tasks status information. */
    tasksStatus: {
      name: "TasksStatus",
      requestType: TasksStatusRequest,
      requestStream: false,
      responseType: TasksStatusResponse,
      responseStream: true,
      options: {},
    },
    /** ResourcesStatus provides workspace resources status information. */
    resourcesStatus: {
      name: "ResourcesStatus",
      requestType: ResourcesStatuRequest,
      requestStream: false,
      responseType: ResourcesStatusResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface StatusServiceServiceImplementation<CallContextExt = {}> {
  /** SupervisorStatus returns once supervisor is running. */
  supervisorStatus(
    request: SupervisorStatusRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<SupervisorStatusResponse>>;
  /** IDEStatus returns OK if the IDE can serve requests. */
  iDEStatus(request: IDEStatusRequest, context: CallContext & CallContextExt): Promise<DeepPartial<IDEStatusResponse>>;
  /**
   * ContentStatus returns the status of the workspace content. When used with `wait`, the call
   * returns when the content has become available.
   */
  contentStatus(
    request: ContentStatusRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ContentStatusResponse>>;
  /**
   * BackupStatus offers feedback on the workspace backup status. This status information can
   * be relayed to the user to provide transparency as to how "safe" their files/content
   * data are w.r.t. to being lost.
   */
  backupStatus(
    request: BackupStatusRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<BackupStatusResponse>>;
  /** PortsStatus provides feedback about the network ports currently in use. */
  portsStatus(
    request: PortsStatusRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<PortsStatusResponse>>;
  /** TasksStatus provides tasks status information. */
  tasksStatus(
    request: TasksStatusRequest,
    context: CallContext & CallContextExt,
  ): ServerStreamingMethodResult<DeepPartial<TasksStatusResponse>>;
  /** ResourcesStatus provides workspace resources status information. */
  resourcesStatus(
    request: ResourcesStatuRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ResourcesStatusResponse>>;
}

export interface StatusServiceClient<CallOptionsExt = {}> {
  /** SupervisorStatus returns once supervisor is running. */
  supervisorStatus(
    request: DeepPartial<SupervisorStatusRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<SupervisorStatusResponse>;
  /** IDEStatus returns OK if the IDE can serve requests. */
  iDEStatus(request: DeepPartial<IDEStatusRequest>, options?: CallOptions & CallOptionsExt): Promise<IDEStatusResponse>;
  /**
   * ContentStatus returns the status of the workspace content. When used with `wait`, the call
   * returns when the content has become available.
   */
  contentStatus(
    request: DeepPartial<ContentStatusRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ContentStatusResponse>;
  /**
   * BackupStatus offers feedback on the workspace backup status. This status information can
   * be relayed to the user to provide transparency as to how "safe" their files/content
   * data are w.r.t. to being lost.
   */
  backupStatus(
    request: DeepPartial<BackupStatusRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<BackupStatusResponse>;
  /** PortsStatus provides feedback about the network ports currently in use. */
  portsStatus(
    request: DeepPartial<PortsStatusRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<PortsStatusResponse>;
  /** TasksStatus provides tasks status information. */
  tasksStatus(
    request: DeepPartial<TasksStatusRequest>,
    options?: CallOptions & CallOptionsExt,
  ): AsyncIterable<TasksStatusResponse>;
  /** ResourcesStatus provides workspace resources status information. */
  resourcesStatus(
    request: DeepPartial<ResourcesStatuRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ResourcesStatusResponse>;
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

function isObject(value: any): boolean {
  return typeof value === "object" && value !== null;
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export type ServerStreamingMethodResult<Response> = { [Symbol.asyncIterator](): AsyncIterator<Response, void> };
