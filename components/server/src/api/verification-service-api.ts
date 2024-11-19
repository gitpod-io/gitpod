/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { VerificationService as VerificationServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/verification_connect";
import {
    SendPhoneNumberVerificationTokenRequest,
    SendPhoneNumberVerificationTokenResponse,
    VerifyPhoneNumberVerificationTokenRequest,
    VerifyPhoneNumberVerificationTokenResponse,
} from "@gitpod/public-api/lib/gitpod/v1/verification_pb";
import { inject, injectable } from "inversify";
import { VerificationService } from "../auth/verification-service";
import { ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";
import { formatPhoneNumber } from "../user/phone-numbers";
import { validate as uuidValidate } from "uuid";

@injectable()
export class VerificationServiceAPI implements ServiceImpl<typeof VerificationServiceInterface> {
    @inject(VerificationService) private readonly verificationService: VerificationService;
    @inject(UserService) private readonly userService: UserService;

    async sendPhoneNumberVerificationToken(
        req: SendPhoneNumberVerificationTokenRequest,
        _: HandlerContext,
    ): Promise<SendPhoneNumberVerificationTokenResponse> {
        if (!req.phoneNumber) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "phoneNumber is required");
        }

        const channel = "call";
        const verificationId = await this.verificationService.sendVerificationToken(
            formatPhoneNumber(req.phoneNumber),
            channel,
        );
        return new SendPhoneNumberVerificationTokenResponse({
            verificationId,
        });
    }

    async verifyPhoneNumberVerificationToken(
        req: VerifyPhoneNumberVerificationTokenRequest,
        _: HandlerContext,
    ): Promise<VerifyPhoneNumberVerificationTokenResponse> {
        if (!req.phoneNumber) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "phoneNumber is required");
        }
        if (!req.verificationId || !uuidValidate(req.verificationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "verificationId is required");
        }
        if (!req.token) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "token is required");
        }
        const phoneNumber = formatPhoneNumber(req.phoneNumber);

        const userId = ctxUserId();
        const user = await this.userService.findUserById(userId, userId);

        const verified = await this.verificationService.verifyVerificationToken(
            user,
            phoneNumber,
            req.token,
            req.verificationId,
        );
        return new VerifyPhoneNumberVerificationTokenResponse({
            verified,
        });
    }
}
