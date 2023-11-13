/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v1.3.3 with parameter "target=ts"
// @generated from file gitpod/v1/authprovider.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message, proto3 } from "@bufbuild/protobuf";
import { PaginationRequest, PaginationResponse } from "./pagination_pb.js";

/**
 * @generated from enum gitpod.v1.AuthProviderType
 */
export enum AuthProviderType {
  /**
   * This value is not allowed.
   *
   * @generated from enum value: AUTH_PROVIDER_TYPE_UNSPECIFIED = 0;
   */
  UNSPECIFIED = 0,

  /**
   * @generated from enum value: AUTH_PROVIDER_TYPE_GITHUB = 1;
   */
  GITHUB = 1,

  /**
   * @generated from enum value: AUTH_PROVIDER_TYPE_GITLAB = 2;
   */
  GITLAB = 2,

  /**
   * @generated from enum value: AUTH_PROVIDER_TYPE_BITBUCKET = 3;
   */
  BITBUCKET = 3,

  /**
   * @generated from enum value: AUTH_PROVIDER_TYPE_BITBUCKET_SERVER = 4;
   */
  BITBUCKET_SERVER = 4,
}
// Retrieve enum metadata with: proto3.getEnumType(AuthProviderType)
proto3.util.setEnumType(AuthProviderType, "gitpod.v1.AuthProviderType", [
  { no: 0, name: "AUTH_PROVIDER_TYPE_UNSPECIFIED" },
  { no: 1, name: "AUTH_PROVIDER_TYPE_GITHUB" },
  { no: 2, name: "AUTH_PROVIDER_TYPE_GITLAB" },
  { no: 3, name: "AUTH_PROVIDER_TYPE_BITBUCKET" },
  { no: 4, name: "AUTH_PROVIDER_TYPE_BITBUCKET_SERVER" },
]);

/**
 * @generated from message gitpod.v1.CreateAuthProviderRequest
 */
export class CreateAuthProviderRequest extends Message<CreateAuthProviderRequest> {
  /**
   * @generated from oneof gitpod.v1.CreateAuthProviderRequest.owner
   */
  owner: {
    /**
     * @generated from field: string owner_id = 1;
     */
    value: string;
    case: "ownerId";
  } | {
    /**
     * @generated from field: string organization_id = 2;
     */
    value: string;
    case: "organizationId";
  } | { case: undefined; value?: undefined } = { case: undefined };

  /**
   * @generated from field: gitpod.v1.AuthProviderType type = 3;
   */
  type = AuthProviderType.UNSPECIFIED;

  /**
   * @generated from field: string host = 4;
   */
  host = "";

  /**
   * @generated from field: gitpod.v1.OAuth2Config oauth2_config = 5;
   */
  oauth2Config?: OAuth2Config;

  constructor(data?: PartialMessage<CreateAuthProviderRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.CreateAuthProviderRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "owner_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "owner" },
    { no: 2, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "owner" },
    { no: 3, name: "type", kind: "enum", T: proto3.getEnumType(AuthProviderType) },
    { no: 4, name: "host", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 5, name: "oauth2_config", kind: "message", T: OAuth2Config },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateAuthProviderRequest {
    return new CreateAuthProviderRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateAuthProviderRequest {
    return new CreateAuthProviderRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateAuthProviderRequest {
    return new CreateAuthProviderRequest().fromJsonString(jsonString, options);
  }

  static equals(a: CreateAuthProviderRequest | PlainMessage<CreateAuthProviderRequest> | undefined, b: CreateAuthProviderRequest | PlainMessage<CreateAuthProviderRequest> | undefined): boolean {
    return proto3.util.equals(CreateAuthProviderRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.CreateAuthProviderResponse
 */
export class CreateAuthProviderResponse extends Message<CreateAuthProviderResponse> {
  /**
   * @generated from field: gitpod.v1.AuthProvider auth_provider = 1;
   */
  authProvider?: AuthProvider;

  constructor(data?: PartialMessage<CreateAuthProviderResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.CreateAuthProviderResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "auth_provider", kind: "message", T: AuthProvider },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateAuthProviderResponse {
    return new CreateAuthProviderResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateAuthProviderResponse {
    return new CreateAuthProviderResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateAuthProviderResponse {
    return new CreateAuthProviderResponse().fromJsonString(jsonString, options);
  }

  static equals(a: CreateAuthProviderResponse | PlainMessage<CreateAuthProviderResponse> | undefined, b: CreateAuthProviderResponse | PlainMessage<CreateAuthProviderResponse> | undefined): boolean {
    return proto3.util.equals(CreateAuthProviderResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.GetAuthProviderRequest
 */
export class GetAuthProviderRequest extends Message<GetAuthProviderRequest> {
  /**
   * @generated from field: string auth_provider_id = 1;
   */
  authProviderId = "";

  constructor(data?: PartialMessage<GetAuthProviderRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetAuthProviderRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "auth_provider_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetAuthProviderRequest {
    return new GetAuthProviderRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetAuthProviderRequest {
    return new GetAuthProviderRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetAuthProviderRequest {
    return new GetAuthProviderRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetAuthProviderRequest | PlainMessage<GetAuthProviderRequest> | undefined, b: GetAuthProviderRequest | PlainMessage<GetAuthProviderRequest> | undefined): boolean {
    return proto3.util.equals(GetAuthProviderRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.GetAuthProviderResponse
 */
export class GetAuthProviderResponse extends Message<GetAuthProviderResponse> {
  /**
   * @generated from field: gitpod.v1.AuthProvider auth_provider = 1;
   */
  authProvider?: AuthProvider;

  constructor(data?: PartialMessage<GetAuthProviderResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetAuthProviderResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "auth_provider", kind: "message", T: AuthProvider },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetAuthProviderResponse {
    return new GetAuthProviderResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetAuthProviderResponse {
    return new GetAuthProviderResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetAuthProviderResponse {
    return new GetAuthProviderResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetAuthProviderResponse | PlainMessage<GetAuthProviderResponse> | undefined, b: GetAuthProviderResponse | PlainMessage<GetAuthProviderResponse> | undefined): boolean {
    return proto3.util.equals(GetAuthProviderResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListAuthProvidersRequest
 */
export class ListAuthProvidersRequest extends Message<ListAuthProvidersRequest> {
  /**
   * @generated from field: gitpod.v1.PaginationRequest pagination = 1;
   */
  pagination?: PaginationRequest;

  /**
   * @generated from oneof gitpod.v1.ListAuthProvidersRequest.id
   */
  id: {
    /**
     * @generated from field: string user_id = 2;
     */
    value: string;
    case: "userId";
  } | {
    /**
     * @generated from field: string organization_id = 3;
     */
    value: string;
    case: "organizationId";
  } | { case: undefined; value?: undefined } = { case: undefined };

  constructor(data?: PartialMessage<ListAuthProvidersRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListAuthProvidersRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "pagination", kind: "message", T: PaginationRequest },
    { no: 2, name: "user_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "id" },
    { no: 3, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "id" },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListAuthProvidersRequest {
    return new ListAuthProvidersRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListAuthProvidersRequest {
    return new ListAuthProvidersRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListAuthProvidersRequest {
    return new ListAuthProvidersRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListAuthProvidersRequest | PlainMessage<ListAuthProvidersRequest> | undefined, b: ListAuthProvidersRequest | PlainMessage<ListAuthProvidersRequest> | undefined): boolean {
    return proto3.util.equals(ListAuthProvidersRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListAuthProvidersResponse
 */
export class ListAuthProvidersResponse extends Message<ListAuthProvidersResponse> {
  /**
   * @generated from field: repeated gitpod.v1.AuthProvider auth_providers = 1;
   */
  authProviders: AuthProvider[] = [];

  /**
   * @generated from field: gitpod.v1.PaginationResponse pagination = 2;
   */
  pagination?: PaginationResponse;

  constructor(data?: PartialMessage<ListAuthProvidersResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListAuthProvidersResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "auth_providers", kind: "message", T: AuthProvider, repeated: true },
    { no: 2, name: "pagination", kind: "message", T: PaginationResponse },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListAuthProvidersResponse {
    return new ListAuthProvidersResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListAuthProvidersResponse {
    return new ListAuthProvidersResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListAuthProvidersResponse {
    return new ListAuthProvidersResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListAuthProvidersResponse | PlainMessage<ListAuthProvidersResponse> | undefined, b: ListAuthProvidersResponse | PlainMessage<ListAuthProvidersResponse> | undefined): boolean {
    return proto3.util.equals(ListAuthProvidersResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListAuthProviderDescriptionsRequest
 */
export class ListAuthProviderDescriptionsRequest extends Message<ListAuthProviderDescriptionsRequest> {
  /**
   * @generated from field: gitpod.v1.PaginationRequest pagination = 1;
   */
  pagination?: PaginationRequest;

  /**
   * @generated from oneof gitpod.v1.ListAuthProviderDescriptionsRequest.id
   */
  id: {
    /**
     * @generated from field: string user_id = 2;
     */
    value: string;
    case: "userId";
  } | {
    /**
     * @generated from field: string organization_id = 3;
     */
    value: string;
    case: "organizationId";
  } | { case: undefined; value?: undefined } = { case: undefined };

  constructor(data?: PartialMessage<ListAuthProviderDescriptionsRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListAuthProviderDescriptionsRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "pagination", kind: "message", T: PaginationRequest },
    { no: 2, name: "user_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "id" },
    { no: 3, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "id" },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListAuthProviderDescriptionsRequest {
    return new ListAuthProviderDescriptionsRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListAuthProviderDescriptionsRequest {
    return new ListAuthProviderDescriptionsRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListAuthProviderDescriptionsRequest {
    return new ListAuthProviderDescriptionsRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListAuthProviderDescriptionsRequest | PlainMessage<ListAuthProviderDescriptionsRequest> | undefined, b: ListAuthProviderDescriptionsRequest | PlainMessage<ListAuthProviderDescriptionsRequest> | undefined): boolean {
    return proto3.util.equals(ListAuthProviderDescriptionsRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListAuthProviderDescriptionsResponse
 */
export class ListAuthProviderDescriptionsResponse extends Message<ListAuthProviderDescriptionsResponse> {
  /**
   * @generated from field: repeated gitpod.v1.AuthProviderDescription descriptions = 1;
   */
  descriptions: AuthProviderDescription[] = [];

  /**
   * @generated from field: gitpod.v1.PaginationResponse pagination = 2;
   */
  pagination?: PaginationResponse;

  constructor(data?: PartialMessage<ListAuthProviderDescriptionsResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListAuthProviderDescriptionsResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "descriptions", kind: "message", T: AuthProviderDescription, repeated: true },
    { no: 2, name: "pagination", kind: "message", T: PaginationResponse },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListAuthProviderDescriptionsResponse {
    return new ListAuthProviderDescriptionsResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListAuthProviderDescriptionsResponse {
    return new ListAuthProviderDescriptionsResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListAuthProviderDescriptionsResponse {
    return new ListAuthProviderDescriptionsResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListAuthProviderDescriptionsResponse | PlainMessage<ListAuthProviderDescriptionsResponse> | undefined, b: ListAuthProviderDescriptionsResponse | PlainMessage<ListAuthProviderDescriptionsResponse> | undefined): boolean {
    return proto3.util.equals(ListAuthProviderDescriptionsResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.UpdateAuthProviderRequest
 */
export class UpdateAuthProviderRequest extends Message<UpdateAuthProviderRequest> {
  /**
   * @generated from field: string auth_provider_id = 1;
   */
  authProviderId = "";

  /**
   * @generated from field: optional string client_id = 2;
   */
  clientId?: string;

  /**
   * @generated from field: optional string client_secret = 3;
   */
  clientSecret?: string;

  constructor(data?: PartialMessage<UpdateAuthProviderRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.UpdateAuthProviderRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "auth_provider_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "client_id", kind: "scalar", T: 9 /* ScalarType.STRING */, opt: true },
    { no: 3, name: "client_secret", kind: "scalar", T: 9 /* ScalarType.STRING */, opt: true },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateAuthProviderRequest {
    return new UpdateAuthProviderRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateAuthProviderRequest {
    return new UpdateAuthProviderRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateAuthProviderRequest {
    return new UpdateAuthProviderRequest().fromJsonString(jsonString, options);
  }

  static equals(a: UpdateAuthProviderRequest | PlainMessage<UpdateAuthProviderRequest> | undefined, b: UpdateAuthProviderRequest | PlainMessage<UpdateAuthProviderRequest> | undefined): boolean {
    return proto3.util.equals(UpdateAuthProviderRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.UpdateAuthProviderResponse
 */
export class UpdateAuthProviderResponse extends Message<UpdateAuthProviderResponse> {
  constructor(data?: PartialMessage<UpdateAuthProviderResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.UpdateAuthProviderResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateAuthProviderResponse {
    return new UpdateAuthProviderResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateAuthProviderResponse {
    return new UpdateAuthProviderResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateAuthProviderResponse {
    return new UpdateAuthProviderResponse().fromJsonString(jsonString, options);
  }

  static equals(a: UpdateAuthProviderResponse | PlainMessage<UpdateAuthProviderResponse> | undefined, b: UpdateAuthProviderResponse | PlainMessage<UpdateAuthProviderResponse> | undefined): boolean {
    return proto3.util.equals(UpdateAuthProviderResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.DeleteAuthProviderRequest
 */
export class DeleteAuthProviderRequest extends Message<DeleteAuthProviderRequest> {
  /**
   * @generated from field: string auth_provider_id = 1;
   */
  authProviderId = "";

  constructor(data?: PartialMessage<DeleteAuthProviderRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.DeleteAuthProviderRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "auth_provider_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteAuthProviderRequest {
    return new DeleteAuthProviderRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteAuthProviderRequest {
    return new DeleteAuthProviderRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteAuthProviderRequest {
    return new DeleteAuthProviderRequest().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteAuthProviderRequest | PlainMessage<DeleteAuthProviderRequest> | undefined, b: DeleteAuthProviderRequest | PlainMessage<DeleteAuthProviderRequest> | undefined): boolean {
    return proto3.util.equals(DeleteAuthProviderRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.DeleteAuthProviderResponse
 */
export class DeleteAuthProviderResponse extends Message<DeleteAuthProviderResponse> {
  constructor(data?: PartialMessage<DeleteAuthProviderResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.DeleteAuthProviderResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteAuthProviderResponse {
    return new DeleteAuthProviderResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteAuthProviderResponse {
    return new DeleteAuthProviderResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteAuthProviderResponse {
    return new DeleteAuthProviderResponse().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteAuthProviderResponse | PlainMessage<DeleteAuthProviderResponse> | undefined, b: DeleteAuthProviderResponse | PlainMessage<DeleteAuthProviderResponse> | undefined): boolean {
    return proto3.util.equals(DeleteAuthProviderResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.AuthProviderDescription
 */
export class AuthProviderDescription extends Message<AuthProviderDescription> {
  /**
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * @generated from field: gitpod.v1.AuthProviderType type = 4;
   */
  type = AuthProviderType.UNSPECIFIED;

  /**
   * @generated from field: string host = 5;
   */
  host = "";

  /**
   * @generated from field: string icon = 6;
   */
  icon = "";

  /**
   * @generated from field: string description = 7;
   */
  description = "";

  constructor(data?: PartialMessage<AuthProviderDescription>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.AuthProviderDescription";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 4, name: "type", kind: "enum", T: proto3.getEnumType(AuthProviderType) },
    { no: 5, name: "host", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 6, name: "icon", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 7, name: "description", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AuthProviderDescription {
    return new AuthProviderDescription().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AuthProviderDescription {
    return new AuthProviderDescription().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AuthProviderDescription {
    return new AuthProviderDescription().fromJsonString(jsonString, options);
  }

  static equals(a: AuthProviderDescription | PlainMessage<AuthProviderDescription> | undefined, b: AuthProviderDescription | PlainMessage<AuthProviderDescription> | undefined): boolean {
    return proto3.util.equals(AuthProviderDescription, a, b);
  }
}

/**
 * @generated from message gitpod.v1.AuthProvider
 */
export class AuthProvider extends Message<AuthProvider> {
  /**
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * @generated from oneof gitpod.v1.AuthProvider.owner
   */
  owner: {
    /**
     * @generated from field: string owner_id = 2;
     */
    value: string;
    case: "ownerId";
  } | {
    /**
     * @generated from field: string organization_id = 3;
     */
    value: string;
    case: "organizationId";
  } | { case: undefined; value?: undefined } = { case: undefined };

  /**
   * @generated from field: gitpod.v1.AuthProviderType type = 4;
   */
  type = AuthProviderType.UNSPECIFIED;

  /**
   * @generated from field: string host = 5;
   */
  host = "";

  /**
   * @generated from field: string icon = 6;
   */
  icon = "";

  /**
   * @generated from field: string description = 7;
   */
  description = "";

  /**
   * @generated from field: string settings_url = 8;
   */
  settingsUrl = "";

  /**
   * @generated from field: bool verified = 9;
   */
  verified = false;

  /**
   * @generated from field: bool enable_login = 10;
   */
  enableLogin = false;

  /**
   * @generated from field: repeated string scopes = 11;
   */
  scopes: string[] = [];

  /**
   * @generated from field: gitpod.v1.OAuth2Config oauth2_config = 12;
   */
  oauth2Config?: OAuth2Config;

  constructor(data?: PartialMessage<AuthProvider>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.AuthProvider";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "owner_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "owner" },
    { no: 3, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */, oneof: "owner" },
    { no: 4, name: "type", kind: "enum", T: proto3.getEnumType(AuthProviderType) },
    { no: 5, name: "host", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 6, name: "icon", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 7, name: "description", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 8, name: "settings_url", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 9, name: "verified", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 10, name: "enable_login", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 11, name: "scopes", kind: "scalar", T: 9 /* ScalarType.STRING */, repeated: true },
    { no: 12, name: "oauth2_config", kind: "message", T: OAuth2Config },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): AuthProvider {
    return new AuthProvider().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): AuthProvider {
    return new AuthProvider().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): AuthProvider {
    return new AuthProvider().fromJsonString(jsonString, options);
  }

  static equals(a: AuthProvider | PlainMessage<AuthProvider> | undefined, b: AuthProvider | PlainMessage<AuthProvider> | undefined): boolean {
    return proto3.util.equals(AuthProvider, a, b);
  }
}

/**
 * @generated from message gitpod.v1.OAuth2Config
 */
export class OAuth2Config extends Message<OAuth2Config> {
  /**
   * @generated from field: string client_id = 1;
   */
  clientId = "";

  /**
   * @generated from field: string client_secret = 2;
   */
  clientSecret = "";

  constructor(data?: PartialMessage<OAuth2Config>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.OAuth2Config";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "client_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "client_secret", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): OAuth2Config {
    return new OAuth2Config().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): OAuth2Config {
    return new OAuth2Config().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): OAuth2Config {
    return new OAuth2Config().fromJsonString(jsonString, options);
  }

  static equals(a: OAuth2Config | PlainMessage<OAuth2Config> | undefined, b: OAuth2Config | PlainMessage<OAuth2Config> | undefined): boolean {
    return proto3.util.equals(OAuth2Config, a, b);
  }
}
