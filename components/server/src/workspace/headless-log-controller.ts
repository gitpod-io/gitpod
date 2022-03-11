/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import * as express from 'express';
import { HEADLESS_LOG_STREAM_STATUS_CODE, Queue, TeamMemberInfo, User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { CompositeResourceAccessGuard, OwnerResourceGuard, TeamMemberResourceGuard, RepositoryResourceGuard } from "../auth/resource-access";
import { DBWithTracing, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib/traced-db";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { TeamDB } from "@gitpod/gitpod-db/lib/team-db";
import { HeadlessLogService, HeadlessLogEndpoint } from "./headless-log-service";
import * as opentracing from 'opentracing';
import { asyncHandler } from "../express-util";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { isWithFunctionAccessGuard } from "../auth/function-access";
import { accessHeadlessLogs } from "../auth/rate-limiter";
import { BearerAuth } from "../auth/bearer-authenticator";
import { ProjectsService } from "../projects/projects-service";
import { HostContextProvider } from "../auth/host-context-provider";

export const HEADLESS_LOGS_PATH_PREFIX = "/headless-logs";
export const HEADLESS_LOG_DOWNLOAD_PATH_PREFIX = "/headless-log-download";

@injectable()
export class HeadlessLogController {

    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(HeadlessLogService) protected readonly headlessLogService: HeadlessLogService;
    @inject(BearerAuth) protected readonly auth: BearerAuth;
    @inject(ProjectsService) protected readonly projectService: ProjectsService;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    get headlessLogs(): express.Router {
        const router = express.Router();

        router.use(this.auth.restHandlerOptionally);
        router.get("/:instanceId/:taskID", [authenticateAndAuthorize, asyncHandler(async (req: express.Request, res: express.Response) => {
            const span = opentracing.globalTracer().startSpan(HEADLESS_LOGS_PATH_PREFIX);
            const params = { instanceId: req.params.instanceId, taskID: req.params.taskID };
            const user = req.user as User;  // verified by authenticateAndAuthorize

            const instanceId = params.instanceId;
            const ws = await this.authorizeHeadlessLogAccess(span, user, instanceId, res);
            if (!ws) {
                return;
            }
            const { workspace, instance } = ws;
            const logCtx = { userId: user.id, instanceId, workspaceId: workspace!.id };

            // Try to get it from the content service, if there's nothing there, try to stream.
            const tasks = await this.headlessLogService.supervisorListTasks(logCtx, HeadlessLogEndpoint.fromWithOwnerToken(instance))
            const task = tasks.filter(t => t.getId() == params.taskID)
            if (tasks.length == 0) {
                res.status(404)
                res.end()
            }


            log.debug(logCtx, HEADLESS_LOGS_PATH_PREFIX);

            const aborted = new Deferred<boolean>();
            try {
                const head = {
                    'Content-Type': 'text/html; charset=utf-8',  // is text/plain, but with that node.js won't stream...
                    'Transfer-Encoding': 'chunked',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',  // make sure stream are not re-used on reconnect
                };
                res.writeHead(200, head)

                const abort = (err: any) => {
                    aborted.resolve(true);
                    log.debug(logCtx, "headless-log: aborted");
                };
                req.on('abort', abort); // abort handling if the reqeuest was aborted

                const queue = new Queue();  // Make sure we forward in the correct order
                const writeToResponse = async (chunk: string) => queue.enqueue(() => new Promise<void>(async (resolve, reject) => {
                    if (aborted.isResolved && (await aborted.promise)) {
                        return;
                    }

                    const done = res.write(chunk, "utf-8", (err?: Error | null) => {
                        if (err) {
                            reject(err);    // propagate write error to upstream
                            return;
                        }
                    });
                    // handle as per doc: https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback
                    if (!done) {
                        res.once('drain', resolve);
                    } else {
                        setImmediate(resolve);
                    }
                }));
                const logEndpoint = HeadlessLogEndpoint.fromWithOwnerToken(instance);
                await this.headlessLogService.streamWorkspaceLogWhileRunning(logCtx, logEndpoint, instanceId, params.terminalId, writeToResponse, aborted);

                // In an ideal world, we'd use res.addTrailers()/response.trailer here. But despite being introduced with HTTP/1.1 in 1999, trailers are not supported by popular proxies (nginx, for example).
                // So we resort to this hand-written solution
                res.write(`\n${HEADLESS_LOG_STREAM_STATUS_CODE}: 200`);

                res.end();
            } catch (err) {
                log.debug(logCtx, "error streaming headless logs", err);

                res.write(`\n${HEADLESS_LOG_STREAM_STATUS_CODE}: 500`);
                res.end();
            } finally {
                aborted.resolve(true);  // ensure that the promise gets resolved eventually!
            }
        })]);
        router.get("/", malformedRequestHandler);
        return router;
    }

    get headlessLogDownload(): express.Router {
        const router = express.Router();

        router.use(this.auth.restHandlerOptionally);
        router.get("/:instanceId/:taskId", [authenticateAndAuthorize, asyncHandler(async (req: express.Request, res: express.Response) => {
            const span = opentracing.globalTracer().startSpan(HEADLESS_LOG_DOWNLOAD_PATH_PREFIX);
            const params = { instanceId: req.params.instanceId, taskId: req.params.taskId };
            const user = req.user as User;  // verified by authenticateAndAuthorize

            const instanceId = params.instanceId;
            const ws = await this.authorizeHeadlessLogAccess(span, user, instanceId, res);
            if (!ws) {
                return;
            }
            const { workspace, instance } = ws;

            const logCtx = { userId: user.id, instanceId, workspaceId: workspace!.id };
            log.debug(logCtx, HEADLESS_LOG_DOWNLOAD_PATH_PREFIX);

            try {
                const taskId = params.taskId;
                const downloadUrl = await this.headlessLogService.getHeadlessLogDownloadUrl(user.id, instance, workspace.ownerId, taskId);
                res.send(downloadUrl);  // cmp. headless_log_download.go
            } catch (err) {
                log.error(logCtx, "error retrieving headless log download URL", err);
                res.status(500);
            }
        })]);
        router.get("/", malformedRequestHandler);
        return router;
    }

    protected async authorizeHeadlessLogAccess(span: opentracing.Span, user: User, instanceId: string, res: express.Response): Promise<{ workspace: Workspace, instance: WorkspaceInstance } | undefined> {
        const [workspace, instance] = await Promise.all([
            this.workspaceDb.trace({span}).findByInstanceId(instanceId),
            this.workspaceDb.trace({span}).findInstanceById(instanceId),
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
            const p = await this.projectService.getProject(workspace.projectId);
            if (p?.teamId) {
                teamMembers = await this.teamDb.findMembersByTeam(p.teamId);
            }
        }

        // [gpl] It's a bit sad that we have to duplicate this access check... but that's due to the way our API code is written
        const resourceGuard = new CompositeResourceAccessGuard([
            new OwnerResourceGuard(user.id),
            new TeamMemberResourceGuard(user.id),
            new RepositoryResourceGuard(user, this.hostContextProvider),
        ]);
        if (!await resourceGuard.canAccess({ kind: 'workspaceLog', subject: workspace, teamMembers }, 'get')) {
            res.sendStatus(403);
            log.warn(logCtx, "unauthenticated headless log access");
            return undefined;
        }

        return { workspace, instance };
    }
}

function authenticateAndAuthorize(req: express.Request, res: express.Response, next: express.NextFunction) {
    const params = { instanceId: req.params.instanceId, terminalId: req.params.terminalId };
    if (!(isWithFunctionAccessGuard(req) && req.functionGuard?.canAccess(accessHeadlessLogs)) && !(req.isAuthenticated() && User.is(req.user))) {
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
