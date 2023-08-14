/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-web v0.2.1 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/user.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import {BlockUserRequest, BlockUserResponse, CreateSSHKeyRequest, CreateSSHKeyResponse, DeleteSSHKeyRequest, DeleteSSHKeyResponse, GetAuthenticatedUserRequest, GetAuthenticatedUserResponse, GetGitTokenRequest, GetGitTokenResponse, GetSSHKeyRequest, GetSSHKeyResponse, GetSuggestedReposRequest, GetSuggestedReposResponse, ListSSHKeysRequest, ListSSHKeysResponse} from "./user_pb.js";
import {MethodKind} from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.experimental.v1.UserService
 */
export const UserService = {
  typeName: "gitpod.experimental.v1.UserService",
  methods: {
    /**
     * GetAuthenticatedUser gets the user info.
     *
     * @generated from rpc gitpod.experimental.v1.UserService.GetAuthenticatedUser
     */
    getAuthenticatedUser: {
      name: "GetAuthenticatedUser",
      I: GetAuthenticatedUserRequest,
      O: GetAuthenticatedUserResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ListSSHKeys lists the public SSH keys.
     *
     * @generated from rpc gitpod.experimental.v1.UserService.ListSSHKeys
     */
    listSSHKeys: {
      name: "ListSSHKeys",
      I: ListSSHKeysRequest,
      O: ListSSHKeysResponse,
      kind: MethodKind.Unary,
    },
    /**
     * CreateSSHKey adds a public SSH key.
     *
     * @generated from rpc gitpod.experimental.v1.UserService.CreateSSHKey
     */
    createSSHKey: {
      name: "CreateSSHKey",
      I: CreateSSHKeyRequest,
      O: CreateSSHKeyResponse,
      kind: MethodKind.Unary,
    },
    /**
     * GetSSHKey retrieves an ssh key by ID.
     *
     * @generated from rpc gitpod.experimental.v1.UserService.GetSSHKey
     */
    getSSHKey: {
      name: "GetSSHKey",
      I: GetSSHKeyRequest,
      O: GetSSHKeyResponse,
      kind: MethodKind.Unary,
    },
    /**
     * DeleteSSHKey removes a public SSH key.
     *
     * @generated from rpc gitpod.experimental.v1.UserService.DeleteSSHKey
     */
    deleteSSHKey: {
      name: "DeleteSSHKey",
      I: DeleteSSHKeyRequest,
      O: DeleteSSHKeyResponse,
      kind: MethodKind.Unary,
    },
    /**
     * @generated from rpc gitpod.experimental.v1.UserService.GetGitToken
     */
    getGitToken: {
      name: "GetGitToken",
      I: GetGitTokenRequest,
      O: GetGitTokenResponse,
      kind: MethodKind.Unary,
    },
    /**
     * GetSuggestedRepos returns a list of suggested repositories to open for the user.
     *
     * @generated from rpc gitpod.experimental.v1.UserService.GetSuggestedRepos
     */
    getSuggestedRepos: {
      name: "GetSuggestedRepos",
      I: GetSuggestedReposRequest,
      O: GetSuggestedReposResponse,
      kind: MethodKind.Unary,
    },
    /**
     * @generated from rpc gitpod.experimental.v1.UserService.BlockUser
     */
    blockUser: {
      name: "BlockUser",
      I: BlockUserRequest,
      O: BlockUserResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;
