/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { VerificationService as VerificationServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/verification_connect";
import {
    CreateBlockedEmailDomainRequest,
    CreateBlockedEmailDomainResponse,
    CreateBlockedRepositoryRequest,
    CreateBlockedRepositoryResponse,
    DeleteBlockedRepositoryRequest,
    DeleteBlockedRepositoryResponse,
    ListBlockedEmailDomainsRequest,
    ListBlockedEmailDomainsResponse,
    ListBlockedRepositoriesRequest,
    ListBlockedRepositoriesResponse,
    SendPhoneNumberVerificationTokenRequest,
    SendPhoneNumberVerificationTokenResponse,
    VerifyPhoneNumberVerificationTokenRequest,
    VerifyPhoneNumberVerificationTokenResponse,
} from "@gitpod/public-api/lib/gitpod/v1/verification_pb";
import { inject, injectable } from "inversify";
import { VerificationService } from "../auth/verification-service";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";
import { formatPhoneNumber } from "../user/phone-numbers";
import { validate as uuidValidate } from "uuid";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { PaginationToken, generatePaginationToken, parsePaginationToken } from "./pagination";
import { parseSorting } from "./sorting";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";

@injectable()
export class VerificationServiceAPI implements ServiceImpl<typeof VerificationServiceInterface> {
    @inject(VerificationService) private readonly verificationService: VerificationService;
    @inject(UserService) private readonly userService: UserService;
    @inject(UserDB) private readonly userDB: UserDB;

    @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter;

    async sendPhoneNumberVerificationToken(
        req: SendPhoneNumberVerificationTokenRequest,
        _: HandlerContext,
    ): Promise<SendPhoneNumberVerificationTokenResponse> {
        if (!req.phoneNumber) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "phoneNumber is required");
        }

        const userId = ctxUserId();
        const user = await this.userService.findUserById(userId, userId);

        // Check if verify via call is enabled
        const phoneVerificationByCall = await getExperimentsClientForBackend().getValueAsync(
            "phoneVerificationByCall",
            false,
            {
                user,
            },
        );
        const channel = phoneVerificationByCall ? "call" : "sms";
        const { verificationId } = await this.verificationService.sendVerificationToken(
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

        const { verified } = await this.verificationService.verifyVerificationToken(
            phoneNumber,
            req.token,
            req.verificationId,
        );
        if (verified) {
            this.verificationService.markVerified(user);
            user.verificationPhoneNumber = phoneNumber;
            await this.userDB.updateUserPartial(user);
        }
        return new VerifyPhoneNumberVerificationTokenResponse({
            verified,
        });
    }

    async listBlockedRepositories(
        req: ListBlockedRepositoriesRequest,
        _: HandlerContext,
    ): Promise<ListBlockedRepositoriesResponse> {
        const paginationToken = parsePaginationToken(req.pagination?.token);

        const sorting = parseSorting(req.sort, {
            allowFields: ["urlRegexp"],
            defaultField: "urlRegexp",
        })!;
        const limit = req.pagination?.pageSize ?? 50;
        const data = await this.verificationService.adminGetBlockedRepositories(ctxUserId(), {
            offset: paginationToken.offset,
            // We request 1 additional record to help determine if there are more results
            limit: limit + 1,
            orderBy: sorting.orderBy as any,
            orderDir: sorting.orderDir,
            searchTerm: req.searchTerm,
        });

        // Drop the extra record we requested to determine if there are more results
        const pagedRows = data.rows.slice(0, limit);

        const response = new ListBlockedRepositoriesResponse({
            blockedRepositories: pagedRows.map((blockedRepository) =>
                this.apiConverter.toBlockedRepository(blockedRepository),
            ),
        });
        response.pagination = new PaginationResponse();
        if (data.rows.length > limit) {
            const nextToken: PaginationToken = {
                offset: paginationToken.offset + limit,
            };
            response.pagination.nextToken = generatePaginationToken(nextToken);
        }
        return response;
    }

    async createBlockedRepository(
        req: CreateBlockedRepositoryRequest,
        _: HandlerContext,
    ): Promise<CreateBlockedRepositoryResponse> {
        if (!req.urlRegexp) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "urlRegexp is required");
        }
        const blockedRepository = await this.verificationService.adminCreateBlockedRepository(ctxUserId(), {
            urlRegexp: req.urlRegexp,
            blockUser: req.blockUser ?? false,
        });
        return new CreateBlockedRepositoryResponse({
            blockedRepository: this.apiConverter.toBlockedRepository(blockedRepository),
        });
    }

    async deleteBlockedRepository(
        req: DeleteBlockedRepositoryRequest,
        _: HandlerContext,
    ): Promise<DeleteBlockedRepositoryResponse> {
        if (!req.blockedRepositoryId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "blockedRepositoryId is required");
        }
        await this.verificationService.adminDeleteBlockedRepository(ctxUserId(), req.blockedRepositoryId);
        return new DeleteBlockedRepositoryResponse();
    }

    async listBlockedEmailDomains(
        req: ListBlockedEmailDomainsRequest,
        _: HandlerContext,
    ): Promise<ListBlockedEmailDomainsResponse> {
        const list = await this.verificationService.adminGetBlockedEmailDomains(ctxUserId());
        return new ListBlockedEmailDomainsResponse({
            blockedEmailDomains: list.map((item) => this.apiConverter.toBlockedEmailDomain(item)),
            pagination: new PaginationResponse(),
        });
    }

    async createBlockedEmailDomain(
        req: CreateBlockedEmailDomainRequest,
        _: HandlerContext,
    ): Promise<CreateBlockedEmailDomainResponse> {
        if (!req.domain) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "domain is required");
        }
        if (req.negative === undefined) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "negative is required");
        }
        const data = await this.verificationService.adminCreateBlockedEmailDomain(ctxUserId(), {
            domain: req.domain,
            negative: req.negative,
        });
        return new CreateBlockedEmailDomainResponse({
            blockedEmailDomain: this.apiConverter.toBlockedEmailDomain(data),
        });
    }
}
