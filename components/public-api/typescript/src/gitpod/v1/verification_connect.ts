/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-es v1.1.2 with parameter "target=ts"
// @generated from file gitpod/v1/verification.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import { SendPhoneNumberVerificationTokenRequest, SendPhoneNumberVerificationTokenResponse, VerifyPhoneNumberVerificationTokenRequest, VerifyPhoneNumberVerificationTokenResponse } from "./verification_pb.js";
import { MethodKind } from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.v1.VerificationService
 */
export const VerificationService = {
  typeName: "gitpod.v1.VerificationService",
  methods: {
    /**
     * SendPhoneNumberVerificationToken sends a verification token to the
     * specified phone number.
     *
     * @generated from rpc gitpod.v1.VerificationService.SendPhoneNumberVerificationToken
     */
    sendPhoneNumberVerificationToken: {
      name: "SendPhoneNumberVerificationToken",
      I: SendPhoneNumberVerificationTokenRequest,
      O: SendPhoneNumberVerificationTokenResponse,
      kind: MethodKind.Unary,
    },
    /**
     * VerifyPhoneNumberVerificationToken verifies the specified verification
     * token.
     *
     * @generated from rpc gitpod.v1.VerificationService.VerifyPhoneNumberVerificationToken
     */
    verifyPhoneNumberVerificationToken: {
      name: "VerifyPhoneNumberVerificationToken",
      I: VerifyPhoneNumberVerificationTokenRequest,
      O: VerifyPhoneNumberVerificationTokenResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;
