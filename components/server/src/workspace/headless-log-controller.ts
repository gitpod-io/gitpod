/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import * as express from 'express';
import { HEADLESS_LOG_STREAM_STATUS_CODE, Queue, TeamMemberInfo, User } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { CompositeResourceAccessGuard, OwnerResourceGuard, TeamMemberResourceGuard, WorkspaceLogAccessGuard } from "../auth/resource-access";
import { DBWithTracing, TracedWorkspaceDB } from "@gitpod/gitpod-db/lib/traced-db";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { TeamDB } from "@gitpod/gitpod-db/lib/team-db";
import { HeadlessLogService } from "./headless-log-service";
import * as opentracing from 'opentracing';
import { asyncHandler } from "../express-util";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { isWithFunctionAccessGuard } from "../auth/function-access";
import { accesHeadlessLogs } from "../auth/rate-limiter";
import { BearerAuth } from "../auth/bearer-authenticator";
import { ProjectsService } from "../projects/projects-service";
import { HostContextProvider } from "../auth/host-context-provider";


@injectable()
export class HeadlessLogController {

    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(HeadlessLogService) protected readonly headlessLogService: HeadlessLogService;
    @inject(BearerAuth) protected readonly auth: BearerAuth;
    @inject(ProjectsService) protected readonly projectService: ProjectsService;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    get apiRouter(): express.Router {
        const router = express.Router();

        router.use(this.auth.restHandlerOptionally);
        router.get("/:instanceId/:terminalId", asyncHandler(async (req: express.Request, res: express.Response) => {
            const span = opentracing.globalTracer().startSpan("/headless-logs/");
            const params = { instanceId: req.params.instanceId, terminalId: req.params.terminalId };
            if (!(isWithFunctionAccessGuard(req) && req.functionGuard?.canAccess(accesHeadlessLogs)) && !(req.isAuthenticated() && User.is(req.user))) {
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
                log.warn("blocked user attempted to fetch workspace cookie", { ...params, userId: user.id });
                return;
            }

            const instanceId = params.instanceId;
            const [workspace, instance] = await Promise.all([
                this.workspaceDb.trace({span}).findByInstanceId(instanceId),
                this.workspaceDb.trace({span}).findInstanceById(instanceId),
            ]);
            if (!workspace) {
                res.sendStatus(404);
                log.warn(`workspace for instanceId ${instanceId} not found`);
                return;
            }
            if (!instance) {
                res.sendStatus(404);
                log.warn(`instance ${instanceId} not found`);
                return;
            }
            let teamMembers: TeamMemberInfo[] = [];
            if (workspace?.projectId) {
                const p = await this.projectService.getProject(workspace.projectId);
                if (p?.teamId) {
                    teamMembers = await this.teamDb.findMembersByTeam(p.teamId);
                }
            }
            const logCtx = { userId: user.id, instanceId, workspaceId: workspace.id };
            log.debug(logCtx, "/headless-log/");
            log.debug("VERSION: " + req.httpVersion);

            try {
                // [gpl] It's a bit sad that we have to duplicate this access check... but that's due to the way our API code is written
                const resourceGuard = new CompositeResourceAccessGuard([
                    new OwnerResourceGuard(user.id),
                    new TeamMemberResourceGuard(user.id),
                    new WorkspaceLogAccessGuard(user, this.hostContextProvider),
                ]);
                if (!await resourceGuard.canAccess({ kind: 'workspace', subject: workspace, teamMembers }, 'get')) {
                    res.sendStatus(403);
                    log.warn(logCtx, "unauthenticated headless log access");
                    return;
                }

                const head = {
                    'Content-Type': 'text/html; charset=utf-8',  // is text/plain, but with that node.js won't stream...
                    'Transfer-Encoding': 'chunked',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',  // make sure stream are not re-used on reconnect
                };
                res.writeHead(200, head)

                const aborted = new Deferred<boolean>();
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
                        process.nextTick(resolve);
                    }
                }));
                await this.headlessLogService.streamWorkspaceLog(instance, params.terminalId, writeToResponse, aborted);

                // In an ideal world, we'd use res.addTrailers()/response.trailer here. But despite being introduced with HTTP/1.1 in 1999, trailers are not supported by popular proxies (nginx, for example).
                // So we resort to this hand-written solution
                res.write(`\n${HEADLESS_LOG_STREAM_STATUS_CODE}: 200`);

                res.end();
            } catch (err) {
                log.error(logCtx, "error streaming headless logs", err);

                res.write(`\n${HEADLESS_LOG_STREAM_STATUS_CODE}: 500`);
                res.end();
            }
        }));
        router.get("/", (req: express.Request, res: express.Response) => {
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

            log.error({ userId: user.id }, "/headless-logs: malformed request", { path: req.path });
            res.status(400);
        });
        return router;
    }
}