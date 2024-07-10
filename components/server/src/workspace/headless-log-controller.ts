/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import express from "express";
import {
    HEADLESS_LOG_STREAM_STATUS_CODE,
    Queue,
    TeamMemberInfo,
    User,
    Workspace,
    WorkspaceImageBuild,
    WorkspaceInstance,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    CompositeResourceAccessGuard,
    OwnerResourceGuard,
    TeamMemberResourceGuard,
    RepositoryResourceGuard,
    FGAResourceAccessGuard,
    ResourceAccessGuard,
} from "../auth/resource-access";
import { DBWithTracing, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib/traced-db";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { TeamDB } from "@gitpod/gitpod-db/lib/team-db";
import {
    HEADLESS_LOGS_PATH_PREFIX,
    HEADLESS_LOG_DOWNLOAD_PATH_PREFIX,
    PREBUILD_LOGS_PATH_PREFIX,
} from "./headless-log-service";
import * as opentracing from "opentracing";
import { asyncHandler } from "../express-util";
import { isWithFunctionAccessGuard } from "../auth/function-access";
import { accessHeadlessLogs } from "../auth/rate-limiter";
import { BearerAuth } from "../auth/bearer-authenticator";
import { ProjectsService } from "../projects/projects-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { WorkspaceService } from "./workspace-service";
import { ctxIsAborted, ctxTrySubjectId, runWithSubSignal, runWithSubjectId } from "../util/request-context";
import { SubjectId } from "../auth/subject-id";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { validate as uuidValidate } from "uuid";
import { getPrebuildErrorMessage } from "@gitpod/public-api-common/lib/prebuild-utils";

@injectable()
export class HeadlessLogController {
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(BearerAuth) protected readonly auth: BearerAuth;
    @inject(ProjectsService) protected readonly projectService: ProjectsService;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;

    get headlessLogs(): express.Router {
        const router = express.Router();

        router.use(this.auth.restHandlerOptionally);
        router.get("/:instanceId/:terminalId", [
            authenticateAndAuthorize,
            asyncHandler(async (req: express.Request, res: express.Response) => {
                const span = opentracing.globalTracer().startSpan(HEADLESS_LOGS_PATH_PREFIX);
                const user = req.user as User; // verified by authenticateAndAuthorize
                await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                    try {
                        const instanceId = req.params.instanceId;
                        const terminalId = req.params.terminalId;

                        const logCtx = { userId: user.id, instanceId };
                        try {
                            const head = {
                                "Content-Type": "text/html; charset=utf-8", // is text/plain, but with that node.js won't stream...
                                "Transfer-Encoding": "chunked",
                                "Cache-Control": "no-cache, no-store, must-revalidate", // make sure stream are not re-used on reconnect
                            };
                            res.writeHead(200, head);

                            const queue = new Queue(); // Make sure we forward in the correct order
                            const writeToResponse = async (chunk: string) =>
                                queue.enqueue(
                                    () =>
                                        new Promise<void>(async (resolve, reject) => {
                                            if (ctxIsAborted()) {
                                                return;
                                            }

                                            const done = res.write(chunk, "utf-8", (err?: Error | null) => {
                                                if (err) {
                                                    reject(err); // propagate write error to upstream
                                                    return;
                                                }
                                            });
                                            // handle as per doc: https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback
                                            if (!done) {
                                                res.once("drain", resolve);
                                            } else {
                                                setImmediate(resolve);
                                            }
                                        }),
                                );
                            await this.workspaceService.streamWorkspaceLogs(
                                user.id,
                                instanceId,
                                { terminalId },
                                writeToResponse,
                                async () => {
                                    const ws = await this.authorizeHeadlessLogAccess(span, user, instanceId, res);
                                    if (!ws) {
                                        throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "permission denied");
                                    }
                                },
                            );

                            // In an ideal world, we'd use res.addTrailers()/response.trailer here. But despite being introduced with HTTP/1.1 in 1999, trailers are not supported by popular proxies (nginx, for example).
                            // So we resort to this hand-written solution
                            res.write(`\n${HEADLESS_LOG_STREAM_STATUS_CODE}: 200`);

                            res.end();
                        } catch (err) {
                            log.debug(logCtx, "error streaming headless logs", err);

                            res.write(`\n${HEADLESS_LOG_STREAM_STATUS_CODE}: 500`);
                            res.end();
                        }
                    } catch (e) {
                        TraceContext.setError({ span }, e);
                        throw e;
                    } finally {
                        span.finish();
                    }
                });
            }),
        ]);
        router.get("/", malformedRequestHandler);
        return router;
    }

    get headlessLogDownload(): express.Router {
        const router = express.Router();

        router.use(this.auth.restHandlerOptionally);
        router.get("/:instanceId/:taskId", [
            authenticateAndAuthorize,
            asyncHandler(async (req: express.Request, res: express.Response) => {
                const span = opentracing.globalTracer().startSpan(HEADLESS_LOG_DOWNLOAD_PATH_PREFIX);

                const user = req.user as User; // verified by authenticateAndAuthorize
                await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                    try {
                        const instanceId = req.params.instanceId;
                        const taskId = req.params.taskId;
                        try {
                            const downloadUrl = await this.workspaceService.getHeadlessLogDownloadUrl(
                                user.id,
                                instanceId,
                                taskId,
                                async () => {
                                    const ws = await this.authorizeHeadlessLogAccess(span, user, instanceId, res);
                                    if (!ws) {
                                        throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "permission denied");
                                    }
                                },
                            );
                            res.send(downloadUrl); // cmp. headless_log_download.go
                        } catch (err) {
                            log.error(
                                { userId: user.id, instanceId },
                                "error retrieving headless log download URL",
                                err,
                            );
                            res.status(500);
                        }
                    } catch (e) {
                        TraceContext.setError({ span }, e);
                        throw e;
                    } finally {
                        span.finish();
                    }
                });
            }),
        ]);
        router.get("/", malformedRequestHandler);
        return router;
    }

    get prebuildLogs(): express.Router {
        const router = express.Router();

        router.use(this.auth.restHandlerOptionally);
        router.get("/:workspaceId/image-build", [
            authenticateAndAuthorize,
            asyncHandler(async (req: express.Request, res: express.Response) => {
                const span = opentracing.globalTracer().startSpan(HEADLESS_LOGS_PATH_PREFIX);
                const user = req.user as User;

                await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                    const { workspaceId } = req.params;
                    const subjectId = ctxTrySubjectId();
                    if (!subjectId) {
                        res.status(403).send("unauthorized");
                        return;
                    }

                    const logCtx = { userId: user.id, workspaceId };
                    const head = {
                        "Content-Type": "text/html; charset=utf-8", // is text/plain, but with that node.js won't stream...
                        "Transfer-Encoding": "chunked",
                        "Cache-Control": "no-cache, no-store, must-revalidate", // make sure stream are not re-used on reconnect
                    };
                    res.writeHead(200, head);

                    let hasWritten = false;

                    const abortController = new AbortController();
                    const queue = new Queue(); // Make sure we forward in the correct order
                    const writeToResponse = async (chunk: string) =>
                        queue.enqueue(
                            () =>
                                new Promise<void>((resolve) => {
                                    if (ctxIsAborted()) {
                                        return;
                                    }
                                    const done = res.write(chunk, "utf-8", (err?: Error | null) => {
                                        if (err) {
                                            // we don't reject in current promise to avoid floating error throws
                                            abortController.abort("Failed to write chunk");
                                            return;
                                        }
                                    });
                                    hasWritten = true;

                                    if (!done) {
                                        res.once("drain", resolve);
                                    } else {
                                        setImmediate(resolve);
                                    }
                                }),
                        );

                    const client = {
                        onWorkspaceImageBuildLogs: async (
                            _info: WorkspaceImageBuild.StateInfo,
                            content?: WorkspaceImageBuild.LogContent,
                        ) => {
                            if (!content) return;

                            await writeToResponse(content.text);
                        },
                    };

                    try {
                        await runWithSubSignal(abortController, async () => {
                            await this.workspaceService.watchWorkspaceImageBuildLogs(user.id, workspaceId, client);
                        });
                    } catch (e) {
                        log.error(logCtx, "error streaming headless logs", e);
                        TraceContext.setError({ span }, e);
                        await writeToResponse(getPrebuildErrorMessage(e)).catch(() => {});
                    } finally {
                        if (!hasWritten) {
                            res.write(
                                getPrebuildErrorMessage(
                                    new ApplicationError(ErrorCodes.NOT_FOUND, "No image build logs found"),
                                ),
                            );
                        }

                        span.finish();
                        res.end();
                    }
                });
            }),
        ]);
        router.get("/:prebuildId/:taskId?", [
            authenticateAndAuthorize,
            asyncHandler(async (req: express.Request, res: express.Response) => {
                const span = opentracing.globalTracer().startSpan(PREBUILD_LOGS_PATH_PREFIX);
                const user = req.user as User; // verified by authenticateAndAuthorize

                await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                    // ensure fga migration
                    const subjectId = ctxTrySubjectId();
                    if (!subjectId) {
                        res.status(403).send("unauthorized");
                        return;
                    }

                    const prebuildId = req.params.prebuildId;
                    if (!uuidValidate(prebuildId)) {
                        res.status(400).send("prebuildId is invalid");
                        return;
                    }
                    const { taskId } = req.params;
                    const logCtx = { userId: user.id, prebuildId, taskId };

                    let firstChunk = true;
                    const abortController = new AbortController();
                    const queue = new Queue(); // Make sure we forward in the correct order
                    const writeToResponse = async (chunk: string) =>
                        queue.enqueue(
                            () =>
                                new Promise<void>((resolve) => {
                                    if (ctxIsAborted()) {
                                        return;
                                    }
                                    if (firstChunk) {
                                        firstChunk = false;
                                        const head = {
                                            "Content-Type": "text/html; charset=utf-8", // is text/plain, but with that node.js won't stream...
                                            "Transfer-Encoding": "chunked",
                                            "Cache-Control": "no-cache, no-store, must-revalidate", // make sure stream are not re-used on reconnect
                                        };
                                        res.writeHead(200, head);
                                    }

                                    const done = res.write(chunk, "utf-8", (err?: Error | null) => {
                                        if (err) {
                                            // we don't reject in current promise to avoid floating error throws
                                            abortController.abort("Failed to write chunk");
                                            return;
                                        }
                                    });
                                    if (!done) {
                                        res.once("drain", resolve);
                                    } else {
                                        setImmediate(resolve);
                                    }
                                }),
                        );
                    try {
                        const redirect = await runWithSubSignal(abortController, async () => {
                            return await this.prebuildManager.watchPrebuildLogs(
                                user.id,
                                prebuildId,
                                taskId,
                                writeToResponse,
                            );
                        });
                        if (redirect) {
                            res.redirect(302, redirect.taskUrl);
                            return;
                        }

                        // In an ideal world, we'd use res.addTrailers()/response.trailer here. But despite being introduced with HTTP/1.1 in 1999, trailers are not supported by popular proxies (nginx, for example).
                        // So we resort to this hand-written solution
                        res.write(`\n${HEADLESS_LOG_STREAM_STATUS_CODE}: 200`);
                    } catch (e) {
                        log.error(logCtx, "error streaming headless logs", e);
                        TraceContext.setError({ span }, e);
                        await writeToResponse(getPrebuildErrorMessage(e)).catch(() => {});
                    } finally {
                        span.finish();
                        res.end();
                    }
                });
            }),
        ]);
        router.get("/", malformedRequestHandler);
        return router;
    }

    protected async authorizeHeadlessLogAccess(
        span: opentracing.Span,
        user: User,
        instanceId: string,
        res: express.Response,
    ): Promise<{ workspace: Workspace; instance: WorkspaceInstance } | undefined> {
        const [workspace, instance] = await Promise.all([
            this.workspaceDb.trace({ span }).findByInstanceId(instanceId),
            this.workspaceDb.trace({ span }).findInstanceById(instanceId),
        ]);
        if (!workspace) {
            res.sendStatus(404);
            log.warn(`workspace for instanceId ${instanceId} not found`);
            return undefined;
        }
        if (!instance) {
            res.sendStatus(404);
            log.warn(`instance ${instanceId} not found`);
            return undefined;
        }
        const logCtx = { userId: user.id, instanceId, workspaceId: workspace.id };

        let teamMembers: TeamMemberInfo[] = [];
        if (workspace?.projectId) {
            const p = await ApplicationError.notFoundToUndefined(
                this.projectService.getProject(user.id, workspace.projectId),
            );
            if (p?.teamId) {
                teamMembers = await this.teamDb.findMembersByTeam(p.teamId);
            }
        }

        // [gpl] It's a bit sad that we have to duplicate this access check... but that's due to the way our API code is written
        let resourceGuard: ResourceAccessGuard = new CompositeResourceAccessGuard([
            new OwnerResourceGuard(user.id),
            new TeamMemberResourceGuard(user.id),
            new RepositoryResourceGuard(user, this.hostContextProvider),
        ]);
        resourceGuard = new FGAResourceAccessGuard(user.id, resourceGuard);
        if (!(await resourceGuard.canAccess({ kind: "workspaceLog", subject: workspace, teamMembers }, "get"))) {
            res.sendStatus(403);
            log.warn(logCtx, "unauthenticated headless log access");
            return undefined;
        }

        return { workspace, instance };
    }
}

function authenticateAndAuthorize(req: express.Request, res: express.Response, next: express.NextFunction) {
    const params = { instanceId: req.params.instanceId, terminalId: req.params.terminalId };
    if (
        !(isWithFunctionAccessGuard(req) && req.functionGuard?.canAccess(accessHeadlessLogs)) &&
        !(req.isAuthenticated() && User.is(req.user))
    ) {
        res.sendStatus(403);
        log.warn("unauthenticated headless log request", params);
        return;
    }

    const user = req.user as User;
    if (!User.is(user)) {
        res.sendStatus(401);
        return;
    }
    if (user.blocked) {
        res.sendStatus(403);
        log.warn("blocked user attempted to access headless log", { ...params, userId: user.id });
        return;
    }

    next();
}

function malformedRequestHandler(req: express.Request, res: express.Response) {
    // This is an error case: every request should match the handler above
    const user = req.user as User;
    if (!User.is(user)) {
        res.sendStatus(401);
        return;
    }
    if (user.blocked) {
        res.sendStatus(403);
        return;
    }

    log.error({ userId: user.id }, "malformed request", { path: req.path });
    res.status(400);
}
