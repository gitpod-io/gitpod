/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { InstallationService as InstallationServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/installation_connect";
import {
    CreateBlockedEmailDomainRequest,
    CreateBlockedEmailDomainResponse,
    CreateBlockedRepositoryRequest,
    CreateBlockedRepositoryResponse,
    DeleteBlockedRepositoryRequest,
    DeleteBlockedRepositoryResponse,
    GetInstallationConfigurationRequest,
    GetInstallationConfigurationResponse,
    GetInstallationWorkspaceDefaultImageRequest,
    GetInstallationWorkspaceDefaultImageResponse,
    GetOnboardingStateRequest,
    GetOnboardingStateResponse,
    ListBlockedEmailDomainsRequest,
    ListBlockedEmailDomainsResponse,
    ListBlockedRepositoriesRequest,
    ListBlockedRepositoriesResponse,
} from "@gitpod/public-api/lib/gitpod/v1/installation_pb";
import { inject, injectable } from "inversify";
import { InstallationService } from "../auth/installation-service";
import { ctxUserId } from "../util/request-context";
import { PaginationToken, generatePaginationToken, parsePaginationToken } from "./pagination";
import { parseSorting } from "./sorting";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { Unauthenticated } from "./unauthenticated";

@injectable()
export class InstallationServiceAPI implements ServiceImpl<typeof InstallationServiceInterface> {
    @inject(InstallationService) private readonly installationService: InstallationService;

    @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter;

    async getInstallationWorkspaceDefaultImage(
        req: GetInstallationWorkspaceDefaultImageRequest,
        _: HandlerContext,
    ): Promise<GetInstallationWorkspaceDefaultImageResponse> {
        const img = await this.installationService.getWorkspaceDefaultImage();
        return new GetInstallationWorkspaceDefaultImageResponse({ defaultWorkspaceImage: img });
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
        const data = await this.installationService.adminGetBlockedRepositories(ctxUserId(), {
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
        const blockedRepository = await this.installationService.adminCreateBlockedRepository(ctxUserId(), {
            urlRegexp: req.urlRegexp,
            blockUser: req.blockUser ?? false,
            blockFreeUsage: req.blockFreeUsage ?? false,
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
        await this.installationService.adminDeleteBlockedRepository(ctxUserId(), req.blockedRepositoryId);
        return new DeleteBlockedRepositoryResponse();
    }

    async listBlockedEmailDomains(
        req: ListBlockedEmailDomainsRequest,
        _: HandlerContext,
    ): Promise<ListBlockedEmailDomainsResponse> {
        const list = await this.installationService.adminGetBlockedEmailDomains(ctxUserId());
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
        const data = await this.installationService.adminCreateBlockedEmailDomain(ctxUserId(), {
            domain: req.domain,
            negative: req.negative,
        });
        return new CreateBlockedEmailDomainResponse({
            blockedEmailDomain: this.apiConverter.toBlockedEmailDomain(data),
        });
    }

    @Unauthenticated()
    async getOnboardingState(req: GetOnboardingStateRequest): Promise<GetOnboardingStateResponse> {
        const state = await this.installationService.getOnboardingState();
        return new GetOnboardingStateResponse({
            onboardingState: this.apiConverter.toOnboardingState(state),
        });
    }

    @Unauthenticated()
    async getInstallationConfiguration(
        req: GetInstallationConfigurationRequest,
    ): Promise<GetInstallationConfigurationResponse> {
        const config = await this.installationService.getInstallationConfiguration();
        return new GetInstallationConfigurationResponse({
            configuration: this.apiConverter.toInstallationConfiguration(config),
        });
    }
}
