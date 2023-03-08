/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "../../../google/protobuf/timestamp_nicegrpc";

export const protobufPackage = "gitpod.experimental.v1";

export interface User {
  /** id is a UUID of the user */
  id: string;
  /** name is the username */
  name: string;
  /** avatar_url is a link to the user avatar */
  avatarUrl: string;
  /** created_at is the creation time */
  createdAt: Date | undefined;
}

export interface SSHKey {
  /** id is a UUID of the SSH key */
  id: string;
  /** name is the name of the SSH key */
  name: string;
  /** key is the public SSH key */
  key: string;
  /** created_at is the creation time */
  createdAt: Date | undefined;
}

export interface GetAuthenticatedUserRequest {
}

export interface GetAuthenticatedUserResponse {
  user: User | undefined;
}

/** TODO: pagination options */
export interface ListSSHKeysRequest {
}

export interface ListSSHKeysResponse {
  keys: SSHKey[];
}

export interface CreateSSHKeyRequest {
  /** name is the SSH key name */
  name: string;
  /** the public SSH key */
  key: string;
}

export interface CreateSSHKeyResponse {
  key: SSHKey | undefined;
}

export interface GetSSHKeyRequest {
  /** id is the unique identifier of the SSH key to retreive. */
  keyId: string;
}

export interface GetSSHKeyResponse {
  key: SSHKey | undefined;
}

export interface DeleteSSHKeyRequest {
  /** id is the unique identifier of the SSH key to retreive. */
  keyId: string;
}

export interface DeleteSSHKeyResponse {
}

export interface GetGitTokenRequest {
  host: string;
}

export interface GetGitTokenResponse {
  token: GitToken | undefined;
}

export interface GitToken {
  /** expiry_date is the date when the token will expire */
  expiryDate: string;
  /** id_token is the unique identifier for the token */
  idToken: string;
  /** refresh_token is the token used to refresh the git token */
  refreshToken: string;
  /** scopes is a list of permissions associated with the token */
  scopes: string[];
  /** update_date is the date when the token was last updated */
  updateDate: string;
  /** username is the username associated with the token */
  username: string;
  /** value is the actual token value for the token */
  value: string;
}

function createBaseUser(): User {
  return { id: "", name: "", avatarUrl: "", createdAt: undefined };
}

export const User = {
  encode(message: User, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.name !== "") {
      writer.uint32(18).string(message.name);
    }
    if (message.avatarUrl !== "") {
      writer.uint32(26).string(message.avatarUrl);
    }
    if (message.createdAt !== undefined) {
      Timestamp.encode(toTimestamp(message.createdAt), writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): User {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUser();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.name = reader.string();
          break;
        case 3:
          message.avatarUrl = reader.string();
          break;
        case 5:
          message.createdAt = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): User {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      name: isSet(object.name) ? String(object.name) : "",
      avatarUrl: isSet(object.avatarUrl) ? String(object.avatarUrl) : "",
      createdAt: isSet(object.createdAt) ? fromJsonTimestamp(object.createdAt) : undefined,
    };
  },

  toJSON(message: User): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.name !== undefined && (obj.name = message.name);
    message.avatarUrl !== undefined && (obj.avatarUrl = message.avatarUrl);
    message.createdAt !== undefined && (obj.createdAt = message.createdAt.toISOString());
    return obj;
  },

  create(base?: DeepPartial<User>): User {
    return User.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<User>): User {
    const message = createBaseUser();
    message.id = object.id ?? "";
    message.name = object.name ?? "";
    message.avatarUrl = object.avatarUrl ?? "";
    message.createdAt = object.createdAt ?? undefined;
    return message;
  },
};

function createBaseSSHKey(): SSHKey {
  return { id: "", name: "", key: "", createdAt: undefined };
}

export const SSHKey = {
  encode(message: SSHKey, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.name !== "") {
      writer.uint32(18).string(message.name);
    }
    if (message.key !== "") {
      writer.uint32(26).string(message.key);
    }
    if (message.createdAt !== undefined) {
      Timestamp.encode(toTimestamp(message.createdAt), writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSHKey {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSHKey();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.name = reader.string();
          break;
        case 3:
          message.key = reader.string();
          break;
        case 4:
          message.createdAt = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSHKey {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      name: isSet(object.name) ? String(object.name) : "",
      key: isSet(object.key) ? String(object.key) : "",
      createdAt: isSet(object.createdAt) ? fromJsonTimestamp(object.createdAt) : undefined,
    };
  },

  toJSON(message: SSHKey): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.name !== undefined && (obj.name = message.name);
    message.key !== undefined && (obj.key = message.key);
    message.createdAt !== undefined && (obj.createdAt = message.createdAt.toISOString());
    return obj;
  },

  create(base?: DeepPartial<SSHKey>): SSHKey {
    return SSHKey.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<SSHKey>): SSHKey {
    const message = createBaseSSHKey();
    message.id = object.id ?? "";
    message.name = object.name ?? "";
    message.key = object.key ?? "";
    message.createdAt = object.createdAt ?? undefined;
    return message;
  },
};

function createBaseGetAuthenticatedUserRequest(): GetAuthenticatedUserRequest {
  return {};
}

export const GetAuthenticatedUserRequest = {
  encode(_: GetAuthenticatedUserRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetAuthenticatedUserRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetAuthenticatedUserRequest();
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

  fromJSON(_: any): GetAuthenticatedUserRequest {
    return {};
  },

  toJSON(_: GetAuthenticatedUserRequest): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<GetAuthenticatedUserRequest>): GetAuthenticatedUserRequest {
    return GetAuthenticatedUserRequest.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<GetAuthenticatedUserRequest>): GetAuthenticatedUserRequest {
    const message = createBaseGetAuthenticatedUserRequest();
    return message;
  },
};

function createBaseGetAuthenticatedUserResponse(): GetAuthenticatedUserResponse {
  return { user: undefined };
}

export const GetAuthenticatedUserResponse = {
  encode(message: GetAuthenticatedUserResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetAuthenticatedUserResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetAuthenticatedUserResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.user = User.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetAuthenticatedUserResponse {
    return { user: isSet(object.user) ? User.fromJSON(object.user) : undefined };
  },

  toJSON(message: GetAuthenticatedUserResponse): unknown {
    const obj: any = {};
    message.user !== undefined && (obj.user = message.user ? User.toJSON(message.user) : undefined);
    return obj;
  },

  create(base?: DeepPartial<GetAuthenticatedUserResponse>): GetAuthenticatedUserResponse {
    return GetAuthenticatedUserResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetAuthenticatedUserResponse>): GetAuthenticatedUserResponse {
    const message = createBaseGetAuthenticatedUserResponse();
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseListSSHKeysRequest(): ListSSHKeysRequest {
  return {};
}

export const ListSSHKeysRequest = {
  encode(_: ListSSHKeysRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListSSHKeysRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListSSHKeysRequest();
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

  fromJSON(_: any): ListSSHKeysRequest {
    return {};
  },

  toJSON(_: ListSSHKeysRequest): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<ListSSHKeysRequest>): ListSSHKeysRequest {
    return ListSSHKeysRequest.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<ListSSHKeysRequest>): ListSSHKeysRequest {
    const message = createBaseListSSHKeysRequest();
    return message;
  },
};

function createBaseListSSHKeysResponse(): ListSSHKeysResponse {
  return { keys: [] };
}

export const ListSSHKeysResponse = {
  encode(message: ListSSHKeysResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.keys) {
      SSHKey.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListSSHKeysResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListSSHKeysResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.keys.push(SSHKey.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListSSHKeysResponse {
    return { keys: Array.isArray(object?.keys) ? object.keys.map((e: any) => SSHKey.fromJSON(e)) : [] };
  },

  toJSON(message: ListSSHKeysResponse): unknown {
    const obj: any = {};
    if (message.keys) {
      obj.keys = message.keys.map((e) => e ? SSHKey.toJSON(e) : undefined);
    } else {
      obj.keys = [];
    }
    return obj;
  },

  create(base?: DeepPartial<ListSSHKeysResponse>): ListSSHKeysResponse {
    return ListSSHKeysResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListSSHKeysResponse>): ListSSHKeysResponse {
    const message = createBaseListSSHKeysResponse();
    message.keys = object.keys?.map((e) => SSHKey.fromPartial(e)) || [];
    return message;
  },
};

function createBaseCreateSSHKeyRequest(): CreateSSHKeyRequest {
  return { name: "", key: "" };
}

export const CreateSSHKeyRequest = {
  encode(message: CreateSSHKeyRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.key !== "") {
      writer.uint32(18).string(message.key);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateSSHKeyRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateSSHKeyRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        case 2:
          message.key = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateSSHKeyRequest {
    return { name: isSet(object.name) ? String(object.name) : "", key: isSet(object.key) ? String(object.key) : "" };
  },

  toJSON(message: CreateSSHKeyRequest): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    message.key !== undefined && (obj.key = message.key);
    return obj;
  },

  create(base?: DeepPartial<CreateSSHKeyRequest>): CreateSSHKeyRequest {
    return CreateSSHKeyRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateSSHKeyRequest>): CreateSSHKeyRequest {
    const message = createBaseCreateSSHKeyRequest();
    message.name = object.name ?? "";
    message.key = object.key ?? "";
    return message;
  },
};

function createBaseCreateSSHKeyResponse(): CreateSSHKeyResponse {
  return { key: undefined };
}

export const CreateSSHKeyResponse = {
  encode(message: CreateSSHKeyResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== undefined) {
      SSHKey.encode(message.key, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateSSHKeyResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateSSHKeyResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.key = SSHKey.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateSSHKeyResponse {
    return { key: isSet(object.key) ? SSHKey.fromJSON(object.key) : undefined };
  },

  toJSON(message: CreateSSHKeyResponse): unknown {
    const obj: any = {};
    message.key !== undefined && (obj.key = message.key ? SSHKey.toJSON(message.key) : undefined);
    return obj;
  },

  create(base?: DeepPartial<CreateSSHKeyResponse>): CreateSSHKeyResponse {
    return CreateSSHKeyResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateSSHKeyResponse>): CreateSSHKeyResponse {
    const message = createBaseCreateSSHKeyResponse();
    message.key = (object.key !== undefined && object.key !== null) ? SSHKey.fromPartial(object.key) : undefined;
    return message;
  },
};

function createBaseGetSSHKeyRequest(): GetSSHKeyRequest {
  return { keyId: "" };
}

export const GetSSHKeyRequest = {
  encode(message: GetSSHKeyRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.keyId !== "") {
      writer.uint32(10).string(message.keyId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetSSHKeyRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetSSHKeyRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.keyId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetSSHKeyRequest {
    return { keyId: isSet(object.keyId) ? String(object.keyId) : "" };
  },

  toJSON(message: GetSSHKeyRequest): unknown {
    const obj: any = {};
    message.keyId !== undefined && (obj.keyId = message.keyId);
    return obj;
  },

  create(base?: DeepPartial<GetSSHKeyRequest>): GetSSHKeyRequest {
    return GetSSHKeyRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetSSHKeyRequest>): GetSSHKeyRequest {
    const message = createBaseGetSSHKeyRequest();
    message.keyId = object.keyId ?? "";
    return message;
  },
};

function createBaseGetSSHKeyResponse(): GetSSHKeyResponse {
  return { key: undefined };
}

export const GetSSHKeyResponse = {
  encode(message: GetSSHKeyResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== undefined) {
      SSHKey.encode(message.key, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetSSHKeyResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetSSHKeyResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.key = SSHKey.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetSSHKeyResponse {
    return { key: isSet(object.key) ? SSHKey.fromJSON(object.key) : undefined };
  },

  toJSON(message: GetSSHKeyResponse): unknown {
    const obj: any = {};
    message.key !== undefined && (obj.key = message.key ? SSHKey.toJSON(message.key) : undefined);
    return obj;
  },

  create(base?: DeepPartial<GetSSHKeyResponse>): GetSSHKeyResponse {
    return GetSSHKeyResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetSSHKeyResponse>): GetSSHKeyResponse {
    const message = createBaseGetSSHKeyResponse();
    message.key = (object.key !== undefined && object.key !== null) ? SSHKey.fromPartial(object.key) : undefined;
    return message;
  },
};

function createBaseDeleteSSHKeyRequest(): DeleteSSHKeyRequest {
  return { keyId: "" };
}

export const DeleteSSHKeyRequest = {
  encode(message: DeleteSSHKeyRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.keyId !== "") {
      writer.uint32(10).string(message.keyId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteSSHKeyRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteSSHKeyRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.keyId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeleteSSHKeyRequest {
    return { keyId: isSet(object.keyId) ? String(object.keyId) : "" };
  },

  toJSON(message: DeleteSSHKeyRequest): unknown {
    const obj: any = {};
    message.keyId !== undefined && (obj.keyId = message.keyId);
    return obj;
  },

  create(base?: DeepPartial<DeleteSSHKeyRequest>): DeleteSSHKeyRequest {
    return DeleteSSHKeyRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeleteSSHKeyRequest>): DeleteSSHKeyRequest {
    const message = createBaseDeleteSSHKeyRequest();
    message.keyId = object.keyId ?? "";
    return message;
  },
};

function createBaseDeleteSSHKeyResponse(): DeleteSSHKeyResponse {
  return {};
}

export const DeleteSSHKeyResponse = {
  encode(_: DeleteSSHKeyResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteSSHKeyResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteSSHKeyResponse();
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

  fromJSON(_: any): DeleteSSHKeyResponse {
    return {};
  },

  toJSON(_: DeleteSSHKeyResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<DeleteSSHKeyResponse>): DeleteSSHKeyResponse {
    return DeleteSSHKeyResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeleteSSHKeyResponse>): DeleteSSHKeyResponse {
    const message = createBaseDeleteSSHKeyResponse();
    return message;
  },
};

function createBaseGetGitTokenRequest(): GetGitTokenRequest {
  return { host: "" };
}

export const GetGitTokenRequest = {
  encode(message: GetGitTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.host !== "") {
      writer.uint32(10).string(message.host);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetGitTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetGitTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.host = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetGitTokenRequest {
    return { host: isSet(object.host) ? String(object.host) : "" };
  },

  toJSON(message: GetGitTokenRequest): unknown {
    const obj: any = {};
    message.host !== undefined && (obj.host = message.host);
    return obj;
  },

  create(base?: DeepPartial<GetGitTokenRequest>): GetGitTokenRequest {
    return GetGitTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetGitTokenRequest>): GetGitTokenRequest {
    const message = createBaseGetGitTokenRequest();
    message.host = object.host ?? "";
    return message;
  },
};

function createBaseGetGitTokenResponse(): GetGitTokenResponse {
  return { token: undefined };
}

export const GetGitTokenResponse = {
  encode(message: GetGitTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== undefined) {
      GitToken.encode(message.token, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetGitTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetGitTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = GitToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetGitTokenResponse {
    return { token: isSet(object.token) ? GitToken.fromJSON(object.token) : undefined };
  },

  toJSON(message: GetGitTokenResponse): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token ? GitToken.toJSON(message.token) : undefined);
    return obj;
  },

  create(base?: DeepPartial<GetGitTokenResponse>): GetGitTokenResponse {
    return GetGitTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetGitTokenResponse>): GetGitTokenResponse {
    const message = createBaseGetGitTokenResponse();
    message.token = (object.token !== undefined && object.token !== null)
      ? GitToken.fromPartial(object.token)
      : undefined;
    return message;
  },
};

function createBaseGitToken(): GitToken {
  return { expiryDate: "", idToken: "", refreshToken: "", scopes: [], updateDate: "", username: "", value: "" };
}

export const GitToken = {
  encode(message: GitToken, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.expiryDate !== "") {
      writer.uint32(10).string(message.expiryDate);
    }
    if (message.idToken !== "") {
      writer.uint32(18).string(message.idToken);
    }
    if (message.refreshToken !== "") {
      writer.uint32(26).string(message.refreshToken);
    }
    for (const v of message.scopes) {
      writer.uint32(34).string(v!);
    }
    if (message.updateDate !== "") {
      writer.uint32(42).string(message.updateDate);
    }
    if (message.username !== "") {
      writer.uint32(50).string(message.username);
    }
    if (message.value !== "") {
      writer.uint32(58).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GitToken {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGitToken();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.expiryDate = reader.string();
          break;
        case 2:
          message.idToken = reader.string();
          break;
        case 3:
          message.refreshToken = reader.string();
          break;
        case 4:
          message.scopes.push(reader.string());
          break;
        case 5:
          message.updateDate = reader.string();
          break;
        case 6:
          message.username = reader.string();
          break;
        case 7:
          message.value = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GitToken {
    return {
      expiryDate: isSet(object.expiryDate) ? String(object.expiryDate) : "",
      idToken: isSet(object.idToken) ? String(object.idToken) : "",
      refreshToken: isSet(object.refreshToken) ? String(object.refreshToken) : "",
      scopes: Array.isArray(object?.scopes) ? object.scopes.map((e: any) => String(e)) : [],
      updateDate: isSet(object.updateDate) ? String(object.updateDate) : "",
      username: isSet(object.username) ? String(object.username) : "",
      value: isSet(object.value) ? String(object.value) : "",
    };
  },

  toJSON(message: GitToken): unknown {
    const obj: any = {};
    message.expiryDate !== undefined && (obj.expiryDate = message.expiryDate);
    message.idToken !== undefined && (obj.idToken = message.idToken);
    message.refreshToken !== undefined && (obj.refreshToken = message.refreshToken);
    if (message.scopes) {
      obj.scopes = message.scopes.map((e) => e);
    } else {
      obj.scopes = [];
    }
    message.updateDate !== undefined && (obj.updateDate = message.updateDate);
    message.username !== undefined && (obj.username = message.username);
    message.value !== undefined && (obj.value = message.value);
    return obj;
  },

  create(base?: DeepPartial<GitToken>): GitToken {
    return GitToken.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GitToken>): GitToken {
    const message = createBaseGitToken();
    message.expiryDate = object.expiryDate ?? "";
    message.idToken = object.idToken ?? "";
    message.refreshToken = object.refreshToken ?? "";
    message.scopes = object.scopes?.map((e) => e) || [];
    message.updateDate = object.updateDate ?? "";
    message.username = object.username ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

export type UserServiceDefinition = typeof UserServiceDefinition;
export const UserServiceDefinition = {
  name: "UserService",
  fullName: "gitpod.experimental.v1.UserService",
  methods: {
    /** GetAuthenticatedUser gets the user info. */
    getAuthenticatedUser: {
      name: "GetAuthenticatedUser",
      requestType: GetAuthenticatedUserRequest,
      requestStream: false,
      responseType: GetAuthenticatedUserResponse,
      responseStream: false,
      options: {},
    },
    /** ListSSHKeys lists the public SSH keys. */
    listSSHKeys: {
      name: "ListSSHKeys",
      requestType: ListSSHKeysRequest,
      requestStream: false,
      responseType: ListSSHKeysResponse,
      responseStream: false,
      options: {},
    },
    /** CreateSSHKey adds a public SSH key. */
    createSSHKey: {
      name: "CreateSSHKey",
      requestType: CreateSSHKeyRequest,
      requestStream: false,
      responseType: CreateSSHKeyResponse,
      responseStream: false,
      options: {},
    },
    /** GetSSHKey retrieves an ssh key by ID. */
    getSSHKey: {
      name: "GetSSHKey",
      requestType: GetSSHKeyRequest,
      requestStream: false,
      responseType: GetSSHKeyResponse,
      responseStream: false,
      options: {},
    },
    /** DeleteSSHKey removes a public SSH key. */
    deleteSSHKey: {
      name: "DeleteSSHKey",
      requestType: DeleteSSHKeyRequest,
      requestStream: false,
      responseType: DeleteSSHKeyResponse,
      responseStream: false,
      options: {},
    },
    getGitToken: {
      name: "GetGitToken",
      requestType: GetGitTokenRequest,
      requestStream: false,
      responseType: GetGitTokenResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface UserServiceImplementation<CallContextExt = {}> {
  /** GetAuthenticatedUser gets the user info. */
  getAuthenticatedUser(
    request: GetAuthenticatedUserRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetAuthenticatedUserResponse>>;
  /** ListSSHKeys lists the public SSH keys. */
  listSSHKeys(
    request: ListSSHKeysRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ListSSHKeysResponse>>;
  /** CreateSSHKey adds a public SSH key. */
  createSSHKey(
    request: CreateSSHKeyRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateSSHKeyResponse>>;
  /** GetSSHKey retrieves an ssh key by ID. */
  getSSHKey(request: GetSSHKeyRequest, context: CallContext & CallContextExt): Promise<DeepPartial<GetSSHKeyResponse>>;
  /** DeleteSSHKey removes a public SSH key. */
  deleteSSHKey(
    request: DeleteSSHKeyRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<DeleteSSHKeyResponse>>;
  getGitToken(
    request: GetGitTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetGitTokenResponse>>;
}

export interface UserServiceClient<CallOptionsExt = {}> {
  /** GetAuthenticatedUser gets the user info. */
  getAuthenticatedUser(
    request: DeepPartial<GetAuthenticatedUserRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetAuthenticatedUserResponse>;
  /** ListSSHKeys lists the public SSH keys. */
  listSSHKeys(
    request: DeepPartial<ListSSHKeysRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ListSSHKeysResponse>;
  /** CreateSSHKey adds a public SSH key. */
  createSSHKey(
    request: DeepPartial<CreateSSHKeyRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateSSHKeyResponse>;
  /** GetSSHKey retrieves an ssh key by ID. */
  getSSHKey(request: DeepPartial<GetSSHKeyRequest>, options?: CallOptions & CallOptionsExt): Promise<GetSSHKeyResponse>;
  /** DeleteSSHKey removes a public SSH key. */
  deleteSSHKey(
    request: DeepPartial<DeleteSSHKeyRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<DeleteSSHKeyResponse>;
  getGitToken(
    request: DeepPartial<GetGitTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetGitTokenResponse>;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function toTimestamp(date: Date): Timestamp {
  const seconds = date.getTime() / 1_000;
  const nanos = (date.getTime() % 1_000) * 1_000_000;
  return { seconds, nanos };
}

function fromTimestamp(t: Timestamp): Date {
  let millis = t.seconds * 1_000;
  millis += t.nanos / 1_000_000;
  return new Date(millis);
}

function fromJsonTimestamp(o: any): Date {
  if (o instanceof Date) {
    return o;
  } else if (typeof o === "string") {
    return new Date(o);
  } else {
    return fromTimestamp(Timestamp.fromJSON(o));
  }
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
