/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ServiceImpl } from "@connectrpc/connect";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { PrebuildService as PrebuildServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/prebuild_connect";
import {
    GetPrebuildRequest,
    GetPrebuildResponse,
    ListPrebuildsRequest,
    ListPrebuildsResponse,
    StartPrebuildRequest,
    StartPrebuildResponse,
    CancelPrebuildRequest,
    CancelPrebuildResponse,
    WatchPrebuildRequest,
    WatchPrebuildResponse,
    ListOrganizationPrebuildsRequest,
    ListOrganizationPrebuildsResponse,
} from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { inject, injectable } from "inversify";
import { ProjectsService } from "../projects/projects-service";
import { PrebuildFilter, PrebuildManager } from "../prebuilds/prebuild-manager";
import { validate as uuidValidate } from "uuid";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ctxSignal, ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";
import { PaginationToken, generatePaginationToken, parsePaginationToken } from "./pagination";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";

@injectable()
export class PrebuildServiceAPI implements ServiceImpl<typeof PrebuildServiceInterface> {
    @inject(ProjectsService)
    private readonly projectService: ProjectsService;

    @inject(PrebuildManager)
    private readonly prebuildManager: PrebuildManager;

    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    @inject(UserService)
    private readonly userService: UserService;

    async startPrebuild(request: StartPrebuildRequest): Promise<StartPrebuildResponse> {
        if (!uuidValidate(request.configurationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }
        const userId = ctxUserId();
        const user = await this.userService.findUserById(userId, userId);
        const prebuild = await this.prebuildManager.triggerPrebuild({}, user, request.configurationId, request.gitRef);
        return new StartPrebuildResponse({
            prebuildId: prebuild.prebuildId,
        });
    }

    async cancelPrebuild(request: CancelPrebuildRequest): Promise<CancelPrebuildResponse> {
        if (!uuidValidate(request.prebuildId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "prebuildId is required");
        }
        await this.prebuildManager.cancelPrebuild({}, ctxUserId(), request.prebuildId);
        return new CancelPrebuildResponse();
    }

    async getPrebuild(request: GetPrebuildRequest): Promise<GetPrebuildResponse> {
        const traceContext = {};
        const result = await this.prebuildManager.getPrebuild(traceContext, ctxUserId(), request.prebuildId);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `prebuild ${request.prebuildId} not found`);
        }
        return new GetPrebuildResponse({
            prebuild: this.apiConverter.toPrebuild(result),
        });
    }

    async listPrebuilds(request: ListPrebuildsRequest): Promise<ListPrebuildsResponse> {
        const userId = ctxUserId();
        if (request.workspaceId) {
            const pbws = await this.prebuildManager.findPrebuildByWorkspaceID({}, userId, request.workspaceId);
            if (pbws) {
                const prebuild = await this.prebuildManager.getPrebuild({}, userId, pbws.id);
                if (prebuild) {
                    return new ListPrebuildsResponse({
                        prebuilds: [this.apiConverter.toPrebuild(prebuild)],
                    });
                }
            }
            return new ListPrebuildsResponse({
                prebuilds: [],
            });
        }

        if (!uuidValidate(request.configurationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }
        const result = await this.projectService.findPrebuilds(userId, {
            projectId: request.configurationId,
            branch: request.gitRef || undefined,
            limit: request.pagination?.pageSize || undefined,
        });
        // TODO paggination
        return new ListPrebuildsResponse({
            prebuilds: this.apiConverter.toPrebuilds(result),
        });
    }

    async *watchPrebuild(request: WatchPrebuildRequest): AsyncIterable<WatchPrebuildResponse> {
        if (!request.scope.value || !uuidValidate(request.scope.value)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "scope is required");
        }

        let configurationId = request.scope.value;
        if (request.scope.case === "prebuildId") {
            const resp = await this.getPrebuild(
                new GetPrebuildRequest({
                    prebuildId: request.scope.value,
                }),
            );
            yield new WatchPrebuildResponse({
                prebuild: resp.prebuild,
            });
            configurationId = resp.prebuild!.configurationId;
        }
        const it = await this.prebuildManager.watchPrebuildStatus(ctxUserId(), configurationId, {
            signal: ctxSignal(),
        });
        for await (const pb of it) {
            if (request.scope.case === "prebuildId") {
                if (pb.info.id !== request.scope.value) {
                    continue;
                }
            } else if (pb.info.projectId !== request.scope.value) {
                continue;
            }
            const prebuild = this.apiConverter.toPrebuild(pb);
            if (prebuild) {
                yield new WatchPrebuildResponse({ prebuild });
            }
        }
    }

    async listOrganizationPrebuilds(
        request: ListOrganizationPrebuildsRequest,
    ): Promise<ListOrganizationPrebuildsResponse> {
        const { organizationId, pagination, filter } = request;
        const userId = ctxUserId();

        const limit = pagination?.pageSize ?? 25;
        if (limit > 100) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "pageSize cannot be larger than 100");
        }
        if (limit <= 0) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "pageSize must be greater than 0");
        }
        if (!uuidValidate(organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        if (filter?.configuration?.branch && !filter?.configuration.id) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required when branch is specified");
        }

        const paginationToken = parsePaginationToken(request.pagination?.token);

        const prebuildsFilter: PrebuildFilter = {
            configuration: filter?.configuration,
            searchTerm: filter?.searchTerm,
        };
        if (filter?.status) {
            const parsedStatusFilter = this.apiConverter.fromPrebuildPhase(filter.status);
            if (parsedStatusFilter) {
                prebuildsFilter.status = parsedStatusFilter;
            } else {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "invalid prebuild status filter provided");
            }
        }

        const prebuilds = await this.prebuildManager.listPrebuilds(
            {},
            userId,
            organizationId,
            {
                limit: limit + 1,
                offset: paginationToken.offset,
            },
            prebuildsFilter,
        );

        const apiPrebuilds = prebuilds.map((pb) => this.apiConverter.toPrebuild(pb));
        const pagedResult = apiPrebuilds.slice(0, limit);

        const response = new ListOrganizationPrebuildsResponse({
            prebuilds: pagedResult,
        });
        response.pagination = new PaginationResponse();

        // If we got back an extra row, it means there are more results
        if (apiPrebuilds.length > limit) {
            const nextToken: PaginationToken = {
                offset: paginationToken.offset + limit,
            };

            response.pagination.nextToken = generatePaginationToken(nextToken);
        }

        return response;
    }
}
