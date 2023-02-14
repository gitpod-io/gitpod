/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v1.0.0 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/tokens.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { FieldMask, Message, proto3, protoInt64, Timestamp } from "@bufbuild/protobuf";
import { Pagination } from "./pagination_pb.js";

/**
 * PersonalAccessToken represents details of an access token for personal use.
 *
 * @generated from message gitpod.experimental.v1.PersonalAccessToken
 */
export class PersonalAccessToken extends Message<PersonalAccessToken> {
  /**
   * id is the unique identifier of this token
   * Read only.
   *
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * value is the secret value of the token
   * The value property is only populated when the PersonalAccessToken is first created, and never again.
   * Read only.
   *
   * @generated from field: string value = 2;
   */
  value = "";

  /**
   * name is the name of the token for humans, set by the user.
   * Must match regexp ^[a-zA-Z0-9-_ ]{3,63}$
   *
   * @generated from field: string name = 3;
   */
  name = "";

  /**
   * expiration_time is the time when the token expires
   * Read only.
   *
   * @generated from field: google.protobuf.Timestamp expiration_time = 4;
   */
  expirationTime?: Timestamp;

  /**
   * scopes are the permission scopes attached to this token.
   * By default, no scopes are attached and therefore no access is granted to this token.
   * Specifying '*' grants all permissions the owner of the token has.
   *
   * @generated from field: repeated string scopes = 5;
   */
  scopes: string[] = [];

  /**
   * created_time is the time when the token was first created.
   *
   * @generated from field: google.protobuf.Timestamp created_at = 6;
   */
  createdAt?: Timestamp;

  constructor(data?: PartialMessage<PersonalAccessToken>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.PersonalAccessToken";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "value", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 4, name: "expiration_time", kind: "message", T: Timestamp },
    { no: 5, name: "scopes", kind: "scalar", T: 9 /* ScalarType.STRING */, repeated: true },
    { no: 6, name: "created_at", kind: "message", T: Timestamp },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): PersonalAccessToken {
    return new PersonalAccessToken().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): PersonalAccessToken {
    return new PersonalAccessToken().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): PersonalAccessToken {
    return new PersonalAccessToken().fromJsonString(jsonString, options);
  }

  static equals(a: PersonalAccessToken | PlainMessage<PersonalAccessToken> | undefined, b: PersonalAccessToken | PlainMessage<PersonalAccessToken> | undefined): boolean {
    return proto3.util.equals(PersonalAccessToken, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreatePersonalAccessTokenRequest
 */
export class CreatePersonalAccessTokenRequest extends Message<CreatePersonalAccessTokenRequest> {
  /**
   * @generated from field: gitpod.experimental.v1.PersonalAccessToken token = 1;
   */
  token?: PersonalAccessToken;

  constructor(data?: PartialMessage<CreatePersonalAccessTokenRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreatePersonalAccessTokenRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "token", kind: "message", T: PersonalAccessToken },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreatePersonalAccessTokenRequest {
    return new CreatePersonalAccessTokenRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreatePersonalAccessTokenRequest {
    return new CreatePersonalAccessTokenRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreatePersonalAccessTokenRequest {
    return new CreatePersonalAccessTokenRequest().fromJsonString(jsonString, options);
  }

  static equals(a: CreatePersonalAccessTokenRequest | PlainMessage<CreatePersonalAccessTokenRequest> | undefined, b: CreatePersonalAccessTokenRequest | PlainMessage<CreatePersonalAccessTokenRequest> | undefined): boolean {
    return proto3.util.equals(CreatePersonalAccessTokenRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreatePersonalAccessTokenResponse
 */
export class CreatePersonalAccessTokenResponse extends Message<CreatePersonalAccessTokenResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.PersonalAccessToken token = 1;
   */
  token?: PersonalAccessToken;

  constructor(data?: PartialMessage<CreatePersonalAccessTokenResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreatePersonalAccessTokenResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "token", kind: "message", T: PersonalAccessToken },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreatePersonalAccessTokenResponse {
    return new CreatePersonalAccessTokenResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreatePersonalAccessTokenResponse {
    return new CreatePersonalAccessTokenResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreatePersonalAccessTokenResponse {
    return new CreatePersonalAccessTokenResponse().fromJsonString(jsonString, options);
  }

  static equals(a: CreatePersonalAccessTokenResponse | PlainMessage<CreatePersonalAccessTokenResponse> | undefined, b: CreatePersonalAccessTokenResponse | PlainMessage<CreatePersonalAccessTokenResponse> | undefined): boolean {
    return proto3.util.equals(CreatePersonalAccessTokenResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetPersonalAccessTokenRequest
 */
export class GetPersonalAccessTokenRequest extends Message<GetPersonalAccessTokenRequest> {
  /**
   * @generated from field: string id = 1;
   */
  id = "";

  constructor(data?: PartialMessage<GetPersonalAccessTokenRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetPersonalAccessTokenRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetPersonalAccessTokenRequest {
    return new GetPersonalAccessTokenRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetPersonalAccessTokenRequest {
    return new GetPersonalAccessTokenRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetPersonalAccessTokenRequest {
    return new GetPersonalAccessTokenRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetPersonalAccessTokenRequest | PlainMessage<GetPersonalAccessTokenRequest> | undefined, b: GetPersonalAccessTokenRequest | PlainMessage<GetPersonalAccessTokenRequest> | undefined): boolean {
    return proto3.util.equals(GetPersonalAccessTokenRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetPersonalAccessTokenResponse
 */
export class GetPersonalAccessTokenResponse extends Message<GetPersonalAccessTokenResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.PersonalAccessToken token = 1;
   */
  token?: PersonalAccessToken;

  constructor(data?: PartialMessage<GetPersonalAccessTokenResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetPersonalAccessTokenResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "token", kind: "message", T: PersonalAccessToken },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetPersonalAccessTokenResponse {
    return new GetPersonalAccessTokenResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetPersonalAccessTokenResponse {
    return new GetPersonalAccessTokenResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetPersonalAccessTokenResponse {
    return new GetPersonalAccessTokenResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetPersonalAccessTokenResponse | PlainMessage<GetPersonalAccessTokenResponse> | undefined, b: GetPersonalAccessTokenResponse | PlainMessage<GetPersonalAccessTokenResponse> | undefined): boolean {
    return proto3.util.equals(GetPersonalAccessTokenResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ListPersonalAccessTokensRequest
 */
export class ListPersonalAccessTokensRequest extends Message<ListPersonalAccessTokensRequest> {
  /**
   * Page information
   *
   * @generated from field: gitpod.experimental.v1.Pagination pagination = 1;
   */
  pagination?: Pagination;

  constructor(data?: PartialMessage<ListPersonalAccessTokensRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListPersonalAccessTokensRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "pagination", kind: "message", T: Pagination },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListPersonalAccessTokensRequest {
    return new ListPersonalAccessTokensRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListPersonalAccessTokensRequest {
    return new ListPersonalAccessTokensRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListPersonalAccessTokensRequest {
    return new ListPersonalAccessTokensRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListPersonalAccessTokensRequest | PlainMessage<ListPersonalAccessTokensRequest> | undefined, b: ListPersonalAccessTokensRequest | PlainMessage<ListPersonalAccessTokensRequest> | undefined): boolean {
    return proto3.util.equals(ListPersonalAccessTokensRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ListPersonalAccessTokensResponse
 */
export class ListPersonalAccessTokensResponse extends Message<ListPersonalAccessTokensResponse> {
  /**
   * @generated from field: repeated gitpod.experimental.v1.PersonalAccessToken tokens = 1;
   */
  tokens: PersonalAccessToken[] = [];

  /**
   * @generated from field: int64 total_results = 2;
   */
  totalResults = protoInt64.zero;

  constructor(data?: PartialMessage<ListPersonalAccessTokensResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListPersonalAccessTokensResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "tokens", kind: "message", T: PersonalAccessToken, repeated: true },
    { no: 2, name: "total_results", kind: "scalar", T: 3 /* ScalarType.INT64 */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListPersonalAccessTokensResponse {
    return new ListPersonalAccessTokensResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListPersonalAccessTokensResponse {
    return new ListPersonalAccessTokensResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListPersonalAccessTokensResponse {
    return new ListPersonalAccessTokensResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListPersonalAccessTokensResponse | PlainMessage<ListPersonalAccessTokensResponse> | undefined, b: ListPersonalAccessTokensResponse | PlainMessage<ListPersonalAccessTokensResponse> | undefined): boolean {
    return proto3.util.equals(ListPersonalAccessTokensResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.RegeneratePersonalAccessTokenRequest
 */
export class RegeneratePersonalAccessTokenRequest extends Message<RegeneratePersonalAccessTokenRequest> {
  /**
   * id is the ID of the PersonalAccessToken
   *
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * expiration time is the time when the new token should expire
   *
   * @generated from field: google.protobuf.Timestamp expiration_time = 2;
   */
  expirationTime?: Timestamp;

  constructor(data?: PartialMessage<RegeneratePersonalAccessTokenRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.RegeneratePersonalAccessTokenRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "expiration_time", kind: "message", T: Timestamp },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): RegeneratePersonalAccessTokenRequest {
    return new RegeneratePersonalAccessTokenRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): RegeneratePersonalAccessTokenRequest {
    return new RegeneratePersonalAccessTokenRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): RegeneratePersonalAccessTokenRequest {
    return new RegeneratePersonalAccessTokenRequest().fromJsonString(jsonString, options);
  }

  static equals(a: RegeneratePersonalAccessTokenRequest | PlainMessage<RegeneratePersonalAccessTokenRequest> | undefined, b: RegeneratePersonalAccessTokenRequest | PlainMessage<RegeneratePersonalAccessTokenRequest> | undefined): boolean {
    return proto3.util.equals(RegeneratePersonalAccessTokenRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.RegeneratePersonalAccessTokenResponse
 */
export class RegeneratePersonalAccessTokenResponse extends Message<RegeneratePersonalAccessTokenResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.PersonalAccessToken token = 1;
   */
  token?: PersonalAccessToken;

  constructor(data?: PartialMessage<RegeneratePersonalAccessTokenResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.RegeneratePersonalAccessTokenResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "token", kind: "message", T: PersonalAccessToken },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): RegeneratePersonalAccessTokenResponse {
    return new RegeneratePersonalAccessTokenResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): RegeneratePersonalAccessTokenResponse {
    return new RegeneratePersonalAccessTokenResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): RegeneratePersonalAccessTokenResponse {
    return new RegeneratePersonalAccessTokenResponse().fromJsonString(jsonString, options);
  }

  static equals(a: RegeneratePersonalAccessTokenResponse | PlainMessage<RegeneratePersonalAccessTokenResponse> | undefined, b: RegeneratePersonalAccessTokenResponse | PlainMessage<RegeneratePersonalAccessTokenResponse> | undefined): boolean {
    return proto3.util.equals(RegeneratePersonalAccessTokenResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.UpdatePersonalAccessTokenRequest
 */
export class UpdatePersonalAccessTokenRequest extends Message<UpdatePersonalAccessTokenRequest> {
  /**
   * @generated from field: gitpod.experimental.v1.PersonalAccessToken token = 1;
   */
  token?: PersonalAccessToken;

  /**
   * @generated from field: google.protobuf.FieldMask update_mask = 2;
   */
  updateMask?: FieldMask;

  constructor(data?: PartialMessage<UpdatePersonalAccessTokenRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.UpdatePersonalAccessTokenRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "token", kind: "message", T: PersonalAccessToken },
    { no: 2, name: "update_mask", kind: "message", T: FieldMask },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdatePersonalAccessTokenRequest {
    return new UpdatePersonalAccessTokenRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdatePersonalAccessTokenRequest {
    return new UpdatePersonalAccessTokenRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdatePersonalAccessTokenRequest {
    return new UpdatePersonalAccessTokenRequest().fromJsonString(jsonString, options);
  }

  static equals(a: UpdatePersonalAccessTokenRequest | PlainMessage<UpdatePersonalAccessTokenRequest> | undefined, b: UpdatePersonalAccessTokenRequest | PlainMessage<UpdatePersonalAccessTokenRequest> | undefined): boolean {
    return proto3.util.equals(UpdatePersonalAccessTokenRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.UpdatePersonalAccessTokenResponse
 */
export class UpdatePersonalAccessTokenResponse extends Message<UpdatePersonalAccessTokenResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.PersonalAccessToken token = 1;
   */
  token?: PersonalAccessToken;

  constructor(data?: PartialMessage<UpdatePersonalAccessTokenResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.UpdatePersonalAccessTokenResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "token", kind: "message", T: PersonalAccessToken },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdatePersonalAccessTokenResponse {
    return new UpdatePersonalAccessTokenResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdatePersonalAccessTokenResponse {
    return new UpdatePersonalAccessTokenResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdatePersonalAccessTokenResponse {
    return new UpdatePersonalAccessTokenResponse().fromJsonString(jsonString, options);
  }

  static equals(a: UpdatePersonalAccessTokenResponse | PlainMessage<UpdatePersonalAccessTokenResponse> | undefined, b: UpdatePersonalAccessTokenResponse | PlainMessage<UpdatePersonalAccessTokenResponse> | undefined): boolean {
    return proto3.util.equals(UpdatePersonalAccessTokenResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeletePersonalAccessTokenRequest
 */
export class DeletePersonalAccessTokenRequest extends Message<DeletePersonalAccessTokenRequest> {
  /**
   * @generated from field: string id = 1;
   */
  id = "";

  constructor(data?: PartialMessage<DeletePersonalAccessTokenRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeletePersonalAccessTokenRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeletePersonalAccessTokenRequest {
    return new DeletePersonalAccessTokenRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeletePersonalAccessTokenRequest {
    return new DeletePersonalAccessTokenRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeletePersonalAccessTokenRequest {
    return new DeletePersonalAccessTokenRequest().fromJsonString(jsonString, options);
  }

  static equals(a: DeletePersonalAccessTokenRequest | PlainMessage<DeletePersonalAccessTokenRequest> | undefined, b: DeletePersonalAccessTokenRequest | PlainMessage<DeletePersonalAccessTokenRequest> | undefined): boolean {
    return proto3.util.equals(DeletePersonalAccessTokenRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeletePersonalAccessTokenResponse
 */
export class DeletePersonalAccessTokenResponse extends Message<DeletePersonalAccessTokenResponse> {
  constructor(data?: PartialMessage<DeletePersonalAccessTokenResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeletePersonalAccessTokenResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeletePersonalAccessTokenResponse {
    return new DeletePersonalAccessTokenResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeletePersonalAccessTokenResponse {
    return new DeletePersonalAccessTokenResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeletePersonalAccessTokenResponse {
    return new DeletePersonalAccessTokenResponse().fromJsonString(jsonString, options);
  }

  static equals(a: DeletePersonalAccessTokenResponse | PlainMessage<DeletePersonalAccessTokenResponse> | undefined, b: DeletePersonalAccessTokenResponse | PlainMessage<DeletePersonalAccessTokenResponse> | undefined): boolean {
    return proto3.util.equals(DeletePersonalAccessTokenResponse, a, b);
  }
}
