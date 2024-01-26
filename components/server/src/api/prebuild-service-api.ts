/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ServiceImpl } from "@connectrpc/connect";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { onDownloadPrebuildLogsUrl } from "@gitpod/public-api-common/lib/prebuild-utils";
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
    WatchPrebuildLogsRequest,
    WatchPrebuildLogsResponse,
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
import { WorkspaceService } from "../workspace/workspace-service";
import { HEADLESS_LOG_DOWNLOAD_PATH_PREFIX, HEADLESS_LOGS_PATH_PREFIX } from "../workspace/headless-log-service";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

@injectable()
export class PrebuildServiceAPI implements ServiceImpl<typeof PrebuildServiceInterface> {
    @inject(ProjectsService)
    private readonly projectService: ProjectsService;

    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService;

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

    private parsePrebuildLogUrl(url: string) {
        // url of completed prebuild workspaces
        const downloadRegex = new RegExp(`${HEADLESS_LOG_DOWNLOAD_PATH_PREFIX}\/(?<instanceId>.*?)\/(?<taskId>.*?)$`);
        if (downloadRegex.test(url)) {
            const info = downloadRegex.exec(url)!.groups!;
            return { type: "completed" as const, instanceId: info.instanceId, taskId: info.taskId };
        }
        // url of running prebuild workspaces
        const runningRegex = new RegExp(`${HEADLESS_LOGS_PATH_PREFIX}\/(?<instanceId>.*?)\/(?<terminalId>.*?)$`);
        if (runningRegex.test(url)) {
            const info = runningRegex.exec(url)!.groups!;
            return { type: "running" as const, instanceId: info.instanceId, terminalId: info.terminalId };
        }
    }

    async *watchPrebuildLogs(request: WatchPrebuildLogsRequest): AsyncIterable<WatchPrebuildLogsResponse> {
        if (!uuidValidate(request.prebuildId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "prebuildId is required");
        }
        const userId = ctxUserId();

        const result = await this.prebuildManager.getPrebuild({}, userId, request.prebuildId);
        if (!result?.info.buildWorkspaceId) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "no build workspace found");
        }

        const workspaceStatusIt = this.workspaceService.getAndWatchWorkspaceStatus(
            userId,
            result.info.buildWorkspaceId,
            { signal: ctxSignal() },
        );
        let hasImageBuild = false;
        for await (const itWsInfo of workspaceStatusIt) {
            switch (itWsInfo.status?.phase?.name) {
                case WorkspacePhase_Phase.IMAGEBUILD: {
                    if (!hasImageBuild) {
                        hasImageBuild = true;
                        const imageBuildIt = this.workspaceService.getWorkspaceImageBuildLogsIterator(
                            userId,
                            itWsInfo.workspaceId,
                            {
                                signal: ctxSignal(),
                            },
                        );
                        for await (const message of imageBuildIt) {
                            yield new WatchPrebuildLogsResponse({ message });
                        }
                    }
                    break;
                }
                case WorkspacePhase_Phase.RUNNING:
                case WorkspacePhase_Phase.STOPPED: {
                    const urls = await this.workspaceService.getHeadlessLog(
                        userId,
                        itWsInfo.status.instanceId,
                        async () => {},
                    );
                    // TODO: Only listening on first stream for now
                    const firstUrl = Object.values(urls.streams)[0];
                    if (!firstUrl) {
                        throw new ApplicationError(ErrorCodes.NOT_FOUND, "no logs found");
                    }

                    const info = this.parsePrebuildLogUrl(firstUrl);
                    if (!info) {
                        throw new ApplicationError(ErrorCodes.PRECONDITION_FAILED, "cannot parse prebuild log info");
                    }
                    const downloadUrl =
                        info.type === "completed"
                            ? await this.workspaceService.getHeadlessLogDownloadUrl(
                                  userId,
                                  info.instanceId,
                                  info.taskId,
                              )
                            : undefined;

                    const it = generateAsyncGenerator<string>(
                        (sink) => {
                            try {
                                if (info.type === "running") {
                                    this.workspaceService
                                        .streamWorkspaceLogs(userId, info.instanceId, info.terminalId, async (msg) =>
                                            sink.push(msg),
                                        )
                                        .then(() => {
                                            sink.stop();
                                        })
                                        .catch((err) => {
                                            console.debug("error streaming running headless logs", err);
                                            throw new ApplicationError(
                                                ErrorCodes.INTERNAL_SERVER_ERROR,
                                                "error streaming running headless logs",
                                            );
                                        });
                                    return () => {};
                                } else {
                                    if (!downloadUrl) {
                                        throw new ApplicationError(
                                            ErrorCodes.PRECONDITION_FAILED,
                                            "cannot fetch prebuild log",
                                        );
                                    }
                                    const cancel = onDownloadPrebuildLogsUrl(
                                        downloadUrl,
                                        (msg: string) => sink.push(msg),
                                        {
                                            includeCredentials: false,
                                            maxBackoffTimes: 3,
                                        },
                                    );
                                    return () => {
                                        cancel();
                                    };
                                }
                            } catch (e) {
                                if (e instanceof Error) {
                                    sink.fail(e);
                                    return;
                                } else {
                                    sink.fail(new Error(String(e) || "unknown"));
                                }
                            }
                        },
                        { signal: ctxSignal() },
                    );

                    for await (const message of it) {
                        yield new WatchPrebuildLogsResponse({
                            message,
                        });
                    }
                    // we don't care the case phase updates from `running` to `stopped` because their logs are the same
                    // this may cause some logs lost, but better than duplicate?
                    return;
                }
                case WorkspacePhase_Phase.INTERRUPTED: {
                    return;
                }
                default: {
                    break;
                }
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
