/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialMessage } from "@bufbuild/protobuf";
import { CallOptions, PromiseClient } from "@connectrpc/connect";
import { PrebuildService } from "@gitpod/public-api/lib/gitpod/v1/prebuild_connect";
import {
    StartPrebuildRequest,
    GetPrebuildRequest,
    ListPrebuildsRequest,
    WatchPrebuildRequest,
    StartPrebuildResponse,
    GetPrebuildResponse,
    ListPrebuildsResponse,
    WatchPrebuildResponse,
    CancelPrebuildRequest,
    CancelPrebuildResponse,
    ListOrganizationPrebuildsRequest,
    ListOrganizationPrebuildsResponse,
    WatchPrebuildLogsRequest,
    WatchPrebuildLogsResponse,
} from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { getGitpodService } from "./service";
import { converter } from "./public-api";
import { PrebuildWithStatus } from "@gitpod/gitpod-protocol";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { validate as uuidValidate } from "uuid";
import { onDownloadPrebuildLogsUrl } from "@gitpod/public-api-common/lib/prebuild-utils";
import { JsonRpcWorkspaceClient } from "./json-rpc-workspace-client";
import { WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

export class JsonRpcPrebuildClient implements PromiseClient<typeof PrebuildService> {
    constructor(private workspaceClient: JsonRpcWorkspaceClient) {}

    async startPrebuild(
        request: PartialMessage<StartPrebuildRequest>,
        options?: CallOptions,
    ): Promise<StartPrebuildResponse> {
        if (!request.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }
        const result = await getGitpodService().server.triggerPrebuild(request.configurationId, request.gitRef || null);
        return new StartPrebuildResponse({
            prebuildId: result.prebuildId,
        });
    }

    async cancelPrebuild(
        request: PartialMessage<CancelPrebuildRequest>,
        options?: CallOptions,
    ): Promise<CancelPrebuildResponse> {
        const response = await this.getPrebuild(request, options);
        await getGitpodService().server.cancelPrebuild(response.prebuild!.configurationId, response.prebuild!.id);
        return new CancelPrebuildResponse();
    }

    async getPrebuild(
        request: PartialMessage<GetPrebuildRequest>,
        options?: CallOptions,
    ): Promise<GetPrebuildResponse> {
        if (!request.prebuildId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "prebuildId is required");
        }
        const result = await getGitpodService().server.getPrebuild(request.prebuildId);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `prebuild ${request.prebuildId} not found`);
        }
        return new GetPrebuildResponse({
            prebuild: converter.toPrebuild(result),
        });
    }

    async listPrebuilds(
        request: PartialMessage<ListPrebuildsRequest>,
        options?: CallOptions,
    ): Promise<ListPrebuildsResponse> {
        if (request.workspaceId) {
            const pbws = await getGitpodService().server.findPrebuildByWorkspaceID(request.workspaceId);
            if (pbws) {
                const prebuild = await getGitpodService().server.getPrebuild(pbws.id);
                if (prebuild) {
                    return new ListPrebuildsResponse({
                        prebuilds: [converter.toPrebuild(prebuild)],
                    });
                }
            }
            return new ListPrebuildsResponse({
                prebuilds: [],
            });
        }
        if (!request.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }
        const result = await getGitpodService().server.findPrebuilds({
            projectId: request.configurationId,
            branch: request.gitRef || undefined,
            limit: request.pagination?.pageSize || undefined,
        });
        return new ListPrebuildsResponse({
            prebuilds: converter.toPrebuilds(result),
        });
    }

    async *watchPrebuild(
        request: PartialMessage<WatchPrebuildRequest>,
        options?: CallOptions,
    ): AsyncIterable<WatchPrebuildResponse> {
        if (!options?.signal) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "signal is required");
        }
        if (!request.scope?.value) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "scope is required");
        }
        if (request.scope.case === "prebuildId") {
            const prebuild = await this.getPrebuild({ prebuildId: request.scope.value }, options);
            yield new WatchPrebuildResponse({
                prebuild: prebuild.prebuild,
            });
        }
        const it = generateAsyncGenerator<PrebuildWithStatus>(
            (queue) => {
                try {
                    const dispose = getGitpodService().registerClient({
                        onPrebuildUpdate: (prebuild) => {
                            queue.push(prebuild);
                        },
                    });
                    return () => {
                        dispose.dispose();
                    };
                } catch (e) {
                    queue.fail(e);
                }
            },
            { signal: options.signal },
        );
        for await (const pb of it) {
            if (request.scope.case === "prebuildId") {
                if (pb.info.id !== request.scope.value) {
                    continue;
                }
            } else if (pb.info.projectId !== request.scope.value) {
                continue;
            }
            const prebuild = converter.toPrebuild(pb);
            if (prebuild) {
                yield new WatchPrebuildResponse({ prebuild });
            }
        }
    }

    private getWorkspaceImageBuildLogsIterator(signal: AbortSignal) {
        return generateAsyncGenerator<string>(
            (sink) => {
                try {
                    const dispose = getGitpodService().registerClient({
                        onWorkspaceImageBuildLogs: (info, content) => {
                            if (!content?.text) {
                                return;
                            }
                            sink.push(content.text);
                        },
                    });
                    return () => {
                        dispose.dispose();
                    };
                } catch (err) {
                    if (err instanceof Error) {
                        sink.fail(err);
                        return;
                    } else {
                        sink.fail(new Error(String(err) || "unknown"));
                    }
                }
            },
            { signal },
        );
    }

    async *watchPrebuildLogs(
        request: PartialMessage<WatchPrebuildLogsRequest>,
        options?: CallOptions | undefined,
    ): AsyncIterable<WatchPrebuildLogsResponse> {
        if (!request.prebuildId || !uuidValidate(request.prebuildId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "prebuildId is required");
        }
        const prebuild = await this.getPrebuild({ prebuildId: request.prebuildId });
        if (!prebuild.prebuild?.workspaceId) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "no build workspace found");
        }
        const wsInfoIt = this.workspaceClient.watchWorkspaceStatus(
            { workspaceId: prebuild.prebuild.workspaceId },
            options,
        );
        let hasImageBuild = false;
        for await (const wsInfo of wsInfoIt) {
            switch (wsInfo.status?.phase?.name) {
                case WorkspacePhase_Phase.IMAGEBUILD: {
                    if (hasImageBuild) {
                        break;
                    }
                    hasImageBuild = true;
                    const imageBuildControl = new AbortController();
                    if (options?.signal) {
                        options.signal.onabort = () => {
                            imageBuildControl.abort("parent signal is aborted");
                        };
                    }
                    getGitpodService()
                        .server.watchWorkspaceImageBuildLogs(prebuild.prebuild.workspaceId)
                        .then(() => {
                            imageBuildControl.abort("watch image build finished");
                        });
                    const it = this.getWorkspaceImageBuildLogsIterator(imageBuildControl.signal);
                    for await (const message of it) {
                        yield new WatchPrebuildLogsResponse({ message });
                    }
                    break;
                }
                case WorkspacePhase_Phase.RUNNING:
                case WorkspacePhase_Phase.STOPPED: {
                    const logSources = await getGitpodService().server.getHeadlessLog(wsInfo.status.instanceId);
                    // TODO: Only listening on first stream for now
                    const firstStreamUrl = Object.values(logSources.streams)[0];
                    if (!firstStreamUrl) {
                        throw new ApplicationError(ErrorCodes.PRECONDITION_FAILED, "cannot fetch prebuild log");
                    }
                    const it = generateAsyncGenerator<string>(
                        (sink) => {
                            try {
                                const cancel = onDownloadPrebuildLogsUrl(
                                    firstStreamUrl,
                                    (msg) => {
                                        sink.push(msg);
                                    },
                                    { includeCredentials: true, maxBackoffTimes: 3 },
                                );
                                return () => {
                                    cancel();
                                };
                            } catch (e) {
                                if (e instanceof Error) {
                                    sink.fail(e);
                                    return;
                                } else {
                                    sink.fail(new Error(String(e) || "unknown"));
                                }
                            }
                        },
                        { signal: options?.signal ?? new AbortSignal() },
                    );

                    for await (const message of it) {
                        yield new WatchPrebuildLogsResponse({ message });
                    }
                    // we don't care the case phase updates from `running` to `stopped` because their logs are the same
                    // this may cause some logs lost, but better than duplicate?
                    return;
                }
                case WorkspacePhase_Phase.INTERRUPTED: {
                    return;
                }
            }
        }
    }

    async listOrganizationPrebuilds(
        request: PartialMessage<ListOrganizationPrebuildsRequest>,
    ): Promise<ListOrganizationPrebuildsResponse> {
        throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "Not implemented (for jrpc)");
    }
}
