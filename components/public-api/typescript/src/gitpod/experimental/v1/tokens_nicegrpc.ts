/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { FieldMask } from "../../../google/protobuf/field_mask_nicegrpc";
import { Timestamp } from "../../../google/protobuf/timestamp_nicegrpc";
import { Pagination } from "./pagination_nicegrpc";

export const protobufPackage = "gitpod.experimental.v1";

/** PersonalAccessToken represents details of an access token for personal use. */
export interface PersonalAccessToken {
  /**
   * id is the unique identifier of this token
   * Read only.
   */
  id: string;
  /**
   * value is the secret value of the token
   * The value property is only populated when the PersonalAccessToken is first created, and never again.
   * Read only.
   */
  value: string;
  /**
   * name is the name of the token for humans, set by the user.
   * Must match regexp ^[a-zA-Z0-9-_ ]{3,63}$
   */
  name: string;
  /**
   * expiration_time is the time when the token expires
   * Read only.
   */
  expirationTime:
    | Date
    | undefined;
  /**
   * scopes are the permission scopes attached to this token.
   * By default, no scopes are attached and therefore no access is granted to this token.
   * Specifying '*' grants all permissions the owner of the token has.
   */
  scopes: string[];
  /** created_time is the time when the token was first created. */
  createdAt: Date | undefined;
}

export interface CreatePersonalAccessTokenRequest {
  token: PersonalAccessToken | undefined;
}

export interface CreatePersonalAccessTokenResponse {
  token: PersonalAccessToken | undefined;
}

export interface GetPersonalAccessTokenRequest {
  id: string;
}

export interface GetPersonalAccessTokenResponse {
  token: PersonalAccessToken | undefined;
}

export interface ListPersonalAccessTokensRequest {
  /** Page information */
  pagination: Pagination | undefined;
}

export interface ListPersonalAccessTokensResponse {
  tokens: PersonalAccessToken[];
  totalResults: number;
}

export interface RegeneratePersonalAccessTokenRequest {
  /** id is the ID of the PersonalAccessToken */
  id: string;
  /** expiration time is the time when the new token should expire */
  expirationTime: Date | undefined;
}

export interface RegeneratePersonalAccessTokenResponse {
  token: PersonalAccessToken | undefined;
}

export interface UpdatePersonalAccessTokenRequest {
  token: PersonalAccessToken | undefined;
  updateMask: string[] | undefined;
}

export interface UpdatePersonalAccessTokenResponse {
  token: PersonalAccessToken | undefined;
}

export interface DeletePersonalAccessTokenRequest {
  id: string;
}

export interface DeletePersonalAccessTokenResponse {
}

function createBasePersonalAccessToken(): PersonalAccessToken {
  return { id: "", value: "", name: "", expirationTime: undefined, scopes: [], createdAt: undefined };
}

export const PersonalAccessToken = {
  encode(message: PersonalAccessToken, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    if (message.name !== "") {
      writer.uint32(26).string(message.name);
    }
    if (message.expirationTime !== undefined) {
      Timestamp.encode(toTimestamp(message.expirationTime), writer.uint32(34).fork()).ldelim();
    }
    for (const v of message.scopes) {
      writer.uint32(42).string(v!);
    }
    if (message.createdAt !== undefined) {
      Timestamp.encode(toTimestamp(message.createdAt), writer.uint32(50).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PersonalAccessToken {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePersonalAccessToken();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.value = reader.string();
          break;
        case 3:
          message.name = reader.string();
          break;
        case 4:
          message.expirationTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 5:
          message.scopes.push(reader.string());
          break;
        case 6:
          message.createdAt = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PersonalAccessToken {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      value: isSet(object.value) ? String(object.value) : "",
      name: isSet(object.name) ? String(object.name) : "",
      expirationTime: isSet(object.expirationTime) ? fromJsonTimestamp(object.expirationTime) : undefined,
      scopes: Array.isArray(object?.scopes) ? object.scopes.map((e: any) => String(e)) : [],
      createdAt: isSet(object.createdAt) ? fromJsonTimestamp(object.createdAt) : undefined,
    };
  },

  toJSON(message: PersonalAccessToken): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.value !== undefined && (obj.value = message.value);
    message.name !== undefined && (obj.name = message.name);
    message.expirationTime !== undefined && (obj.expirationTime = message.expirationTime.toISOString());
    if (message.scopes) {
      obj.scopes = message.scopes.map((e) => e);
    } else {
      obj.scopes = [];
    }
    message.createdAt !== undefined && (obj.createdAt = message.createdAt.toISOString());
    return obj;
  },

  create(base?: DeepPartial<PersonalAccessToken>): PersonalAccessToken {
    return PersonalAccessToken.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<PersonalAccessToken>): PersonalAccessToken {
    const message = createBasePersonalAccessToken();
    message.id = object.id ?? "";
    message.value = object.value ?? "";
    message.name = object.name ?? "";
    message.expirationTime = object.expirationTime ?? undefined;
    message.scopes = object.scopes?.map((e) => e) || [];
    message.createdAt = object.createdAt ?? undefined;
    return message;
  },
};

function createBaseCreatePersonalAccessTokenRequest(): CreatePersonalAccessTokenRequest {
  return { token: undefined };
}

export const CreatePersonalAccessTokenRequest = {
  encode(message: CreatePersonalAccessTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== undefined) {
      PersonalAccessToken.encode(message.token, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreatePersonalAccessTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreatePersonalAccessTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = PersonalAccessToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreatePersonalAccessTokenRequest {
    return { token: isSet(object.token) ? PersonalAccessToken.fromJSON(object.token) : undefined };
  },

  toJSON(message: CreatePersonalAccessTokenRequest): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token ? PersonalAccessToken.toJSON(message.token) : undefined);
    return obj;
  },

  create(base?: DeepPartial<CreatePersonalAccessTokenRequest>): CreatePersonalAccessTokenRequest {
    return CreatePersonalAccessTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreatePersonalAccessTokenRequest>): CreatePersonalAccessTokenRequest {
    const message = createBaseCreatePersonalAccessTokenRequest();
    message.token = (object.token !== undefined && object.token !== null)
      ? PersonalAccessToken.fromPartial(object.token)
      : undefined;
    return message;
  },
};

function createBaseCreatePersonalAccessTokenResponse(): CreatePersonalAccessTokenResponse {
  return { token: undefined };
}

export const CreatePersonalAccessTokenResponse = {
  encode(message: CreatePersonalAccessTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== undefined) {
      PersonalAccessToken.encode(message.token, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreatePersonalAccessTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreatePersonalAccessTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = PersonalAccessToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreatePersonalAccessTokenResponse {
    return { token: isSet(object.token) ? PersonalAccessToken.fromJSON(object.token) : undefined };
  },

  toJSON(message: CreatePersonalAccessTokenResponse): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token ? PersonalAccessToken.toJSON(message.token) : undefined);
    return obj;
  },

  create(base?: DeepPartial<CreatePersonalAccessTokenResponse>): CreatePersonalAccessTokenResponse {
    return CreatePersonalAccessTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreatePersonalAccessTokenResponse>): CreatePersonalAccessTokenResponse {
    const message = createBaseCreatePersonalAccessTokenResponse();
    message.token = (object.token !== undefined && object.token !== null)
      ? PersonalAccessToken.fromPartial(object.token)
      : undefined;
    return message;
  },
};

function createBaseGetPersonalAccessTokenRequest(): GetPersonalAccessTokenRequest {
  return { id: "" };
}

export const GetPersonalAccessTokenRequest = {
  encode(message: GetPersonalAccessTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetPersonalAccessTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetPersonalAccessTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetPersonalAccessTokenRequest {
    return { id: isSet(object.id) ? String(object.id) : "" };
  },

  toJSON(message: GetPersonalAccessTokenRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    return obj;
  },

  create(base?: DeepPartial<GetPersonalAccessTokenRequest>): GetPersonalAccessTokenRequest {
    return GetPersonalAccessTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetPersonalAccessTokenRequest>): GetPersonalAccessTokenRequest {
    const message = createBaseGetPersonalAccessTokenRequest();
    message.id = object.id ?? "";
    return message;
  },
};

function createBaseGetPersonalAccessTokenResponse(): GetPersonalAccessTokenResponse {
  return { token: undefined };
}

export const GetPersonalAccessTokenResponse = {
  encode(message: GetPersonalAccessTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== undefined) {
      PersonalAccessToken.encode(message.token, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetPersonalAccessTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetPersonalAccessTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = PersonalAccessToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetPersonalAccessTokenResponse {
    return { token: isSet(object.token) ? PersonalAccessToken.fromJSON(object.token) : undefined };
  },

  toJSON(message: GetPersonalAccessTokenResponse): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token ? PersonalAccessToken.toJSON(message.token) : undefined);
    return obj;
  },

  create(base?: DeepPartial<GetPersonalAccessTokenResponse>): GetPersonalAccessTokenResponse {
    return GetPersonalAccessTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetPersonalAccessTokenResponse>): GetPersonalAccessTokenResponse {
    const message = createBaseGetPersonalAccessTokenResponse();
    message.token = (object.token !== undefined && object.token !== null)
      ? PersonalAccessToken.fromPartial(object.token)
      : undefined;
    return message;
  },
};

function createBaseListPersonalAccessTokensRequest(): ListPersonalAccessTokensRequest {
  return { pagination: undefined };
}

export const ListPersonalAccessTokensRequest = {
  encode(message: ListPersonalAccessTokensRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      Pagination.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListPersonalAccessTokensRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListPersonalAccessTokensRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = Pagination.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListPersonalAccessTokensRequest {
    return { pagination: isSet(object.pagination) ? Pagination.fromJSON(object.pagination) : undefined };
  },

  toJSON(message: ListPersonalAccessTokensRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined &&
      (obj.pagination = message.pagination ? Pagination.toJSON(message.pagination) : undefined);
    return obj;
  },

  create(base?: DeepPartial<ListPersonalAccessTokensRequest>): ListPersonalAccessTokensRequest {
    return ListPersonalAccessTokensRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListPersonalAccessTokensRequest>): ListPersonalAccessTokensRequest {
    const message = createBaseListPersonalAccessTokensRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? Pagination.fromPartial(object.pagination)
      : undefined;
    return message;
  },
};

function createBaseListPersonalAccessTokensResponse(): ListPersonalAccessTokensResponse {
  return { tokens: [], totalResults: 0 };
}

export const ListPersonalAccessTokensResponse = {
  encode(message: ListPersonalAccessTokensResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.tokens) {
      PersonalAccessToken.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.totalResults !== 0) {
      writer.uint32(16).int64(message.totalResults);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListPersonalAccessTokensResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListPersonalAccessTokensResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tokens.push(PersonalAccessToken.decode(reader, reader.uint32()));
          break;
        case 2:
          message.totalResults = longToNumber(reader.int64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListPersonalAccessTokensResponse {
    return {
      tokens: Array.isArray(object?.tokens) ? object.tokens.map((e: any) => PersonalAccessToken.fromJSON(e)) : [],
      totalResults: isSet(object.totalResults) ? Number(object.totalResults) : 0,
    };
  },

  toJSON(message: ListPersonalAccessTokensResponse): unknown {
    const obj: any = {};
    if (message.tokens) {
      obj.tokens = message.tokens.map((e) => e ? PersonalAccessToken.toJSON(e) : undefined);
    } else {
      obj.tokens = [];
    }
    message.totalResults !== undefined && (obj.totalResults = Math.round(message.totalResults));
    return obj;
  },

  create(base?: DeepPartial<ListPersonalAccessTokensResponse>): ListPersonalAccessTokensResponse {
    return ListPersonalAccessTokensResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListPersonalAccessTokensResponse>): ListPersonalAccessTokensResponse {
    const message = createBaseListPersonalAccessTokensResponse();
    message.tokens = object.tokens?.map((e) => PersonalAccessToken.fromPartial(e)) || [];
    message.totalResults = object.totalResults ?? 0;
    return message;
  },
};

function createBaseRegeneratePersonalAccessTokenRequest(): RegeneratePersonalAccessTokenRequest {
  return { id: "", expirationTime: undefined };
}

export const RegeneratePersonalAccessTokenRequest = {
  encode(message: RegeneratePersonalAccessTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.expirationTime !== undefined) {
      Timestamp.encode(toTimestamp(message.expirationTime), writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RegeneratePersonalAccessTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRegeneratePersonalAccessTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.expirationTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RegeneratePersonalAccessTokenRequest {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      expirationTime: isSet(object.expirationTime) ? fromJsonTimestamp(object.expirationTime) : undefined,
    };
  },

  toJSON(message: RegeneratePersonalAccessTokenRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.expirationTime !== undefined && (obj.expirationTime = message.expirationTime.toISOString());
    return obj;
  },

  create(base?: DeepPartial<RegeneratePersonalAccessTokenRequest>): RegeneratePersonalAccessTokenRequest {
    return RegeneratePersonalAccessTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<RegeneratePersonalAccessTokenRequest>): RegeneratePersonalAccessTokenRequest {
    const message = createBaseRegeneratePersonalAccessTokenRequest();
    message.id = object.id ?? "";
    message.expirationTime = object.expirationTime ?? undefined;
    return message;
  },
};

function createBaseRegeneratePersonalAccessTokenResponse(): RegeneratePersonalAccessTokenResponse {
  return { token: undefined };
}

export const RegeneratePersonalAccessTokenResponse = {
  encode(message: RegeneratePersonalAccessTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== undefined) {
      PersonalAccessToken.encode(message.token, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RegeneratePersonalAccessTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRegeneratePersonalAccessTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = PersonalAccessToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RegeneratePersonalAccessTokenResponse {
    return { token: isSet(object.token) ? PersonalAccessToken.fromJSON(object.token) : undefined };
  },

  toJSON(message: RegeneratePersonalAccessTokenResponse): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token ? PersonalAccessToken.toJSON(message.token) : undefined);
    return obj;
  },

  create(base?: DeepPartial<RegeneratePersonalAccessTokenResponse>): RegeneratePersonalAccessTokenResponse {
    return RegeneratePersonalAccessTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<RegeneratePersonalAccessTokenResponse>): RegeneratePersonalAccessTokenResponse {
    const message = createBaseRegeneratePersonalAccessTokenResponse();
    message.token = (object.token !== undefined && object.token !== null)
      ? PersonalAccessToken.fromPartial(object.token)
      : undefined;
    return message;
  },
};

function createBaseUpdatePersonalAccessTokenRequest(): UpdatePersonalAccessTokenRequest {
  return { token: undefined, updateMask: undefined };
}

export const UpdatePersonalAccessTokenRequest = {
  encode(message: UpdatePersonalAccessTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== undefined) {
      PersonalAccessToken.encode(message.token, writer.uint32(10).fork()).ldelim();
    }
    if (message.updateMask !== undefined) {
      FieldMask.encode(FieldMask.wrap(message.updateMask), writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdatePersonalAccessTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdatePersonalAccessTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = PersonalAccessToken.decode(reader, reader.uint32());
          break;
        case 2:
          message.updateMask = FieldMask.unwrap(FieldMask.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdatePersonalAccessTokenRequest {
    return {
      token: isSet(object.token) ? PersonalAccessToken.fromJSON(object.token) : undefined,
      updateMask: isSet(object.updateMask) ? FieldMask.unwrap(FieldMask.fromJSON(object.updateMask)) : undefined,
    };
  },

  toJSON(message: UpdatePersonalAccessTokenRequest): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token ? PersonalAccessToken.toJSON(message.token) : undefined);
    message.updateMask !== undefined && (obj.updateMask = FieldMask.toJSON(FieldMask.wrap(message.updateMask)));
    return obj;
  },

  create(base?: DeepPartial<UpdatePersonalAccessTokenRequest>): UpdatePersonalAccessTokenRequest {
    return UpdatePersonalAccessTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdatePersonalAccessTokenRequest>): UpdatePersonalAccessTokenRequest {
    const message = createBaseUpdatePersonalAccessTokenRequest();
    message.token = (object.token !== undefined && object.token !== null)
      ? PersonalAccessToken.fromPartial(object.token)
      : undefined;
    message.updateMask = object.updateMask ?? undefined;
    return message;
  },
};

function createBaseUpdatePersonalAccessTokenResponse(): UpdatePersonalAccessTokenResponse {
  return { token: undefined };
}

export const UpdatePersonalAccessTokenResponse = {
  encode(message: UpdatePersonalAccessTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.token !== undefined) {
      PersonalAccessToken.encode(message.token, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdatePersonalAccessTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdatePersonalAccessTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token = PersonalAccessToken.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdatePersonalAccessTokenResponse {
    return { token: isSet(object.token) ? PersonalAccessToken.fromJSON(object.token) : undefined };
  },

  toJSON(message: UpdatePersonalAccessTokenResponse): unknown {
    const obj: any = {};
    message.token !== undefined && (obj.token = message.token ? PersonalAccessToken.toJSON(message.token) : undefined);
    return obj;
  },

  create(base?: DeepPartial<UpdatePersonalAccessTokenResponse>): UpdatePersonalAccessTokenResponse {
    return UpdatePersonalAccessTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdatePersonalAccessTokenResponse>): UpdatePersonalAccessTokenResponse {
    const message = createBaseUpdatePersonalAccessTokenResponse();
    message.token = (object.token !== undefined && object.token !== null)
      ? PersonalAccessToken.fromPartial(object.token)
      : undefined;
    return message;
  },
};

function createBaseDeletePersonalAccessTokenRequest(): DeletePersonalAccessTokenRequest {
  return { id: "" };
}

export const DeletePersonalAccessTokenRequest = {
  encode(message: DeletePersonalAccessTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeletePersonalAccessTokenRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeletePersonalAccessTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeletePersonalAccessTokenRequest {
    return { id: isSet(object.id) ? String(object.id) : "" };
  },

  toJSON(message: DeletePersonalAccessTokenRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    return obj;
  },

  create(base?: DeepPartial<DeletePersonalAccessTokenRequest>): DeletePersonalAccessTokenRequest {
    return DeletePersonalAccessTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeletePersonalAccessTokenRequest>): DeletePersonalAccessTokenRequest {
    const message = createBaseDeletePersonalAccessTokenRequest();
    message.id = object.id ?? "";
    return message;
  },
};

function createBaseDeletePersonalAccessTokenResponse(): DeletePersonalAccessTokenResponse {
  return {};
}

export const DeletePersonalAccessTokenResponse = {
  encode(_: DeletePersonalAccessTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeletePersonalAccessTokenResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeletePersonalAccessTokenResponse();
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

  fromJSON(_: any): DeletePersonalAccessTokenResponse {
    return {};
  },

  toJSON(_: DeletePersonalAccessTokenResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<DeletePersonalAccessTokenResponse>): DeletePersonalAccessTokenResponse {
    return DeletePersonalAccessTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeletePersonalAccessTokenResponse>): DeletePersonalAccessTokenResponse {
    const message = createBaseDeletePersonalAccessTokenResponse();
    return message;
  },
};

export type TokensServiceDefinition = typeof TokensServiceDefinition;
export const TokensServiceDefinition = {
  name: "TokensService",
  fullName: "gitpod.experimental.v1.TokensService",
  methods: {
    /** CreatePersonalAccessTokenRequest creates a new token. */
    createPersonalAccessToken: {
      name: "CreatePersonalAccessToken",
      requestType: CreatePersonalAccessTokenRequest,
      requestStream: false,
      responseType: CreatePersonalAccessTokenResponse,
      responseStream: false,
      options: {},
    },
    /** ListPersonalAccessTokens returns token by ID. */
    getPersonalAccessToken: {
      name: "GetPersonalAccessToken",
      requestType: GetPersonalAccessTokenRequest,
      requestStream: false,
      responseType: GetPersonalAccessTokenResponse,
      responseStream: false,
      options: {},
    },
    /** ListPersonalAccessTokens returns a list of tokens. */
    listPersonalAccessTokens: {
      name: "ListPersonalAccessTokens",
      requestType: ListPersonalAccessTokensRequest,
      requestStream: false,
      responseType: ListPersonalAccessTokensResponse,
      responseStream: false,
      options: {},
    },
    /** RegeneratePersonalAccessToken generates a new token and replaces the previous one. */
    regeneratePersonalAccessToken: {
      name: "RegeneratePersonalAccessToken",
      requestType: RegeneratePersonalAccessTokenRequest,
      requestStream: false,
      responseType: RegeneratePersonalAccessTokenResponse,
      responseStream: false,
      options: {},
    },
    /** UpdatePersonalAccessToken updates writable properties of a PersonalAccessToken. */
    updatePersonalAccessToken: {
      name: "UpdatePersonalAccessToken",
      requestType: UpdatePersonalAccessTokenRequest,
      requestStream: false,
      responseType: UpdatePersonalAccessTokenResponse,
      responseStream: false,
      options: {},
    },
    /** DeletePersonalAccessToken removes token by ID. */
    deletePersonalAccessToken: {
      name: "DeletePersonalAccessToken",
      requestType: DeletePersonalAccessTokenRequest,
      requestStream: false,
      responseType: DeletePersonalAccessTokenResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface TokensServiceImplementation<CallContextExt = {}> {
  /** CreatePersonalAccessTokenRequest creates a new token. */
  createPersonalAccessToken(
    request: CreatePersonalAccessTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreatePersonalAccessTokenResponse>>;
  /** ListPersonalAccessTokens returns token by ID. */
  getPersonalAccessToken(
    request: GetPersonalAccessTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetPersonalAccessTokenResponse>>;
  /** ListPersonalAccessTokens returns a list of tokens. */
  listPersonalAccessTokens(
    request: ListPersonalAccessTokensRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ListPersonalAccessTokensResponse>>;
  /** RegeneratePersonalAccessToken generates a new token and replaces the previous one. */
  regeneratePersonalAccessToken(
    request: RegeneratePersonalAccessTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<RegeneratePersonalAccessTokenResponse>>;
  /** UpdatePersonalAccessToken updates writable properties of a PersonalAccessToken. */
  updatePersonalAccessToken(
    request: UpdatePersonalAccessTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<UpdatePersonalAccessTokenResponse>>;
  /** DeletePersonalAccessToken removes token by ID. */
  deletePersonalAccessToken(
    request: DeletePersonalAccessTokenRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<DeletePersonalAccessTokenResponse>>;
}

export interface TokensServiceClient<CallOptionsExt = {}> {
  /** CreatePersonalAccessTokenRequest creates a new token. */
  createPersonalAccessToken(
    request: DeepPartial<CreatePersonalAccessTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreatePersonalAccessTokenResponse>;
  /** ListPersonalAccessTokens returns token by ID. */
  getPersonalAccessToken(
    request: DeepPartial<GetPersonalAccessTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetPersonalAccessTokenResponse>;
  /** ListPersonalAccessTokens returns a list of tokens. */
  listPersonalAccessTokens(
    request: DeepPartial<ListPersonalAccessTokensRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ListPersonalAccessTokensResponse>;
  /** RegeneratePersonalAccessToken generates a new token and replaces the previous one. */
  regeneratePersonalAccessToken(
    request: DeepPartial<RegeneratePersonalAccessTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<RegeneratePersonalAccessTokenResponse>;
  /** UpdatePersonalAccessToken updates writable properties of a PersonalAccessToken. */
  updatePersonalAccessToken(
    request: DeepPartial<UpdatePersonalAccessTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<UpdatePersonalAccessTokenResponse>;
  /** DeletePersonalAccessToken removes token by ID. */
  deletePersonalAccessToken(
    request: DeepPartial<DeletePersonalAccessTokenRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<DeletePersonalAccessTokenResponse>;
}

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
var tsProtoGlobalThis: any = (() => {
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

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new tsProtoGlobalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
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
