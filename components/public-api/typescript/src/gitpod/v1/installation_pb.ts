/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-es v1.3.3 with parameter "target=ts"
// @generated from file gitpod/v1/installation.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
import { Message, proto3, Timestamp } from "@bufbuild/protobuf";
import { PaginationRequest, PaginationResponse } from "./pagination_pb.js";
import { Sort } from "./sorting_pb.js";

/**
 * @generated from message gitpod.v1.GetOnboardingStateRequest
 */
export class GetOnboardingStateRequest extends Message<GetOnboardingStateRequest> {
  constructor(data?: PartialMessage<GetOnboardingStateRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetOnboardingStateRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetOnboardingStateRequest {
    return new GetOnboardingStateRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetOnboardingStateRequest {
    return new GetOnboardingStateRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetOnboardingStateRequest {
    return new GetOnboardingStateRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetOnboardingStateRequest | PlainMessage<GetOnboardingStateRequest> | undefined, b: GetOnboardingStateRequest | PlainMessage<GetOnboardingStateRequest> | undefined): boolean {
    return proto3.util.equals(GetOnboardingStateRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.GetOnboardingStateResponse
 */
export class GetOnboardingStateResponse extends Message<GetOnboardingStateResponse> {
  /**
   * @generated from field: gitpod.v1.OnboardingState onboarding_state = 1;
   */
  onboardingState?: OnboardingState;

  constructor(data?: PartialMessage<GetOnboardingStateResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetOnboardingStateResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "onboarding_state", kind: "message", T: OnboardingState },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetOnboardingStateResponse {
    return new GetOnboardingStateResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetOnboardingStateResponse {
    return new GetOnboardingStateResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetOnboardingStateResponse {
    return new GetOnboardingStateResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetOnboardingStateResponse | PlainMessage<GetOnboardingStateResponse> | undefined, b: GetOnboardingStateResponse | PlainMessage<GetOnboardingStateResponse> | undefined): boolean {
    return proto3.util.equals(GetOnboardingStateResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.OnboardingState
 */
export class OnboardingState extends Message<OnboardingState> {
  /**
   * @generated from field: bool completed = 1;
   */
  completed = false;

  constructor(data?: PartialMessage<OnboardingState>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.OnboardingState";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "completed", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): OnboardingState {
    return new OnboardingState().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): OnboardingState {
    return new OnboardingState().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): OnboardingState {
    return new OnboardingState().fromJsonString(jsonString, options);
  }

  static equals(a: OnboardingState | PlainMessage<OnboardingState> | undefined, b: OnboardingState | PlainMessage<OnboardingState> | undefined): boolean {
    return proto3.util.equals(OnboardingState, a, b);
  }
}

/**
 * @generated from message gitpod.v1.GetInstallationWorkspaceDefaultImageRequest
 */
export class GetInstallationWorkspaceDefaultImageRequest extends Message<GetInstallationWorkspaceDefaultImageRequest> {
  constructor(data?: PartialMessage<GetInstallationWorkspaceDefaultImageRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetInstallationWorkspaceDefaultImageRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetInstallationWorkspaceDefaultImageRequest {
    return new GetInstallationWorkspaceDefaultImageRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetInstallationWorkspaceDefaultImageRequest {
    return new GetInstallationWorkspaceDefaultImageRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetInstallationWorkspaceDefaultImageRequest {
    return new GetInstallationWorkspaceDefaultImageRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetInstallationWorkspaceDefaultImageRequest | PlainMessage<GetInstallationWorkspaceDefaultImageRequest> | undefined, b: GetInstallationWorkspaceDefaultImageRequest | PlainMessage<GetInstallationWorkspaceDefaultImageRequest> | undefined): boolean {
    return proto3.util.equals(GetInstallationWorkspaceDefaultImageRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.GetInstallationWorkspaceDefaultImageResponse
 */
export class GetInstallationWorkspaceDefaultImageResponse extends Message<GetInstallationWorkspaceDefaultImageResponse> {
  /**
   * @generated from field: string default_workspace_image = 1;
   */
  defaultWorkspaceImage = "";

  constructor(data?: PartialMessage<GetInstallationWorkspaceDefaultImageResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetInstallationWorkspaceDefaultImageResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "default_workspace_image", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetInstallationWorkspaceDefaultImageResponse {
    return new GetInstallationWorkspaceDefaultImageResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetInstallationWorkspaceDefaultImageResponse {
    return new GetInstallationWorkspaceDefaultImageResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetInstallationWorkspaceDefaultImageResponse {
    return new GetInstallationWorkspaceDefaultImageResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetInstallationWorkspaceDefaultImageResponse | PlainMessage<GetInstallationWorkspaceDefaultImageResponse> | undefined, b: GetInstallationWorkspaceDefaultImageResponse | PlainMessage<GetInstallationWorkspaceDefaultImageResponse> | undefined): boolean {
    return proto3.util.equals(GetInstallationWorkspaceDefaultImageResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListBlockedRepositoriesRequest
 */
export class ListBlockedRepositoriesRequest extends Message<ListBlockedRepositoriesRequest> {
  /**
   * pagination contains the pagination options for listing blocked repositories
   *
   * @generated from field: gitpod.v1.PaginationRequest pagination = 1;
   */
  pagination?: PaginationRequest;

  /**
   * sort contains the sort options for listing blocked repositories
   * BlockedRepositories can be sorted by "urlRegexp"
   *
   * @generated from field: repeated gitpod.v1.Sort sort = 2;
   */
  sort: Sort[] = [];

  /**
   * search_term is a search term to filter blocked repositories by url_regexp
   *
   * @generated from field: string search_term = 3;
   */
  searchTerm = "";

  constructor(data?: PartialMessage<ListBlockedRepositoriesRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListBlockedRepositoriesRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "pagination", kind: "message", T: PaginationRequest },
    { no: 2, name: "sort", kind: "message", T: Sort, repeated: true },
    { no: 3, name: "search_term", kind: "scalar", T: 9 /* ScalarType.STRING */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListBlockedRepositoriesRequest {
    return new ListBlockedRepositoriesRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListBlockedRepositoriesRequest {
    return new ListBlockedRepositoriesRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListBlockedRepositoriesRequest {
    return new ListBlockedRepositoriesRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListBlockedRepositoriesRequest | PlainMessage<ListBlockedRepositoriesRequest> | undefined, b: ListBlockedRepositoriesRequest | PlainMessage<ListBlockedRepositoriesRequest> | undefined): boolean {
    return proto3.util.equals(ListBlockedRepositoriesRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListBlockedRepositoriesResponse
 */
export class ListBlockedRepositoriesResponse extends Message<ListBlockedRepositoriesResponse> {
  /**
   * pagination contains the pagination options for listing blocked repositories
   *
   * @generated from field: gitpod.v1.PaginationResponse pagination = 1;
   */
  pagination?: PaginationResponse;

  /**
   * blocked_repositories are the blocked repositories
   *
   * @generated from field: repeated gitpod.v1.BlockedRepository blocked_repositories = 2;
   */
  blockedRepositories: BlockedRepository[] = [];

  constructor(data?: PartialMessage<ListBlockedRepositoriesResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListBlockedRepositoriesResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "pagination", kind: "message", T: PaginationResponse },
    { no: 2, name: "blocked_repositories", kind: "message", T: BlockedRepository, repeated: true },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListBlockedRepositoriesResponse {
    return new ListBlockedRepositoriesResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListBlockedRepositoriesResponse {
    return new ListBlockedRepositoriesResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListBlockedRepositoriesResponse {
    return new ListBlockedRepositoriesResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListBlockedRepositoriesResponse | PlainMessage<ListBlockedRepositoriesResponse> | undefined, b: ListBlockedRepositoriesResponse | PlainMessage<ListBlockedRepositoriesResponse> | undefined): boolean {
    return proto3.util.equals(ListBlockedRepositoriesResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.CreateBlockedRepositoryRequest
 */
export class CreateBlockedRepositoryRequest extends Message<CreateBlockedRepositoryRequest> {
  /**
   * url_regexp is the regular expression for the repository URL
   *
   * @generated from field: string url_regexp = 1;
   */
  urlRegexp = "";

  /**
   * block_user indicates if the user should be blocked from accessing the
   * repository
   *
   * @generated from field: bool block_user = 2;
   */
  blockUser = false;

  /**
   * block_free_usage indicates if a free tier user may not start a workspace on that repository URL
   *
   * @generated from field: bool block_free_usage = 3;
   */
  blockFreeUsage = false;

  constructor(data?: PartialMessage<CreateBlockedRepositoryRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.CreateBlockedRepositoryRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "url_regexp", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "block_user", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 3, name: "block_free_usage", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateBlockedRepositoryRequest {
    return new CreateBlockedRepositoryRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateBlockedRepositoryRequest {
    return new CreateBlockedRepositoryRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateBlockedRepositoryRequest {
    return new CreateBlockedRepositoryRequest().fromJsonString(jsonString, options);
  }

  static equals(a: CreateBlockedRepositoryRequest | PlainMessage<CreateBlockedRepositoryRequest> | undefined, b: CreateBlockedRepositoryRequest | PlainMessage<CreateBlockedRepositoryRequest> | undefined): boolean {
    return proto3.util.equals(CreateBlockedRepositoryRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.CreateBlockedRepositoryResponse
 */
export class CreateBlockedRepositoryResponse extends Message<CreateBlockedRepositoryResponse> {
  /**
   * @generated from field: gitpod.v1.BlockedRepository blocked_repository = 1;
   */
  blockedRepository?: BlockedRepository;

  constructor(data?: PartialMessage<CreateBlockedRepositoryResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.CreateBlockedRepositoryResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "blocked_repository", kind: "message", T: BlockedRepository },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateBlockedRepositoryResponse {
    return new CreateBlockedRepositoryResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateBlockedRepositoryResponse {
    return new CreateBlockedRepositoryResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateBlockedRepositoryResponse {
    return new CreateBlockedRepositoryResponse().fromJsonString(jsonString, options);
  }

  static equals(a: CreateBlockedRepositoryResponse | PlainMessage<CreateBlockedRepositoryResponse> | undefined, b: CreateBlockedRepositoryResponse | PlainMessage<CreateBlockedRepositoryResponse> | undefined): boolean {
    return proto3.util.equals(CreateBlockedRepositoryResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.DeleteBlockedRepositoryRequest
 */
export class DeleteBlockedRepositoryRequest extends Message<DeleteBlockedRepositoryRequest> {
  /**
   * blocked_repository_id is the ID of the blocked repository
   *
   * @generated from field: uint32 blocked_repository_id = 1;
   */
  blockedRepositoryId = 0;

  constructor(data?: PartialMessage<DeleteBlockedRepositoryRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.DeleteBlockedRepositoryRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "blocked_repository_id", kind: "scalar", T: 13 /* ScalarType.UINT32 */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteBlockedRepositoryRequest {
    return new DeleteBlockedRepositoryRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteBlockedRepositoryRequest {
    return new DeleteBlockedRepositoryRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteBlockedRepositoryRequest {
    return new DeleteBlockedRepositoryRequest().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteBlockedRepositoryRequest | PlainMessage<DeleteBlockedRepositoryRequest> | undefined, b: DeleteBlockedRepositoryRequest | PlainMessage<DeleteBlockedRepositoryRequest> | undefined): boolean {
    return proto3.util.equals(DeleteBlockedRepositoryRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.DeleteBlockedRepositoryResponse
 */
export class DeleteBlockedRepositoryResponse extends Message<DeleteBlockedRepositoryResponse> {
  constructor(data?: PartialMessage<DeleteBlockedRepositoryResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.DeleteBlockedRepositoryResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): DeleteBlockedRepositoryResponse {
    return new DeleteBlockedRepositoryResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): DeleteBlockedRepositoryResponse {
    return new DeleteBlockedRepositoryResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): DeleteBlockedRepositoryResponse {
    return new DeleteBlockedRepositoryResponse().fromJsonString(jsonString, options);
  }

  static equals(a: DeleteBlockedRepositoryResponse | PlainMessage<DeleteBlockedRepositoryResponse> | undefined, b: DeleteBlockedRepositoryResponse | PlainMessage<DeleteBlockedRepositoryResponse> | undefined): boolean {
    return proto3.util.equals(DeleteBlockedRepositoryResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListBlockedEmailDomainsRequest
 */
export class ListBlockedEmailDomainsRequest extends Message<ListBlockedEmailDomainsRequest> {
  /**
   * pagination contains the pagination options for listing blocked email
   * domains
   *
   * @generated from field: gitpod.v1.PaginationRequest pagination = 1;
   */
  pagination?: PaginationRequest;

  constructor(data?: PartialMessage<ListBlockedEmailDomainsRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListBlockedEmailDomainsRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "pagination", kind: "message", T: PaginationRequest },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListBlockedEmailDomainsRequest {
    return new ListBlockedEmailDomainsRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListBlockedEmailDomainsRequest {
    return new ListBlockedEmailDomainsRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListBlockedEmailDomainsRequest {
    return new ListBlockedEmailDomainsRequest().fromJsonString(jsonString, options);
  }

  static equals(a: ListBlockedEmailDomainsRequest | PlainMessage<ListBlockedEmailDomainsRequest> | undefined, b: ListBlockedEmailDomainsRequest | PlainMessage<ListBlockedEmailDomainsRequest> | undefined): boolean {
    return proto3.util.equals(ListBlockedEmailDomainsRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.ListBlockedEmailDomainsResponse
 */
export class ListBlockedEmailDomainsResponse extends Message<ListBlockedEmailDomainsResponse> {
  /**
   * pagination contains the pagination options for listing blocked email
   * domains
   *
   * @generated from field: gitpod.v1.PaginationResponse pagination = 1;
   */
  pagination?: PaginationResponse;

  /**
   * blocked_email_domains are the blocked email domains
   *
   * @generated from field: repeated gitpod.v1.BlockedEmailDomain blocked_email_domains = 2;
   */
  blockedEmailDomains: BlockedEmailDomain[] = [];

  constructor(data?: PartialMessage<ListBlockedEmailDomainsResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.ListBlockedEmailDomainsResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "pagination", kind: "message", T: PaginationResponse },
    { no: 2, name: "blocked_email_domains", kind: "message", T: BlockedEmailDomain, repeated: true },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): ListBlockedEmailDomainsResponse {
    return new ListBlockedEmailDomainsResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): ListBlockedEmailDomainsResponse {
    return new ListBlockedEmailDomainsResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): ListBlockedEmailDomainsResponse {
    return new ListBlockedEmailDomainsResponse().fromJsonString(jsonString, options);
  }

  static equals(a: ListBlockedEmailDomainsResponse | PlainMessage<ListBlockedEmailDomainsResponse> | undefined, b: ListBlockedEmailDomainsResponse | PlainMessage<ListBlockedEmailDomainsResponse> | undefined): boolean {
    return proto3.util.equals(ListBlockedEmailDomainsResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.CreateBlockedEmailDomainRequest
 */
export class CreateBlockedEmailDomainRequest extends Message<CreateBlockedEmailDomainRequest> {
  /**
   * domain is the blocked email domain
   *
   * @generated from field: string domain = 1;
   */
  domain = "";

  /**
   * @generated from field: bool negative = 2;
   */
  negative = false;

  constructor(data?: PartialMessage<CreateBlockedEmailDomainRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.CreateBlockedEmailDomainRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "domain", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "negative", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateBlockedEmailDomainRequest {
    return new CreateBlockedEmailDomainRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateBlockedEmailDomainRequest {
    return new CreateBlockedEmailDomainRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateBlockedEmailDomainRequest {
    return new CreateBlockedEmailDomainRequest().fromJsonString(jsonString, options);
  }

  static equals(a: CreateBlockedEmailDomainRequest | PlainMessage<CreateBlockedEmailDomainRequest> | undefined, b: CreateBlockedEmailDomainRequest | PlainMessage<CreateBlockedEmailDomainRequest> | undefined): boolean {
    return proto3.util.equals(CreateBlockedEmailDomainRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.CreateBlockedEmailDomainResponse
 */
export class CreateBlockedEmailDomainResponse extends Message<CreateBlockedEmailDomainResponse> {
  /**
   * @generated from field: gitpod.v1.BlockedEmailDomain blocked_email_domain = 1;
   */
  blockedEmailDomain?: BlockedEmailDomain;

  constructor(data?: PartialMessage<CreateBlockedEmailDomainResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.CreateBlockedEmailDomainResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "blocked_email_domain", kind: "message", T: BlockedEmailDomain },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): CreateBlockedEmailDomainResponse {
    return new CreateBlockedEmailDomainResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): CreateBlockedEmailDomainResponse {
    return new CreateBlockedEmailDomainResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): CreateBlockedEmailDomainResponse {
    return new CreateBlockedEmailDomainResponse().fromJsonString(jsonString, options);
  }

  static equals(a: CreateBlockedEmailDomainResponse | PlainMessage<CreateBlockedEmailDomainResponse> | undefined, b: CreateBlockedEmailDomainResponse | PlainMessage<CreateBlockedEmailDomainResponse> | undefined): boolean {
    return proto3.util.equals(CreateBlockedEmailDomainResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.BlockedRepository
 */
export class BlockedRepository extends Message<BlockedRepository> {
  /**
   * id is the ID of the blocked repository
   *
   * @generated from field: uint32 id = 1;
   */
  id = 0;

  /**
   * url_regexp is the regular expression for the repository URL
   *
   * @generated from field: string url_regexp = 2;
   */
  urlRegexp = "";

  /**
   * block_user indicates if the user should be blocked from accessing the
   * repository
   *
   * @generated from field: bool block_user = 3;
   */
  blockUser = false;

  /**
   * @generated from field: google.protobuf.Timestamp creation_time = 4;
   */
  creationTime?: Timestamp;

  /**
   * @generated from field: google.protobuf.Timestamp update_time = 5;
   */
  updateTime?: Timestamp;

  /**
   * block_free_usage indicates if a free tier user may not start a workspace on that repository URL
   *
   * @generated from field: bool block_free_usage = 6;
   */
  blockFreeUsage = false;

  constructor(data?: PartialMessage<BlockedRepository>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.BlockedRepository";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 13 /* ScalarType.UINT32 */ },
    { no: 2, name: "url_regexp", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "block_user", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
    { no: 4, name: "creation_time", kind: "message", T: Timestamp },
    { no: 5, name: "update_time", kind: "message", T: Timestamp },
    { no: 6, name: "block_free_usage", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): BlockedRepository {
    return new BlockedRepository().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): BlockedRepository {
    return new BlockedRepository().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): BlockedRepository {
    return new BlockedRepository().fromJsonString(jsonString, options);
  }

  static equals(a: BlockedRepository | PlainMessage<BlockedRepository> | undefined, b: BlockedRepository | PlainMessage<BlockedRepository> | undefined): boolean {
    return proto3.util.equals(BlockedRepository, a, b);
  }
}

/**
 * @generated from message gitpod.v1.BlockedEmailDomain
 */
export class BlockedEmailDomain extends Message<BlockedEmailDomain> {
  /**
   * id is the ID of the blocked email domain
   *
   * @generated from field: string id = 1;
   */
  id = "";

  /**
   * domain is the blocked email domain
   *
   * @generated from field: string domain = 2;
   */
  domain = "";

  /**
   * @generated from field: bool negative = 3;
   */
  negative = false;

  constructor(data?: PartialMessage<BlockedEmailDomain>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.BlockedEmailDomain";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 2, name: "domain", kind: "scalar", T: 9 /* ScalarType.STRING */ },
    { no: 3, name: "negative", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): BlockedEmailDomain {
    return new BlockedEmailDomain().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): BlockedEmailDomain {
    return new BlockedEmailDomain().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): BlockedEmailDomain {
    return new BlockedEmailDomain().fromJsonString(jsonString, options);
  }

  static equals(a: BlockedEmailDomain | PlainMessage<BlockedEmailDomain> | undefined, b: BlockedEmailDomain | PlainMessage<BlockedEmailDomain> | undefined): boolean {
    return proto3.util.equals(BlockedEmailDomain, a, b);
  }
}

/**
 * @generated from message gitpod.v1.GetInstallationConfigurationRequest
 */
export class GetInstallationConfigurationRequest extends Message<GetInstallationConfigurationRequest> {
  constructor(data?: PartialMessage<GetInstallationConfigurationRequest>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetInstallationConfigurationRequest";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetInstallationConfigurationRequest {
    return new GetInstallationConfigurationRequest().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetInstallationConfigurationRequest {
    return new GetInstallationConfigurationRequest().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetInstallationConfigurationRequest {
    return new GetInstallationConfigurationRequest().fromJsonString(jsonString, options);
  }

  static equals(a: GetInstallationConfigurationRequest | PlainMessage<GetInstallationConfigurationRequest> | undefined, b: GetInstallationConfigurationRequest | PlainMessage<GetInstallationConfigurationRequest> | undefined): boolean {
    return proto3.util.equals(GetInstallationConfigurationRequest, a, b);
  }
}

/**
 * @generated from message gitpod.v1.GetInstallationConfigurationResponse
 */
export class GetInstallationConfigurationResponse extends Message<GetInstallationConfigurationResponse> {
  /**
   * @generated from field: gitpod.v1.InstallationConfiguration configuration = 1;
   */
  configuration?: InstallationConfiguration;

  constructor(data?: PartialMessage<GetInstallationConfigurationResponse>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.GetInstallationConfigurationResponse";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "configuration", kind: "message", T: InstallationConfiguration },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): GetInstallationConfigurationResponse {
    return new GetInstallationConfigurationResponse().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): GetInstallationConfigurationResponse {
    return new GetInstallationConfigurationResponse().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): GetInstallationConfigurationResponse {
    return new GetInstallationConfigurationResponse().fromJsonString(jsonString, options);
  }

  static equals(a: GetInstallationConfigurationResponse | PlainMessage<GetInstallationConfigurationResponse> | undefined, b: GetInstallationConfigurationResponse | PlainMessage<GetInstallationConfigurationResponse> | undefined): boolean {
    return proto3.util.equals(GetInstallationConfigurationResponse, a, b);
  }
}

/**
 * @generated from message gitpod.v1.InstallationConfiguration
 */
export class InstallationConfiguration extends Message<InstallationConfiguration> {
  /**
   * @generated from field: bool is_dedicated_installation = 1;
   */
  isDedicatedInstallation = false;

  constructor(data?: PartialMessage<InstallationConfiguration>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime: typeof proto3 = proto3;
  static readonly typeName = "gitpod.v1.InstallationConfiguration";
  static readonly fields: FieldList = proto3.util.newFieldList(() => [
    { no: 1, name: "is_dedicated_installation", kind: "scalar", T: 8 /* ScalarType.BOOL */ },
  ]);

  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): InstallationConfiguration {
    return new InstallationConfiguration().fromBinary(bytes, options);
  }

  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): InstallationConfiguration {
    return new InstallationConfiguration().fromJson(jsonValue, options);
  }

  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): InstallationConfiguration {
    return new InstallationConfiguration().fromJsonString(jsonString, options);
  }

  static equals(a: InstallationConfiguration | PlainMessage<InstallationConfiguration> | undefined, b: InstallationConfiguration | PlainMessage<InstallationConfiguration> | undefined): boolean {
    return proto3.util.equals(InstallationConfiguration, a, b);
  }
}
