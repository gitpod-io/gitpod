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
import { Sort, SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";
import { Config } from "../config";

@injectable()
export class PrebuildServiceAPI implements ServiceImpl<typeof PrebuildServiceInterface> {
    @inject(ProjectsService)
    private readonly projectService: ProjectsService;

    @inject(PrebuildManager)
    private readonly prebuildManager: PrebuildManager;

    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    @inject(Config) private readonly config: Config;

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
            prebuild: this.apiConverter.toPrebuild(this.config.hostUrl.toString(), result),
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
                        prebuilds: [this.apiConverter.toPrebuild(this.config.hostUrl.toString(), prebuild)],
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
        // TODO pagination
        return new ListPrebuildsResponse({
            prebuilds: this.apiConverter.toPrebuilds(this.config.hostUrl.toString(), result),
        });
    }

    async *watchPrebuild(request: WatchPrebuildRequest): AsyncIterable<WatchPrebuildResponse> {
        if (!request.scope.value || !uuidValidate(request.scope.value)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "scope is required");
        }

        const filter = {
            configurationId: request.scope.case === "configurationId" ? request.scope.value : undefined,
            prebuildId: request.scope.case === "prebuildId" ? request.scope.value : undefined,
        };
        const it = this.prebuildManager.getAndWatchPrebuildStatus(ctxUserId(), filter, { signal: ctxSignal() });

        for await (const pb of it) {
            yield new WatchPrebuildResponse({
                prebuild: this.apiConverter.toPrebuild(this.config.hostUrl.toString(), pb),
            });
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
        if ((filter?.searchTerm || "").length > 100) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "searchTerm must be less than 100 characters");
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

        if (filter?.state) {
            prebuildsFilter.state = this.apiConverter.fromPrebuildFilterState(filter?.state);
        }

        const sort = request.sort?.[0];
        const sorting = this.apiConverter.fromSort(
            new Sort({
                field: sort?.field ?? "creationTime",
                order: sort?.order ?? SortOrder.DESC,
            }),
        );
        if (!sorting.order) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "sort.order must have a valid value");
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
            {
                ...sorting,
                order: sorting.order ?? "DESC",
            },
        );

        const apiPrebuilds = prebuilds.map((pb) => this.apiConverter.toPrebuild(this.config.hostUrl.toString(), pb));
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
