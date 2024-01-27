/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-es v1.1.2 with parameter "target=ts"
// @generated from file gitpod/v1/authprovider.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import { CreateAuthProviderRequest, CreateAuthProviderResponse, DeleteAuthProviderRequest, DeleteAuthProviderResponse, GetAuthProviderRequest, GetAuthProviderResponse, ListAuthProviderDescriptionsRequest, ListAuthProviderDescriptionsResponse, ListAuthProvidersRequest, ListAuthProvidersResponse, UpdateAuthProviderRequest, UpdateAuthProviderResponse } from "./authprovider_pb.js";
import { MethodKind } from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.v1.AuthProviderService
 */
export const AuthProviderService = {
  typeName: "gitpod.v1.AuthProviderService",
  methods: {
    /**
     * CreateAuthProvider creates a new auth provider.
     *
     * @generated from rpc gitpod.v1.AuthProviderService.CreateAuthProvider
     */
    createAuthProvider: {
      name: "CreateAuthProvider",
      I: CreateAuthProviderRequest,
      O: CreateAuthProviderResponse,
      kind: MethodKind.Unary,
    },
    /**
     * GetAuthProvider returns a single auth provider.
     *
     * @generated from rpc gitpod.v1.AuthProviderService.GetAuthProvider
     */
    getAuthProvider: {
      name: "GetAuthProvider",
      I: GetAuthProviderRequest,
      O: GetAuthProviderResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ListAuthProviders lists auth providers.
     *
     * @generated from rpc gitpod.v1.AuthProviderService.ListAuthProviders
     */
    listAuthProviders: {
      name: "ListAuthProviders",
      I: ListAuthProvidersRequest,
      O: ListAuthProvidersResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ListAuthProviderDescriptions lists publicly available descriptions of
     * authproviders.
     *
     * @generated from rpc gitpod.v1.AuthProviderService.ListAuthProviderDescriptions
     */
    listAuthProviderDescriptions: {
      name: "ListAuthProviderDescriptions",
      I: ListAuthProviderDescriptionsRequest,
      O: ListAuthProviderDescriptionsResponse,
      kind: MethodKind.Unary,
    },
    /**
     * UpdateAuthProvider updates an auth provider.
     *
     * @generated from rpc gitpod.v1.AuthProviderService.UpdateAuthProvider
     */
    updateAuthProvider: {
      name: "UpdateAuthProvider",
      I: UpdateAuthProviderRequest,
      O: UpdateAuthProviderResponse,
      kind: MethodKind.Unary,
    },
    /**
     * DeleteAuthProvider deletes the specified auth provider.
     *
     * @generated from rpc gitpod.v1.AuthProviderService.DeleteAuthProvider
     */
    deleteAuthProvider: {
      name: "DeleteAuthProvider",
      I: DeleteAuthProviderRequest,
      O: DeleteAuthProviderResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;
