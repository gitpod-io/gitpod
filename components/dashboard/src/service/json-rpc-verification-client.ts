/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CallOptions, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { VerificationService } from "@gitpod/public-api/lib/gitpod/v1/verification_connect";
import {
    SendPhoneNumberVerificationTokenRequest,
    SendPhoneNumberVerificationTokenResponse,
    VerifyPhoneNumberVerificationTokenRequest,
    VerifyPhoneNumberVerificationTokenResponse,
    ListBlockedRepositoriesRequest,
    ListBlockedRepositoriesResponse,
    CreateBlockedRepositoryRequest,
    CreateBlockedRepositoryResponse,
    DeleteBlockedRepositoryRequest,
    DeleteBlockedRepositoryResponse,
    ListBlockedEmailDomainsRequest,
    ListBlockedEmailDomainsResponse,
    CreateBlockedEmailDomainRequest,
    CreateBlockedEmailDomainResponse,
} from "@gitpod/public-api/lib/gitpod/v1/verification_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { getGitpodService } from "./service";
import { validate as uuidValidate } from "uuid";
import { converter } from "./public-api";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";

export class JsonRpcVerificationClient implements PromiseClient<typeof VerificationService> {
    async sendPhoneNumberVerificationToken(
        request: PartialMessage<SendPhoneNumberVerificationTokenRequest>,
        _options?: CallOptions | undefined,
    ): Promise<SendPhoneNumberVerificationTokenResponse> {
        if (!request.phoneNumber) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "phoneNumber is required");
        }
        const info = await getGitpodService().server.sendPhoneNumberVerificationToken(request.phoneNumber);
        return new SendPhoneNumberVerificationTokenResponse({
            verificationId: info.verificationId,
        });
    }

    async verifyPhoneNumberVerificationToken(
        request: PartialMessage<VerifyPhoneNumberVerificationTokenRequest>,
        _options?: CallOptions | undefined,
    ): Promise<VerifyPhoneNumberVerificationTokenResponse> {
        if (!request.phoneNumber) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "phoneNumber is required");
        }
        if (!request.verificationId || !uuidValidate(request.verificationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "verificationId is required");
        }
        if (!request.token) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "token is required");
        }
        const info = await getGitpodService().server.verifyPhoneNumberVerificationToken(
            request.phoneNumber,
            request.token,
            request.verificationId,
        );
        return new VerifyPhoneNumberVerificationTokenResponse({
            verified: info,
        });
    }

    async listBlockedRepositories(
        request: PartialMessage<ListBlockedRepositoriesRequest>,
        _options?: CallOptions | undefined,
    ): Promise<ListBlockedRepositoriesResponse> {
        // dashboard params is constant, no need to implement
        const info = await getGitpodService().server.adminGetBlockedRepositories({
            limit: 100,
            offset: 0,
            orderBy: "urlRegexp",
            orderDir: "asc",
            searchTerm: request.searchTerm,
        });
        return new ListBlockedRepositoriesResponse({
            blockedRepositories: info.rows.map((item) => converter.toBlockedRepository(item)),
            pagination: new PaginationResponse(),
        });
    }

    async createBlockedRepository(
        request: PartialMessage<CreateBlockedRepositoryRequest>,
        _options?: CallOptions | undefined,
    ): Promise<CreateBlockedRepositoryResponse> {
        if (!request.urlRegexp) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "urlRegexp is required");
        }
        if (!request.blockUser) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "blockUser is required");
        }
        const info = await getGitpodService().server.adminCreateBlockedRepository(request.urlRegexp, request.blockUser);
        return new CreateBlockedRepositoryResponse({
            blockedRepository: converter.toBlockedRepository(info),
        });
    }

    async deleteBlockedRepository(
        request: PartialMessage<DeleteBlockedRepositoryRequest>,
        _options?: CallOptions | undefined,
    ): Promise<DeleteBlockedRepositoryResponse> {
        if (!request.blockedRepositoryId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "blockedRepositoryId is required");
        }
        await getGitpodService().server.adminDeleteBlockedRepository(request.blockedRepositoryId);
        return new DeleteBlockedRepositoryResponse();
    }

    async listBlockedEmailDomains(
        request: PartialMessage<ListBlockedEmailDomainsRequest>,
        _options?: CallOptions | undefined,
    ): Promise<ListBlockedEmailDomainsResponse> {
        const info = await getGitpodService().server.adminGetBlockedEmailDomains();
        return new ListBlockedEmailDomainsResponse({
            blockedEmailDomains: info.map((item) => converter.toBlockedEmailDomain(item)),
            pagination: new PaginationResponse(),
        });
    }

    async createBlockedEmailDomain(
        request: PartialMessage<CreateBlockedEmailDomainRequest>,
        _options?: CallOptions | undefined,
    ): Promise<CreateBlockedEmailDomainResponse> {
        if (!request.domain) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "domain is required");
        }
        if (request.negative === undefined) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "negative is required");
        }
        await getGitpodService().server.adminSaveBlockedEmailDomain({
            domain: request.domain,
            negative: request.negative,
        });
        // There's no way to get blockedEmailDomain, just ignore it since dashboard don't care about the response data
        return new CreateBlockedEmailDomainResponse({});
    }
}
