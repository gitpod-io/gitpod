/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v0.1.1 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/oidc.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import type {BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage} from "@bufbuild/protobuf";
import {Message, proto3, protoInt64, Timestamp} from "@bufbuild/protobuf";
import {Pagination} from "./pagination_pb.js";

/**
 * Configuration of an OpenID client.
 *
 * For the metadata describing the configuration of OIDC providers, cf.
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 *
 * @generated from message gitpod.experimental.v1.OIDCClientConfig
 */
export class OIDCClientConfig extends Message<OIDCClientConfig> {
  /**
   * ID is the unique identifier for the OIDC Config.
   * Read only.
   *
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * @generated from field: string organization_id = 2;
   */
  organizationId = "";

  /**
   * @generated from field: gitpod.experimental.v1.OIDCConfig oidc_config = 3;
   */
  oidcConfig?: OIDCConfig;

  /**
   * @generated from field: gitpod.experimental.v1.OAuth2Config oauth2_config = 4;
   */
  oauth2Config?: OAuth2Config;

  /**
   * Optional.
   *
   * @generated from field: bool oauth_only = 5;
   */
  oauthOnly = false;

  /**
   * List of the JWS signing algorithms (alg values) supported by the OP for the
   * ID Token to encode the Claims in a JWT. The algorithm RS256 MUST be
   * included.
   * Optional.
   *
   * @generated from field: repeated string id_token_signing_alg_values_supported = 6;
   */
  idTokenSigningAlgValuesSupported: string[] = [];

  /**
   * Time when the config was created.
   * Read-only.
   *
   * @generated from field: google.protobuf.Timestamp creation_time = 7;
   */
  creationTime?: Timestamp;

  /**
   * Describes the status of this configuration item.
   * Read-only.
   *
   * @generated from field: gitpod.experimental.v1.OIDCClientConfigStatus status = 8;
   */
  status?: OIDCClientConfigStatus;

  constructor(data?: PartialMessage<OIDCClientConfig>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.OIDCClientConfig";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "oidc_config", kind: "message", T: OIDCConfig },
    { no: 4, name: "oauth2_config", kind: "message", T: OAuth2Config },
    { no: 5, name: "oauth_only", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 6, name: "id_token_signing_alg_values_supported", kind: "scalar", T: 9 /* ScalarType.STRING */, repeated: true },
    { no: 7, name: "creation_time", kind: "message", T: Timestamp },
    { no: 8, name: "status", kind: "message", T: OIDCClientConfigStatus },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): OIDCClientConfig {
    return new OIDCClientConfig().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): OIDCClientConfig {
    return new OIDCClientConfig().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): OIDCClientConfig {
    return new OIDCClientConfig().fromJsonString(jsonString, options);
  }

  static equals(a: OIDCClientConfig | PlainMessage<OIDCClientConfig> | undefined, b: OIDCClientConfig | PlainMessage<OIDCClientConfig> | undefined): boolean {
    return proto3.util.equals(OIDCClientConfig, a, b);
  }
}

/**
 * The OIDC specific part of the client configuration.
 *
 * @generated from message gitpod.experimental.v1.OIDCConfig
 */
export class OIDCConfig extends Message<OIDCConfig> {
  /**
   * URL using the https scheme with no query or fragment component that the
   * OIDC provider asserts as its Issuer Identifier.
   * Required.
   *
   * @generated from field: string issuer = 1;
   */
  issuer = "";

  /**
   * A KeySet that can validate the id_token (JSON web token)
   * Either one is required.
   *
   * @generated from field: string jwks = 2;
   */
  jwks = "";

  /**
   * @generated from field: string jwks_url = 3;
   */
  jwksUrl = "";

  /**
   * Provider specific parameters to control the behavior of the consent screen.
   * Optional.
   *
   * @generated from field: gitpod.experimental.v1.ConsentScreenHints hints = 4;
   */
  hints?: ConsentScreenHints;

  /**
   * Optional overrides for key mapping to be applied when extracting claims from id_tokens.
   * Should only be set, if an override is required.
   * Optional.
   *
   * @generated from field: gitpod.experimental.v1.ClaimMappingOverride override_claim_mapping = 5;
   */
  overrideClaimMapping?: ClaimMappingOverride;

  constructor(data?: PartialMessage<OIDCConfig>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.OIDCConfig";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "issuer", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "jwks", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "jwks_url", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 4, name: "hints", kind: "message", T: ConsentScreenHints },
    { no: 5, name: "override_claim_mapping", kind: "message", T: ClaimMappingOverride },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): OIDCConfig {
    return new OIDCConfig().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): OIDCConfig {
    return new OIDCConfig().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): OIDCConfig {
    return new OIDCConfig().fromJsonString(jsonString, options);
  }

  static equals(a: OIDCConfig | PlainMessage<OIDCConfig> | undefined, b: OIDCConfig | PlainMessage<OIDCConfig> | undefined): boolean {
    return proto3.util.equals(OIDCConfig, a, b);
  }
}

/**
 * Provider specific parameters to control the behavior of the consent screen.
 *
 * @generated from message gitpod.experimental.v1.ConsentScreenHints
 */
export class ConsentScreenHints extends Message<ConsentScreenHints> {
  /**
   * Control options for the consent screen.
   * Optional.
   *
   * @generated from field: string prompt = 1;
   */
  prompt = "";

  /**
   * A hint to pre-select the tenant from an AD.
   * Optional.
   *
   * @generated from field: string domain_hint = 2;
   */
  domainHint = "";

  /**
   * Optional.
   *
   * @generated from field: string login_hint = 3;
   */
  loginHint = "";

  constructor(data?: PartialMessage<ConsentScreenHints>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ConsentScreenHints";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "prompt", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "domain_hint", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "login_hint", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ConsentScreenHints {
    return new ConsentScreenHints().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ConsentScreenHints {
    return new ConsentScreenHints().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ConsentScreenHints {
    return new ConsentScreenHints().fromJsonString(jsonString, options);
  }

  static equals(a: ConsentScreenHints | PlainMessage<ConsentScreenHints> | undefined, b: ConsentScreenHints | PlainMessage<ConsentScreenHints> | undefined): boolean {
    return proto3.util.equals(ConsentScreenHints, a, b);
  }
}

/**
 * Optional overrides for key mapping to be applied when extracting claims from id_tokens.
 *
 * @generated from message gitpod.experimental.v1.ClaimMappingOverride
 */
export class ClaimMappingOverride extends Message<ClaimMappingOverride> {
  /**
   * Optional.
   *
   * @generated from field: string claim_email_key = 1;
   */
  claimEmailKey = "";

  /**
   * Optional.
   *
   * @generated from field: string claim_groups_key = 2;
   */
  claimGroupsKey = "";

  /**
   * Optional.
   *
   * @generated from field: string claim_username_key = 3;
   */
  claimUsernameKey = "";

  constructor(data?: PartialMessage<ClaimMappingOverride>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ClaimMappingOverride";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "claim_email_key", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "claim_groups_key", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "claim_username_key", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ClaimMappingOverride {
    return new ClaimMappingOverride().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ClaimMappingOverride {
    return new ClaimMappingOverride().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ClaimMappingOverride {
    return new ClaimMappingOverride().fromJsonString(jsonString, options);
  }

  static equals(a: ClaimMappingOverride | PlainMessage<ClaimMappingOverride> | undefined, b: ClaimMappingOverride | PlainMessage<ClaimMappingOverride> | undefined): boolean {
    return proto3.util.equals(ClaimMappingOverride, a, b);
  }
}

/**
 * The OAuth2 specific part of the client configuration.
 *
 * @generated from message gitpod.experimental.v1.OAuth2Config
 */
export class OAuth2Config extends Message<OAuth2Config> {
  /**
   * Required.
   *
   * @generated from field: string client_id = 1;
   */
  clientId = "";

  /**
   * Required for creation/updates.
   * Empty on read.
   *
   * @generated from field: string client_secret = 2;
   */
  clientSecret = "";

  /**
   * Required.
   *
   * @generated from field: string authorization_endpoint = 3;
   */
  authorizationEndpoint = "";

  /**
   * Required.
   *
   * @generated from field: string token_endpoint = 4;
   */
  tokenEndpoint = "";

  /**
   * Required.
   *
   * @generated from field: repeated string scopes = 5;
   */
  scopes: string[] = [];

  /**
   * Source for additional claims for the token.
   * Additional keys may be used to control the extraction of a profile.
   * Required.
   *
   * @generated from field: string userinfo_endpoint = 6;
   */
  userinfoEndpoint = "";

  /**
   * Keys of the userinfo result to extract a profile from.
   * Optional.
   *
   * @generated from field: gitpod.experimental.v1.UserInfoKeys userinfo_keys = 7;
   */
  userinfoKeys?: UserInfoKeys;

  constructor(data?: PartialMessage<OAuth2Config>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.OAuth2Config";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "client_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "client_secret", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "authorization_endpoint", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 4, name: "token_endpoint", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 5, name: "scopes", kind: "scalar", T: 9 /* ScalarType.STRING */, repeated: true },
    { no: 6, name: "userinfo_endpoint", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 7, name: "userinfo_keys", kind: "message", T: UserInfoKeys },
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

/**
 * Description of keys of a userinfo result.
 *
 * @generated from message gitpod.experimental.v1.UserInfoKeys
 */
export class UserInfoKeys extends Message<UserInfoKeys> {
  /**
   * Optional.
   *
   * @generated from field: string userinfo_id_key = 1;
   */
  userinfoIdKey = "";

  /**
   * Optional.
   *
   * @generated from field: string userinfo_name_key = 2;
   */
  userinfoNameKey = "";

  constructor(data?: PartialMessage<UserInfoKeys>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.UserInfoKeys";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "userinfo_id_key", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "userinfo_name_key", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UserInfoKeys {
    return new UserInfoKeys().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UserInfoKeys {
    return new UserInfoKeys().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UserInfoKeys {
    return new UserInfoKeys().fromJsonString(jsonString, options);
  }

  static equals(a: UserInfoKeys | PlainMessage<UserInfoKeys> | undefined, b: UserInfoKeys | PlainMessage<UserInfoKeys> | undefined): boolean {
    return proto3.util.equals(UserInfoKeys, a, b);
  }
}

/**
 * The status of an OIDC client configuration.
 *
 * @generated from message gitpod.experimental.v1.OIDCClientConfigStatus
 */
export class OIDCClientConfigStatus extends Message<OIDCClientConfigStatus> {
  constructor(data?: PartialMessage<OIDCClientConfigStatus>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.OIDCClientConfigStatus";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): OIDCClientConfigStatus {
    return new OIDCClientConfigStatus().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): OIDCClientConfigStatus {
    return new OIDCClientConfigStatus().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): OIDCClientConfigStatus {
    return new OIDCClientConfigStatus().fromJsonString(jsonString, options);
  }

  static equals(a: OIDCClientConfigStatus | PlainMessage<OIDCClientConfigStatus> | undefined, b: OIDCClientConfigStatus | PlainMessage<OIDCClientConfigStatus> | undefined): boolean {
    return proto3.util.equals(OIDCClientConfigStatus, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreateClientConfigRequest
 */
export class CreateClientConfigRequest extends Message<CreateClientConfigRequest> {
  /**
   * @generated from field: gitpod.experimental.v1.OIDCClientConfig config = 1;
   */
  config?: OIDCClientConfig;

  /**
   * Optional.
   *
   * @generated from field: bool use_discovery = 2;
   */
  useDiscovery = false;

  constructor(data?: PartialMessage<CreateClientConfigRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreateClientConfigRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "config", kind: "message", T: OIDCClientConfig },
    { no: 2, name: "use_discovery", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateClientConfigRequest {
    return new CreateClientConfigRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateClientConfigRequest {
    return new CreateClientConfigRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateClientConfigRequest {
    return new CreateClientConfigRequest().fromJsonString(jsonString, options);
  }

  static equals(a: CreateClientConfigRequest | PlainMessage<CreateClientConfigRequest> | undefined, b: CreateClientConfigRequest | PlainMessage<CreateClientConfigRequest> | undefined): boolean {
    return proto3.util.equals(CreateClientConfigRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.CreateClientConfigResponse
 */
export class CreateClientConfigResponse extends Message<CreateClientConfigResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.OIDCClientConfig config = 1;
   */
  config?: OIDCClientConfig;

  constructor(data?: PartialMessage<CreateClientConfigResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.CreateClientConfigResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "config", kind: "message", T: OIDCClientConfig },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateClientConfigResponse {
    return new CreateClientConfigResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateClientConfigResponse {
    return new CreateClientConfigResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateClientConfigResponse {
    return new CreateClientConfigResponse().fromJsonString(jsonString, options);
  }

  static equals(a: CreateClientConfigResponse | PlainMessage<CreateClientConfigResponse> | undefined, b: CreateClientConfigResponse | PlainMessage<CreateClientConfigResponse> | undefined): boolean {
    return proto3.util.equals(CreateClientConfigResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetClientConfigRequest
 */
export class GetClientConfigRequest extends Message<GetClientConfigRequest> {
  /**
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * @generated from field: string organization_id = 2;
   */
  organizationId = "";

  constructor(data?: PartialMessage<GetClientConfigRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetClientConfigRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetClientConfigRequest {
    return new GetClientConfigRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetClientConfigRequest {
    return new GetClientConfigRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetClientConfigRequest {
    return new GetClientConfigRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetClientConfigRequest | PlainMessage<GetClientConfigRequest> | undefined, b: GetClientConfigRequest | PlainMessage<GetClientConfigRequest> | undefined): boolean {
    return proto3.util.equals(GetClientConfigRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetClientConfigResponse
 */
export class GetClientConfigResponse extends Message<GetClientConfigResponse> {
  /**
   * @generated from field: gitpod.experimental.v1.OIDCClientConfig config = 1;
   */
  config?: OIDCClientConfig;

  constructor(data?: PartialMessage<GetClientConfigResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetClientConfigResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "config", kind: "message", T: OIDCClientConfig },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetClientConfigResponse {
    return new GetClientConfigResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetClientConfigResponse {
    return new GetClientConfigResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetClientConfigResponse {
    return new GetClientConfigResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetClientConfigResponse | PlainMessage<GetClientConfigResponse> | undefined, b: GetClientConfigResponse | PlainMessage<GetClientConfigResponse> | undefined): boolean {
    return proto3.util.equals(GetClientConfigResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ListClientConfigsRequest
 */
export class ListClientConfigsRequest extends Message<ListClientConfigsRequest> {
  /**
   * @generated from field: string organization_id = 1;
   */
  organizationId = "";

  /**
   * Page information
   *
   * @generated from field: gitpod.experimental.v1.Pagination pagination = 2;
   */
  pagination?: Pagination;

  constructor(data?: PartialMessage<ListClientConfigsRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListClientConfigsRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "pagination", kind: "message", T: Pagination },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListClientConfigsRequest {
    return new ListClientConfigsRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListClientConfigsRequest {
    return new ListClientConfigsRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListClientConfigsRequest {
    return new ListClientConfigsRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListClientConfigsRequest | PlainMessage<ListClientConfigsRequest> | undefined, b: ListClientConfigsRequest | PlainMessage<ListClientConfigsRequest> | undefined): boolean {
    return proto3.util.equals(ListClientConfigsRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.ListClientConfigsResponse
 */
export class ListClientConfigsResponse extends Message<ListClientConfigsResponse> {
  /**
   * @generated from field: repeated gitpod.experimental.v1.OIDCClientConfig client_configs = 1;
   */
  clientConfigs: OIDCClientConfig[] = [];

  /**
   * @generated from field: int64 total_results = 2;
   */
  totalResults = protoInt64.zero;

  constructor(data?: PartialMessage<ListClientConfigsResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.ListClientConfigsResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "client_configs", kind: "message", T: OIDCClientConfig, repeated: true },
    { no: 2, name: "total_results", kind: "scalar", T: 3 /* ScalarType.INT64 */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListClientConfigsResponse {
    return new ListClientConfigsResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListClientConfigsResponse {
    return new ListClientConfigsResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListClientConfigsResponse {
    return new ListClientConfigsResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListClientConfigsResponse | PlainMessage<ListClientConfigsResponse> | undefined, b: ListClientConfigsResponse | PlainMessage<ListClientConfigsResponse> | undefined): boolean {
    return proto3.util.equals(ListClientConfigsResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.UpdateClientConfigRequest
 */
export class UpdateClientConfigRequest extends Message<UpdateClientConfigRequest> {
  /**
   * @generated from field: gitpod.experimental.v1.OIDCClientConfig config = 1;
   */
  config?: OIDCClientConfig;

  constructor(data?: PartialMessage<UpdateClientConfigRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.UpdateClientConfigRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "config", kind: "message", T: OIDCClientConfig },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateClientConfigRequest {
    return new UpdateClientConfigRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateClientConfigRequest {
    return new UpdateClientConfigRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateClientConfigRequest {
    return new UpdateClientConfigRequest().fromJsonString(jsonString, options);
  }

  static equals(a: UpdateClientConfigRequest | PlainMessage<UpdateClientConfigRequest> | undefined, b: UpdateClientConfigRequest | PlainMessage<UpdateClientConfigRequest> | undefined): boolean {
    return proto3.util.equals(UpdateClientConfigRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.UpdateClientConfigResponse
 */
export class UpdateClientConfigResponse extends Message<UpdateClientConfigResponse> {
  constructor(data?: PartialMessage<UpdateClientConfigResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.UpdateClientConfigResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): UpdateClientConfigResponse {
    return new UpdateClientConfigResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): UpdateClientConfigResponse {
    return new UpdateClientConfigResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): UpdateClientConfigResponse {
    return new UpdateClientConfigResponse().fromJsonString(jsonString, options);
  }

  static equals(a: UpdateClientConfigResponse | PlainMessage<UpdateClientConfigResponse> | undefined, b: UpdateClientConfigResponse | PlainMessage<UpdateClientConfigResponse> | undefined): boolean {
    return proto3.util.equals(UpdateClientConfigResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteClientConfigRequest
 */
export class DeleteClientConfigRequest extends Message<DeleteClientConfigRequest> {
  /**
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * @generated from field: string organization_id = 2;
   */
  organizationId = "";

  constructor(data?: PartialMessage<DeleteClientConfigRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteClientConfigRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "organization_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteClientConfigRequest {
    return new DeleteClientConfigRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteClientConfigRequest {
    return new DeleteClientConfigRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteClientConfigRequest {
    return new DeleteClientConfigRequest().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteClientConfigRequest | PlainMessage<DeleteClientConfigRequest> | undefined, b: DeleteClientConfigRequest | PlainMessage<DeleteClientConfigRequest> | undefined): boolean {
    return proto3.util.equals(DeleteClientConfigRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.DeleteClientConfigResponse
 */
export class DeleteClientConfigResponse extends Message<DeleteClientConfigResponse> {
  constructor(data?: PartialMessage<DeleteClientConfigResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.DeleteClientConfigResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteClientConfigResponse {
    return new DeleteClientConfigResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteClientConfigResponse {
    return new DeleteClientConfigResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteClientConfigResponse {
    return new DeleteClientConfigResponse().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteClientConfigResponse | PlainMessage<DeleteClientConfigResponse> | undefined, b: DeleteClientConfigResponse | PlainMessage<DeleteClientConfigResponse> | undefined): boolean {
    return proto3.util.equals(DeleteClientConfigResponse, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetSSOLoginIDRequest
 */
export class GetSSOLoginIDRequest extends Message<GetSSOLoginIDRequest> {
  /**
   * @generated from field: string slug = 1;
   */
  slug = "";

  constructor(data?: PartialMessage<GetSSOLoginIDRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetSSOLoginIDRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "slug", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetSSOLoginIDRequest {
    return new GetSSOLoginIDRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetSSOLoginIDRequest {
    return new GetSSOLoginIDRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetSSOLoginIDRequest {
    return new GetSSOLoginIDRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetSSOLoginIDRequest | PlainMessage<GetSSOLoginIDRequest> | undefined, b: GetSSOLoginIDRequest | PlainMessage<GetSSOLoginIDRequest> | undefined): boolean {
    return proto3.util.equals(GetSSOLoginIDRequest, a, b);
  }
}

/**
 * @generated from message gitpod.experimental.v1.GetSSOLoginIDResponse
 */
export class GetSSOLoginIDResponse extends Message<GetSSOLoginIDResponse> {
  /**
   * @generated from field: string id = 1;
   */
  id = "";

  constructor(data?: PartialMessage<GetSSOLoginIDResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "gitpod.experimental.v1.GetSSOLoginIDResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetSSOLoginIDResponse {
    return new GetSSOLoginIDResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetSSOLoginIDResponse {
    return new GetSSOLoginIDResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetSSOLoginIDResponse {
    return new GetSSOLoginIDResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetSSOLoginIDResponse | PlainMessage<GetSSOLoginIDResponse> | undefined, b: GetSSOLoginIDResponse | PlainMessage<GetSSOLoginIDResponse> | undefined): boolean {
    return proto3.util.equals(GetSSOLoginIDResponse, a, b);
  }
}
