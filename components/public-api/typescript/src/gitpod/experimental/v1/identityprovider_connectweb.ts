/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-web v0.2.1 with parameter "target=ts"
// @generated from file gitpod/experimental/v1/identityprovider.proto (package gitpod.experimental.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import {GetIDTokenRequest, GetIDTokenResponse} from "./identityprovider_pb.js";
import {MethodKind} from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.experimental.v1.IdentityProviderService
 */
export const IdentityProviderService = {
  typeName: "gitpod.experimental.v1.IdentityProviderService",
  methods: {
    /**
     * GetIDToken produces a new OIDC ID token (https://openid.net/specs/openid-connect-core-1_0.html#ImplicitIDToken)
     *
     * @generated from rpc gitpod.experimental.v1.IdentityProviderService.GetIDToken
     */
    getIDToken: {
      name: "GetIDToken",
      I: GetIDTokenRequest,
      O: GetIDTokenResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;

