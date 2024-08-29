/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { SCMService as ScmServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/scm_connect";
import { inject, injectable } from "inversify";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { ScmService } from "../scm/scm-service";
import {
    GuessTokenScopesRequest,
    GuessTokenScopesResponse,
    SearchRepositoriesRequest,
    SearchRepositoriesResponse,
    ListSuggestedRepositoriesRequest,
    ListSuggestedRepositoriesResponse,
    SearchSCMTokensRequest,
    SearchSCMTokensResponse,
} from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { ctxUserId } from "../util/request-context";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { validate as uuidValidate } from "uuid";
import { ProjectsService } from "../projects/projects-service";
import { WorkspaceService } from "../workspace/workspace-service";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { Project } from "@gitpod/gitpod-protocol";

@injectable()
export class ScmServiceAPI implements ServiceImpl<typeof ScmServiceInterface> {
    constructor(
        @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter,
        @inject(ScmService) private readonly scmService: ScmService,
        @inject(ProjectsService) private readonly projectService: ProjectsService,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
    ) {}

    async searchSCMTokens(request: SearchSCMTokensRequest, _: HandlerContext): Promise<SearchSCMTokensResponse> {
        const userId = ctxUserId();
        const response = new SearchSCMTokensResponse();
        const token = await this.scmService.getToken(userId, request);
        if (token) {
            response.tokens.push(this.apiConverter.toSCMToken(token));
        }
        return response;
    }

    async guessTokenScopes(request: GuessTokenScopesRequest, _: HandlerContext): Promise<GuessTokenScopesResponse> {
        const userId = ctxUserId();
        const { scopes, message } = await this.scmService.guessTokenScopes(userId, request);
        return new GuessTokenScopesResponse({
            scopes,
            message,
        });
    }

    async searchRepositories(
        request: SearchRepositoriesRequest,
        _: HandlerContext,
    ): Promise<SearchRepositoriesResponse> {
        const userId = ctxUserId();
        const repos = await this.scmService.searchRepositories(userId, {
            searchString: request.searchString,
            limit: request.limit,
        });
        return new SearchRepositoriesResponse({
            repositories: repos.map((r) => this.apiConverter.toSuggestedRepository(r)),
        });
    }

    async listSuggestedRepositories(
        request: ListSuggestedRepositoriesRequest,
        _: HandlerContext,
    ): Promise<ListSuggestedRepositoriesResponse> {
        const userId = ctxUserId();
        const { organizationId, excludeConfigurations } = request;

        if (!uuidValidate(organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId must be a valid UUID");
        }

        if (request.pagination?.pageSize && request.pagination?.pageSize > 100) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Pagesize must not exceed 100");
        }

        const projectsPromise: Promise<Project[]> = !excludeConfigurations
            ? this.projectService.getProjects(userId, organizationId, { limit: request.pagination?.pageSize })
            : Promise.resolve([]);
        const workspacesPromise = this.workspaceService.getWorkspaces(userId, { organizationId });
        const repos = await this.scmService.listSuggestedRepositories(userId, { projectsPromise, workspacesPromise });
        return new ListSuggestedRepositoriesResponse({
            repositories: repos.map((r) => this.apiConverter.toSuggestedRepository(r)),
            pagination: new PaginationResponse({
                nextToken: "",
            }),
        });
    }
}
