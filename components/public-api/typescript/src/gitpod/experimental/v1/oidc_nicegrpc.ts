/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/* eslint-disable */
import * as Long from "long";
import type { CallContext, CallOptions } from "nice-grpc-common";
import * as _m0 from "protobufjs/minimal";
import { Timestamp } from "../../../google/protobuf/timestamp_nicegrpc";
import { Pagination } from "./pagination_nicegrpc";

export const protobufPackage = "gitpod.experimental.v1";

/**
 * Configuration of an OpenID client.
 *
 * For the metadata describing the configuration of OIDC providers, cf.
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 */
export interface OIDCClientConfig {
  /**
   * ID is the unique identifier for the OIDC Config.
   * Read only.
   */
  id: string;
  organizationId: string;
  oidcConfig: OIDCConfig | undefined;
  oauth2Config:
    | OAuth2Config
    | undefined;
  /** Optional. */
  oauthOnly: boolean;
  /**
   * List of the JWS signing algorithms (alg values) supported by the OP for the
   * ID Token to encode the Claims in a JWT. The algorithm RS256 MUST be
   * included.
   * Optional.
   */
  idTokenSigningAlgValuesSupported: string[];
  /**
   * Time when the config was created.
   * Read-only.
   */
  creationTime:
    | Date
    | undefined;
  /**
   * Describes the status of this configuration item.
   * Read-only.
   */
  status: OIDCClientConfigStatus | undefined;
}

/** The OIDC specific part of the client configuration. */
export interface OIDCConfig {
  /**
   * URL using the https scheme with no query or fragment component that the
   * OIDC provider asserts as its Issuer Identifier.
   * Required.
   */
  issuer: string;
  /**
   * A KeySet that can validate the id_token (JSON web token)
   * Either one is required.
   */
  jwks: string;
  jwksUrl: string;
  /**
   * Provider specific parameters to control the behavior of the consent screen.
   * Optional.
   */
  hints:
    | ConsentScreenHints
    | undefined;
  /**
   * Optional overrides for key mapping to be applied when extracting claims from id_tokens.
   * Should only be set, if an override is required.
   * Optional.
   */
  overrideClaimMapping: ClaimMappingOverride | undefined;
}

/** Provider specific parameters to control the behavior of the consent screen. */
export interface ConsentScreenHints {
  /**
   * Control options for the consent screen.
   * Optional.
   */
  prompt: string;
  /**
   * A hint to pre-select the tenant from an AD.
   * Optional.
   */
  domainHint: string;
  /** Optional. */
  loginHint: string;
}

/** Optional overrides for key mapping to be applied when extracting claims from id_tokens. */
export interface ClaimMappingOverride {
  /** Optional. */
  claimEmailKey: string;
  /** Optional. */
  claimGroupsKey: string;
  /** Optional. */
  claimUsernameKey: string;
}

/** The OAuth2 specific part of the client configuration. */
export interface OAuth2Config {
  /** Required. */
  clientId: string;
  /**
   * Required for creation/updates.
   * Empty on read.
   */
  clientSecret: string;
  /** Required. */
  authorizationEndpoint: string;
  /** Required. */
  tokenEndpoint: string;
  /** Required. */
  scopes: string[];
  /**
   * Source for additional claims for the token.
   * Additional keys may be used to control the extraction of a profile.
   * Required.
   */
  userinfoEndpoint: string;
  /**
   * Keys of the userinfo result to extract a profile from.
   * Optional.
   */
  userinfoKeys: UserInfoKeys | undefined;
}

/** Description of keys of a userinfo result. */
export interface UserInfoKeys {
  /** Optional. */
  userinfoIdKey: string;
  /** Optional. */
  userinfoNameKey: string;
}

/** The status of an OIDC client configuration. */
export interface OIDCClientConfigStatus {
}

export interface CreateClientConfigRequest {
  config:
    | OIDCClientConfig
    | undefined;
  /** Optional. */
  useDiscovery: boolean;
}

export interface CreateClientConfigResponse {
  config: OIDCClientConfig | undefined;
}

export interface GetClientConfigRequest {
  id: string;
  organizationId: string;
}

export interface GetClientConfigResponse {
  config: OIDCClientConfig | undefined;
}

export interface ListClientConfigsRequest {
  organizationId: string;
  /** Page information */
  pagination: Pagination | undefined;
}

export interface ListClientConfigsResponse {
  clientConfigs: OIDCClientConfig[];
  totalResults: number;
}

export interface UpdateClientConfigRequest {
  config: OIDCClientConfig | undefined;
}

export interface UpdateClientConfigResponse {
}

export interface DeleteClientConfigRequest {
  id: string;
  organizationId: string;
}

export interface DeleteClientConfigResponse {
}

function createBaseOIDCClientConfig(): OIDCClientConfig {
  return {
    id: "",
    organizationId: "",
    oidcConfig: undefined,
    oauth2Config: undefined,
    oauthOnly: false,
    idTokenSigningAlgValuesSupported: [],
    creationTime: undefined,
    status: undefined,
  };
}

export const OIDCClientConfig = {
  encode(message: OIDCClientConfig, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.organizationId !== "") {
      writer.uint32(18).string(message.organizationId);
    }
    if (message.oidcConfig !== undefined) {
      OIDCConfig.encode(message.oidcConfig, writer.uint32(26).fork()).ldelim();
    }
    if (message.oauth2Config !== undefined) {
      OAuth2Config.encode(message.oauth2Config, writer.uint32(34).fork()).ldelim();
    }
    if (message.oauthOnly === true) {
      writer.uint32(40).bool(message.oauthOnly);
    }
    for (const v of message.idTokenSigningAlgValuesSupported) {
      writer.uint32(50).string(v!);
    }
    if (message.creationTime !== undefined) {
      Timestamp.encode(toTimestamp(message.creationTime), writer.uint32(58).fork()).ldelim();
    }
    if (message.status !== undefined) {
      OIDCClientConfigStatus.encode(message.status, writer.uint32(66).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OIDCClientConfig {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOIDCClientConfig();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.organizationId = reader.string();
          break;
        case 3:
          message.oidcConfig = OIDCConfig.decode(reader, reader.uint32());
          break;
        case 4:
          message.oauth2Config = OAuth2Config.decode(reader, reader.uint32());
          break;
        case 5:
          message.oauthOnly = reader.bool();
          break;
        case 6:
          message.idTokenSigningAlgValuesSupported.push(reader.string());
          break;
        case 7:
          message.creationTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 8:
          message.status = OIDCClientConfigStatus.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OIDCClientConfig {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      organizationId: isSet(object.organizationId) ? String(object.organizationId) : "",
      oidcConfig: isSet(object.oidcConfig) ? OIDCConfig.fromJSON(object.oidcConfig) : undefined,
      oauth2Config: isSet(object.oauth2Config) ? OAuth2Config.fromJSON(object.oauth2Config) : undefined,
      oauthOnly: isSet(object.oauthOnly) ? Boolean(object.oauthOnly) : false,
      idTokenSigningAlgValuesSupported: Array.isArray(object?.idTokenSigningAlgValuesSupported)
        ? object.idTokenSigningAlgValuesSupported.map((e: any) => String(e))
        : [],
      creationTime: isSet(object.creationTime) ? fromJsonTimestamp(object.creationTime) : undefined,
      status: isSet(object.status) ? OIDCClientConfigStatus.fromJSON(object.status) : undefined,
    };
  },

  toJSON(message: OIDCClientConfig): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.organizationId !== undefined && (obj.organizationId = message.organizationId);
    message.oidcConfig !== undefined &&
      (obj.oidcConfig = message.oidcConfig ? OIDCConfig.toJSON(message.oidcConfig) : undefined);
    message.oauth2Config !== undefined &&
      (obj.oauth2Config = message.oauth2Config ? OAuth2Config.toJSON(message.oauth2Config) : undefined);
    message.oauthOnly !== undefined && (obj.oauthOnly = message.oauthOnly);
    if (message.idTokenSigningAlgValuesSupported) {
      obj.idTokenSigningAlgValuesSupported = message.idTokenSigningAlgValuesSupported.map((e) => e);
    } else {
      obj.idTokenSigningAlgValuesSupported = [];
    }
    message.creationTime !== undefined && (obj.creationTime = message.creationTime.toISOString());
    message.status !== undefined &&
      (obj.status = message.status ? OIDCClientConfigStatus.toJSON(message.status) : undefined);
    return obj;
  },

  create(base?: DeepPartial<OIDCClientConfig>): OIDCClientConfig {
    return OIDCClientConfig.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<OIDCClientConfig>): OIDCClientConfig {
    const message = createBaseOIDCClientConfig();
    message.id = object.id ?? "";
    message.organizationId = object.organizationId ?? "";
    message.oidcConfig = (object.oidcConfig !== undefined && object.oidcConfig !== null)
      ? OIDCConfig.fromPartial(object.oidcConfig)
      : undefined;
    message.oauth2Config = (object.oauth2Config !== undefined && object.oauth2Config !== null)
      ? OAuth2Config.fromPartial(object.oauth2Config)
      : undefined;
    message.oauthOnly = object.oauthOnly ?? false;
    message.idTokenSigningAlgValuesSupported = object.idTokenSigningAlgValuesSupported?.map((e) => e) || [];
    message.creationTime = object.creationTime ?? undefined;
    message.status = (object.status !== undefined && object.status !== null)
      ? OIDCClientConfigStatus.fromPartial(object.status)
      : undefined;
    return message;
  },
};

function createBaseOIDCConfig(): OIDCConfig {
  return { issuer: "", jwks: "", jwksUrl: "", hints: undefined, overrideClaimMapping: undefined };
}

export const OIDCConfig = {
  encode(message: OIDCConfig, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.issuer !== "") {
      writer.uint32(10).string(message.issuer);
    }
    if (message.jwks !== "") {
      writer.uint32(18).string(message.jwks);
    }
    if (message.jwksUrl !== "") {
      writer.uint32(26).string(message.jwksUrl);
    }
    if (message.hints !== undefined) {
      ConsentScreenHints.encode(message.hints, writer.uint32(34).fork()).ldelim();
    }
    if (message.overrideClaimMapping !== undefined) {
      ClaimMappingOverride.encode(message.overrideClaimMapping, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OIDCConfig {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOIDCConfig();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.issuer = reader.string();
          break;
        case 2:
          message.jwks = reader.string();
          break;
        case 3:
          message.jwksUrl = reader.string();
          break;
        case 4:
          message.hints = ConsentScreenHints.decode(reader, reader.uint32());
          break;
        case 5:
          message.overrideClaimMapping = ClaimMappingOverride.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OIDCConfig {
    return {
      issuer: isSet(object.issuer) ? String(object.issuer) : "",
      jwks: isSet(object.jwks) ? String(object.jwks) : "",
      jwksUrl: isSet(object.jwksUrl) ? String(object.jwksUrl) : "",
      hints: isSet(object.hints) ? ConsentScreenHints.fromJSON(object.hints) : undefined,
      overrideClaimMapping: isSet(object.overrideClaimMapping)
        ? ClaimMappingOverride.fromJSON(object.overrideClaimMapping)
        : undefined,
    };
  },

  toJSON(message: OIDCConfig): unknown {
    const obj: any = {};
    message.issuer !== undefined && (obj.issuer = message.issuer);
    message.jwks !== undefined && (obj.jwks = message.jwks);
    message.jwksUrl !== undefined && (obj.jwksUrl = message.jwksUrl);
    message.hints !== undefined && (obj.hints = message.hints ? ConsentScreenHints.toJSON(message.hints) : undefined);
    message.overrideClaimMapping !== undefined && (obj.overrideClaimMapping = message.overrideClaimMapping
      ? ClaimMappingOverride.toJSON(message.overrideClaimMapping)
      : undefined);
    return obj;
  },

  create(base?: DeepPartial<OIDCConfig>): OIDCConfig {
    return OIDCConfig.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<OIDCConfig>): OIDCConfig {
    const message = createBaseOIDCConfig();
    message.issuer = object.issuer ?? "";
    message.jwks = object.jwks ?? "";
    message.jwksUrl = object.jwksUrl ?? "";
    message.hints = (object.hints !== undefined && object.hints !== null)
      ? ConsentScreenHints.fromPartial(object.hints)
      : undefined;
    message.overrideClaimMapping = (object.overrideClaimMapping !== undefined && object.overrideClaimMapping !== null)
      ? ClaimMappingOverride.fromPartial(object.overrideClaimMapping)
      : undefined;
    return message;
  },
};

function createBaseConsentScreenHints(): ConsentScreenHints {
  return { prompt: "", domainHint: "", loginHint: "" };
}

export const ConsentScreenHints = {
  encode(message: ConsentScreenHints, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.prompt !== "") {
      writer.uint32(10).string(message.prompt);
    }
    if (message.domainHint !== "") {
      writer.uint32(18).string(message.domainHint);
    }
    if (message.loginHint !== "") {
      writer.uint32(26).string(message.loginHint);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsentScreenHints {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConsentScreenHints();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.prompt = reader.string();
          break;
        case 2:
          message.domainHint = reader.string();
          break;
        case 3:
          message.loginHint = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsentScreenHints {
    return {
      prompt: isSet(object.prompt) ? String(object.prompt) : "",
      domainHint: isSet(object.domainHint) ? String(object.domainHint) : "",
      loginHint: isSet(object.loginHint) ? String(object.loginHint) : "",
    };
  },

  toJSON(message: ConsentScreenHints): unknown {
    const obj: any = {};
    message.prompt !== undefined && (obj.prompt = message.prompt);
    message.domainHint !== undefined && (obj.domainHint = message.domainHint);
    message.loginHint !== undefined && (obj.loginHint = message.loginHint);
    return obj;
  },

  create(base?: DeepPartial<ConsentScreenHints>): ConsentScreenHints {
    return ConsentScreenHints.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ConsentScreenHints>): ConsentScreenHints {
    const message = createBaseConsentScreenHints();
    message.prompt = object.prompt ?? "";
    message.domainHint = object.domainHint ?? "";
    message.loginHint = object.loginHint ?? "";
    return message;
  },
};

function createBaseClaimMappingOverride(): ClaimMappingOverride {
  return { claimEmailKey: "", claimGroupsKey: "", claimUsernameKey: "" };
}

export const ClaimMappingOverride = {
  encode(message: ClaimMappingOverride, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.claimEmailKey !== "") {
      writer.uint32(10).string(message.claimEmailKey);
    }
    if (message.claimGroupsKey !== "") {
      writer.uint32(18).string(message.claimGroupsKey);
    }
    if (message.claimUsernameKey !== "") {
      writer.uint32(26).string(message.claimUsernameKey);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ClaimMappingOverride {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseClaimMappingOverride();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.claimEmailKey = reader.string();
          break;
        case 2:
          message.claimGroupsKey = reader.string();
          break;
        case 3:
          message.claimUsernameKey = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ClaimMappingOverride {
    return {
      claimEmailKey: isSet(object.claimEmailKey) ? String(object.claimEmailKey) : "",
      claimGroupsKey: isSet(object.claimGroupsKey) ? String(object.claimGroupsKey) : "",
      claimUsernameKey: isSet(object.claimUsernameKey) ? String(object.claimUsernameKey) : "",
    };
  },

  toJSON(message: ClaimMappingOverride): unknown {
    const obj: any = {};
    message.claimEmailKey !== undefined && (obj.claimEmailKey = message.claimEmailKey);
    message.claimGroupsKey !== undefined && (obj.claimGroupsKey = message.claimGroupsKey);
    message.claimUsernameKey !== undefined && (obj.claimUsernameKey = message.claimUsernameKey);
    return obj;
  },

  create(base?: DeepPartial<ClaimMappingOverride>): ClaimMappingOverride {
    return ClaimMappingOverride.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ClaimMappingOverride>): ClaimMappingOverride {
    const message = createBaseClaimMappingOverride();
    message.claimEmailKey = object.claimEmailKey ?? "";
    message.claimGroupsKey = object.claimGroupsKey ?? "";
    message.claimUsernameKey = object.claimUsernameKey ?? "";
    return message;
  },
};

function createBaseOAuth2Config(): OAuth2Config {
  return {
    clientId: "",
    clientSecret: "",
    authorizationEndpoint: "",
    tokenEndpoint: "",
    scopes: [],
    userinfoEndpoint: "",
    userinfoKeys: undefined,
  };
}

export const OAuth2Config = {
  encode(message: OAuth2Config, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.clientId !== "") {
      writer.uint32(10).string(message.clientId);
    }
    if (message.clientSecret !== "") {
      writer.uint32(18).string(message.clientSecret);
    }
    if (message.authorizationEndpoint !== "") {
      writer.uint32(26).string(message.authorizationEndpoint);
    }
    if (message.tokenEndpoint !== "") {
      writer.uint32(34).string(message.tokenEndpoint);
    }
    for (const v of message.scopes) {
      writer.uint32(42).string(v!);
    }
    if (message.userinfoEndpoint !== "") {
      writer.uint32(50).string(message.userinfoEndpoint);
    }
    if (message.userinfoKeys !== undefined) {
      UserInfoKeys.encode(message.userinfoKeys, writer.uint32(58).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OAuth2Config {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOAuth2Config();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.clientId = reader.string();
          break;
        case 2:
          message.clientSecret = reader.string();
          break;
        case 3:
          message.authorizationEndpoint = reader.string();
          break;
        case 4:
          message.tokenEndpoint = reader.string();
          break;
        case 5:
          message.scopes.push(reader.string());
          break;
        case 6:
          message.userinfoEndpoint = reader.string();
          break;
        case 7:
          message.userinfoKeys = UserInfoKeys.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OAuth2Config {
    return {
      clientId: isSet(object.clientId) ? String(object.clientId) : "",
      clientSecret: isSet(object.clientSecret) ? String(object.clientSecret) : "",
      authorizationEndpoint: isSet(object.authorizationEndpoint) ? String(object.authorizationEndpoint) : "",
      tokenEndpoint: isSet(object.tokenEndpoint) ? String(object.tokenEndpoint) : "",
      scopes: Array.isArray(object?.scopes) ? object.scopes.map((e: any) => String(e)) : [],
      userinfoEndpoint: isSet(object.userinfoEndpoint) ? String(object.userinfoEndpoint) : "",
      userinfoKeys: isSet(object.userinfoKeys) ? UserInfoKeys.fromJSON(object.userinfoKeys) : undefined,
    };
  },

  toJSON(message: OAuth2Config): unknown {
    const obj: any = {};
    message.clientId !== undefined && (obj.clientId = message.clientId);
    message.clientSecret !== undefined && (obj.clientSecret = message.clientSecret);
    message.authorizationEndpoint !== undefined && (obj.authorizationEndpoint = message.authorizationEndpoint);
    message.tokenEndpoint !== undefined && (obj.tokenEndpoint = message.tokenEndpoint);
    if (message.scopes) {
      obj.scopes = message.scopes.map((e) => e);
    } else {
      obj.scopes = [];
    }
    message.userinfoEndpoint !== undefined && (obj.userinfoEndpoint = message.userinfoEndpoint);
    message.userinfoKeys !== undefined &&
      (obj.userinfoKeys = message.userinfoKeys ? UserInfoKeys.toJSON(message.userinfoKeys) : undefined);
    return obj;
  },

  create(base?: DeepPartial<OAuth2Config>): OAuth2Config {
    return OAuth2Config.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<OAuth2Config>): OAuth2Config {
    const message = createBaseOAuth2Config();
    message.clientId = object.clientId ?? "";
    message.clientSecret = object.clientSecret ?? "";
    message.authorizationEndpoint = object.authorizationEndpoint ?? "";
    message.tokenEndpoint = object.tokenEndpoint ?? "";
    message.scopes = object.scopes?.map((e) => e) || [];
    message.userinfoEndpoint = object.userinfoEndpoint ?? "";
    message.userinfoKeys = (object.userinfoKeys !== undefined && object.userinfoKeys !== null)
      ? UserInfoKeys.fromPartial(object.userinfoKeys)
      : undefined;
    return message;
  },
};

function createBaseUserInfoKeys(): UserInfoKeys {
  return { userinfoIdKey: "", userinfoNameKey: "" };
}

export const UserInfoKeys = {
  encode(message: UserInfoKeys, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userinfoIdKey !== "") {
      writer.uint32(10).string(message.userinfoIdKey);
    }
    if (message.userinfoNameKey !== "") {
      writer.uint32(18).string(message.userinfoNameKey);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UserInfoKeys {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUserInfoKeys();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.userinfoIdKey = reader.string();
          break;
        case 2:
          message.userinfoNameKey = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UserInfoKeys {
    return {
      userinfoIdKey: isSet(object.userinfoIdKey) ? String(object.userinfoIdKey) : "",
      userinfoNameKey: isSet(object.userinfoNameKey) ? String(object.userinfoNameKey) : "",
    };
  },

  toJSON(message: UserInfoKeys): unknown {
    const obj: any = {};
    message.userinfoIdKey !== undefined && (obj.userinfoIdKey = message.userinfoIdKey);
    message.userinfoNameKey !== undefined && (obj.userinfoNameKey = message.userinfoNameKey);
    return obj;
  },

  create(base?: DeepPartial<UserInfoKeys>): UserInfoKeys {
    return UserInfoKeys.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UserInfoKeys>): UserInfoKeys {
    const message = createBaseUserInfoKeys();
    message.userinfoIdKey = object.userinfoIdKey ?? "";
    message.userinfoNameKey = object.userinfoNameKey ?? "";
    return message;
  },
};

function createBaseOIDCClientConfigStatus(): OIDCClientConfigStatus {
  return {};
}

export const OIDCClientConfigStatus = {
  encode(_: OIDCClientConfigStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OIDCClientConfigStatus {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOIDCClientConfigStatus();
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

  fromJSON(_: any): OIDCClientConfigStatus {
    return {};
  },

  toJSON(_: OIDCClientConfigStatus): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<OIDCClientConfigStatus>): OIDCClientConfigStatus {
    return OIDCClientConfigStatus.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<OIDCClientConfigStatus>): OIDCClientConfigStatus {
    const message = createBaseOIDCClientConfigStatus();
    return message;
  },
};

function createBaseCreateClientConfigRequest(): CreateClientConfigRequest {
  return { config: undefined, useDiscovery: false };
}

export const CreateClientConfigRequest = {
  encode(message: CreateClientConfigRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.config !== undefined) {
      OIDCClientConfig.encode(message.config, writer.uint32(10).fork()).ldelim();
    }
    if (message.useDiscovery === true) {
      writer.uint32(16).bool(message.useDiscovery);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateClientConfigRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateClientConfigRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.config = OIDCClientConfig.decode(reader, reader.uint32());
          break;
        case 2:
          message.useDiscovery = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateClientConfigRequest {
    return {
      config: isSet(object.config) ? OIDCClientConfig.fromJSON(object.config) : undefined,
      useDiscovery: isSet(object.useDiscovery) ? Boolean(object.useDiscovery) : false,
    };
  },

  toJSON(message: CreateClientConfigRequest): unknown {
    const obj: any = {};
    message.config !== undefined && (obj.config = message.config ? OIDCClientConfig.toJSON(message.config) : undefined);
    message.useDiscovery !== undefined && (obj.useDiscovery = message.useDiscovery);
    return obj;
  },

  create(base?: DeepPartial<CreateClientConfigRequest>): CreateClientConfigRequest {
    return CreateClientConfigRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateClientConfigRequest>): CreateClientConfigRequest {
    const message = createBaseCreateClientConfigRequest();
    message.config = (object.config !== undefined && object.config !== null)
      ? OIDCClientConfig.fromPartial(object.config)
      : undefined;
    message.useDiscovery = object.useDiscovery ?? false;
    return message;
  },
};

function createBaseCreateClientConfigResponse(): CreateClientConfigResponse {
  return { config: undefined };
}

export const CreateClientConfigResponse = {
  encode(message: CreateClientConfigResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.config !== undefined) {
      OIDCClientConfig.encode(message.config, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateClientConfigResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateClientConfigResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.config = OIDCClientConfig.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateClientConfigResponse {
    return { config: isSet(object.config) ? OIDCClientConfig.fromJSON(object.config) : undefined };
  },

  toJSON(message: CreateClientConfigResponse): unknown {
    const obj: any = {};
    message.config !== undefined && (obj.config = message.config ? OIDCClientConfig.toJSON(message.config) : undefined);
    return obj;
  },

  create(base?: DeepPartial<CreateClientConfigResponse>): CreateClientConfigResponse {
    return CreateClientConfigResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateClientConfigResponse>): CreateClientConfigResponse {
    const message = createBaseCreateClientConfigResponse();
    message.config = (object.config !== undefined && object.config !== null)
      ? OIDCClientConfig.fromPartial(object.config)
      : undefined;
    return message;
  },
};

function createBaseGetClientConfigRequest(): GetClientConfigRequest {
  return { id: "", organizationId: "" };
}

export const GetClientConfigRequest = {
  encode(message: GetClientConfigRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.organizationId !== "") {
      writer.uint32(18).string(message.organizationId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetClientConfigRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetClientConfigRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.organizationId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetClientConfigRequest {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      organizationId: isSet(object.organizationId) ? String(object.organizationId) : "",
    };
  },

  toJSON(message: GetClientConfigRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.organizationId !== undefined && (obj.organizationId = message.organizationId);
    return obj;
  },

  create(base?: DeepPartial<GetClientConfigRequest>): GetClientConfigRequest {
    return GetClientConfigRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetClientConfigRequest>): GetClientConfigRequest {
    const message = createBaseGetClientConfigRequest();
    message.id = object.id ?? "";
    message.organizationId = object.organizationId ?? "";
    return message;
  },
};

function createBaseGetClientConfigResponse(): GetClientConfigResponse {
  return { config: undefined };
}

export const GetClientConfigResponse = {
  encode(message: GetClientConfigResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.config !== undefined) {
      OIDCClientConfig.encode(message.config, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetClientConfigResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetClientConfigResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.config = OIDCClientConfig.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GetClientConfigResponse {
    return { config: isSet(object.config) ? OIDCClientConfig.fromJSON(object.config) : undefined };
  },

  toJSON(message: GetClientConfigResponse): unknown {
    const obj: any = {};
    message.config !== undefined && (obj.config = message.config ? OIDCClientConfig.toJSON(message.config) : undefined);
    return obj;
  },

  create(base?: DeepPartial<GetClientConfigResponse>): GetClientConfigResponse {
    return GetClientConfigResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetClientConfigResponse>): GetClientConfigResponse {
    const message = createBaseGetClientConfigResponse();
    message.config = (object.config !== undefined && object.config !== null)
      ? OIDCClientConfig.fromPartial(object.config)
      : undefined;
    return message;
  },
};

function createBaseListClientConfigsRequest(): ListClientConfigsRequest {
  return { organizationId: "", pagination: undefined };
}

export const ListClientConfigsRequest = {
  encode(message: ListClientConfigsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.organizationId !== "") {
      writer.uint32(10).string(message.organizationId);
    }
    if (message.pagination !== undefined) {
      Pagination.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListClientConfigsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListClientConfigsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.organizationId = reader.string();
          break;
        case 2:
          message.pagination = Pagination.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ListClientConfigsRequest {
    return {
      organizationId: isSet(object.organizationId) ? String(object.organizationId) : "",
      pagination: isSet(object.pagination) ? Pagination.fromJSON(object.pagination) : undefined,
    };
  },

  toJSON(message: ListClientConfigsRequest): unknown {
    const obj: any = {};
    message.organizationId !== undefined && (obj.organizationId = message.organizationId);
    message.pagination !== undefined &&
      (obj.pagination = message.pagination ? Pagination.toJSON(message.pagination) : undefined);
    return obj;
  },

  create(base?: DeepPartial<ListClientConfigsRequest>): ListClientConfigsRequest {
    return ListClientConfigsRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListClientConfigsRequest>): ListClientConfigsRequest {
    const message = createBaseListClientConfigsRequest();
    message.organizationId = object.organizationId ?? "";
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? Pagination.fromPartial(object.pagination)
      : undefined;
    return message;
  },
};

function createBaseListClientConfigsResponse(): ListClientConfigsResponse {
  return { clientConfigs: [], totalResults: 0 };
}

export const ListClientConfigsResponse = {
  encode(message: ListClientConfigsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.clientConfigs) {
      OIDCClientConfig.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.totalResults !== 0) {
      writer.uint32(16).int64(message.totalResults);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListClientConfigsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListClientConfigsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.clientConfigs.push(OIDCClientConfig.decode(reader, reader.uint32()));
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

  fromJSON(object: any): ListClientConfigsResponse {
    return {
      clientConfigs: Array.isArray(object?.clientConfigs)
        ? object.clientConfigs.map((e: any) => OIDCClientConfig.fromJSON(e))
        : [],
      totalResults: isSet(object.totalResults) ? Number(object.totalResults) : 0,
    };
  },

  toJSON(message: ListClientConfigsResponse): unknown {
    const obj: any = {};
    if (message.clientConfigs) {
      obj.clientConfigs = message.clientConfigs.map((e) => e ? OIDCClientConfig.toJSON(e) : undefined);
    } else {
      obj.clientConfigs = [];
    }
    message.totalResults !== undefined && (obj.totalResults = Math.round(message.totalResults));
    return obj;
  },

  create(base?: DeepPartial<ListClientConfigsResponse>): ListClientConfigsResponse {
    return ListClientConfigsResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListClientConfigsResponse>): ListClientConfigsResponse {
    const message = createBaseListClientConfigsResponse();
    message.clientConfigs = object.clientConfigs?.map((e) => OIDCClientConfig.fromPartial(e)) || [];
    message.totalResults = object.totalResults ?? 0;
    return message;
  },
};

function createBaseUpdateClientConfigRequest(): UpdateClientConfigRequest {
  return { config: undefined };
}

export const UpdateClientConfigRequest = {
  encode(message: UpdateClientConfigRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.config !== undefined) {
      OIDCClientConfig.encode(message.config, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateClientConfigRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateClientConfigRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.config = OIDCClientConfig.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UpdateClientConfigRequest {
    return { config: isSet(object.config) ? OIDCClientConfig.fromJSON(object.config) : undefined };
  },

  toJSON(message: UpdateClientConfigRequest): unknown {
    const obj: any = {};
    message.config !== undefined && (obj.config = message.config ? OIDCClientConfig.toJSON(message.config) : undefined);
    return obj;
  },

  create(base?: DeepPartial<UpdateClientConfigRequest>): UpdateClientConfigRequest {
    return UpdateClientConfigRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdateClientConfigRequest>): UpdateClientConfigRequest {
    const message = createBaseUpdateClientConfigRequest();
    message.config = (object.config !== undefined && object.config !== null)
      ? OIDCClientConfig.fromPartial(object.config)
      : undefined;
    return message;
  },
};

function createBaseUpdateClientConfigResponse(): UpdateClientConfigResponse {
  return {};
}

export const UpdateClientConfigResponse = {
  encode(_: UpdateClientConfigResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateClientConfigResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateClientConfigResponse();
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

  fromJSON(_: any): UpdateClientConfigResponse {
    return {};
  },

  toJSON(_: UpdateClientConfigResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<UpdateClientConfigResponse>): UpdateClientConfigResponse {
    return UpdateClientConfigResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<UpdateClientConfigResponse>): UpdateClientConfigResponse {
    const message = createBaseUpdateClientConfigResponse();
    return message;
  },
};

function createBaseDeleteClientConfigRequest(): DeleteClientConfigRequest {
  return { id: "", organizationId: "" };
}

export const DeleteClientConfigRequest = {
  encode(message: DeleteClientConfigRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== "") {
      writer.uint32(10).string(message.id);
    }
    if (message.organizationId !== "") {
      writer.uint32(18).string(message.organizationId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteClientConfigRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteClientConfigRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = reader.string();
          break;
        case 2:
          message.organizationId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DeleteClientConfigRequest {
    return {
      id: isSet(object.id) ? String(object.id) : "",
      organizationId: isSet(object.organizationId) ? String(object.organizationId) : "",
    };
  },

  toJSON(message: DeleteClientConfigRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = message.id);
    message.organizationId !== undefined && (obj.organizationId = message.organizationId);
    return obj;
  },

  create(base?: DeepPartial<DeleteClientConfigRequest>): DeleteClientConfigRequest {
    return DeleteClientConfigRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeleteClientConfigRequest>): DeleteClientConfigRequest {
    const message = createBaseDeleteClientConfigRequest();
    message.id = object.id ?? "";
    message.organizationId = object.organizationId ?? "";
    return message;
  },
};

function createBaseDeleteClientConfigResponse(): DeleteClientConfigResponse {
  return {};
}

export const DeleteClientConfigResponse = {
  encode(_: DeleteClientConfigResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteClientConfigResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteClientConfigResponse();
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

  fromJSON(_: any): DeleteClientConfigResponse {
    return {};
  },

  toJSON(_: DeleteClientConfigResponse): unknown {
    const obj: any = {};
    return obj;
  },

  create(base?: DeepPartial<DeleteClientConfigResponse>): DeleteClientConfigResponse {
    return DeleteClientConfigResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeleteClientConfigResponse>): DeleteClientConfigResponse {
    const message = createBaseDeleteClientConfigResponse();
    return message;
  },
};

export type OIDCServiceDefinition = typeof OIDCServiceDefinition;
export const OIDCServiceDefinition = {
  name: "OIDCService",
  fullName: "gitpod.experimental.v1.OIDCService",
  methods: {
    /** Creates a new OIDC client configuration. */
    createClientConfig: {
      name: "CreateClientConfig",
      requestType: CreateClientConfigRequest,
      requestStream: false,
      responseType: CreateClientConfigResponse,
      responseStream: false,
      options: {},
    },
    /** Retrieves an OIDC client configuration by ID. */
    getClientConfig: {
      name: "GetClientConfig",
      requestType: GetClientConfigRequest,
      requestStream: false,
      responseType: GetClientConfigResponse,
      responseStream: false,
      options: {},
    },
    /** Lists OIDC client configurations. */
    listClientConfigs: {
      name: "ListClientConfigs",
      requestType: ListClientConfigsRequest,
      requestStream: false,
      responseType: ListClientConfigsResponse,
      responseStream: false,
      options: {},
    },
    /** Updates modifiable properties of an existing OIDC client configuration. */
    updateClientConfig: {
      name: "UpdateClientConfig",
      requestType: UpdateClientConfigRequest,
      requestStream: false,
      responseType: UpdateClientConfigResponse,
      responseStream: false,
      options: {},
    },
    /** Removes a OIDC client configuration by ID. */
    deleteClientConfig: {
      name: "DeleteClientConfig",
      requestType: DeleteClientConfigRequest,
      requestStream: false,
      responseType: DeleteClientConfigResponse,
      responseStream: false,
      options: {},
    },
  },
} as const;

export interface OIDCServiceImplementation<CallContextExt = {}> {
  /** Creates a new OIDC client configuration. */
  createClientConfig(
    request: CreateClientConfigRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<CreateClientConfigResponse>>;
  /** Retrieves an OIDC client configuration by ID. */
  getClientConfig(
    request: GetClientConfigRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<GetClientConfigResponse>>;
  /** Lists OIDC client configurations. */
  listClientConfigs(
    request: ListClientConfigsRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<ListClientConfigsResponse>>;
  /** Updates modifiable properties of an existing OIDC client configuration. */
  updateClientConfig(
    request: UpdateClientConfigRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<UpdateClientConfigResponse>>;
  /** Removes a OIDC client configuration by ID. */
  deleteClientConfig(
    request: DeleteClientConfigRequest,
    context: CallContext & CallContextExt,
  ): Promise<DeepPartial<DeleteClientConfigResponse>>;
}

export interface OIDCServiceClient<CallOptionsExt = {}> {
  /** Creates a new OIDC client configuration. */
  createClientConfig(
    request: DeepPartial<CreateClientConfigRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<CreateClientConfigResponse>;
  /** Retrieves an OIDC client configuration by ID. */
  getClientConfig(
    request: DeepPartial<GetClientConfigRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<GetClientConfigResponse>;
  /** Lists OIDC client configurations. */
  listClientConfigs(
    request: DeepPartial<ListClientConfigsRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<ListClientConfigsResponse>;
  /** Updates modifiable properties of an existing OIDC client configuration. */
  updateClientConfig(
    request: DeepPartial<UpdateClientConfigRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<UpdateClientConfigResponse>;
  /** Removes a OIDC client configuration by ID. */
  deleteClientConfig(
    request: DeepPartial<DeleteClientConfigRequest>,
    options?: CallOptions & CallOptionsExt,
  ): Promise<DeleteClientConfigResponse>;
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
