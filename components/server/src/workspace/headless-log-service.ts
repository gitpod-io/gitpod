/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { HeadlessLogUrls } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { inject, injectable } from "inversify";
import * as url from "url";
import { Status, StatusServiceClient } from "@gitpod/supervisor-api-grpcweb/lib/status_pb_service";
import {
    TasksStatusRequest,
    TasksStatusResponse,
    TaskState,
    TaskStatus,
} from "@gitpod/supervisor-api-grpcweb/lib/status_pb";
import { ResponseStream, TerminalServiceClient } from "@gitpod/supervisor-api-grpcweb/lib/terminal_pb_service";
import { ListenTerminalRequest, ListenTerminalResponse } from "@gitpod/supervisor-api-grpcweb/lib/terminal_pb";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import * as grpc from "@grpc/grpc-js";
import { Config } from "../config";
import * as browserHeaders from "browser-headers";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TextDecoder } from "util";
import { WebsocketTransport } from "../util/grpc-web-ws-transport";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import {
    ListLogsRequest,
    ListLogsResponse,
    LogDownloadURLRequest,
    LogDownloadURLResponse,
} from "@gitpod/content-service/lib/headless-log_pb";
import { HEADLESS_LOG_DOWNLOAD_PATH_PREFIX } from "./headless-log-controller";
import { CachingHeadlessLogServiceClientProvider } from "../util/content-service-sugar";

export type HeadlessLogEndpoint = {
    url: string;
    ownerToken?: string;
    headers?: { [key: string]: string };
};
export namespace HeadlessLogEndpoint {
    export function authHeaders(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
    ): browserHeaders.BrowserHeaders | undefined {
        const headers = new browserHeaders.BrowserHeaders(logEndpoint.headers);
        if (logEndpoint.ownerToken) {
            headers.set("x-gitpod-owner-token", logEndpoint.ownerToken);
        }

        if (Object.keys(headers.headersMap).length === 0) {
            log.warn(logCtx, "workspace logs: no ownerToken nor headers!");
            return undefined;
        }

        return headers;
    }
    export function fromWithOwnerToken(wsi: WorkspaceInstance): HeadlessLogEndpoint {
        return {
            url: wsi.ideUrl,
            ownerToken: wsi.status.ownerToken,
        };
    }
}

@injectable()
export class HeadlessLogService {
    static readonly SUPERVISOR_API_PATH = "/_supervisor/v1";

    @inject(WorkspaceDB) protected readonly db: WorkspaceDB;
    @inject(Config) protected readonly config: Config;
    @inject(CachingHeadlessLogServiceClientProvider)
    protected readonly headlessLogClientProvider: CachingHeadlessLogServiceClientProvider;

    public async getHeadlessLogURLs(
        logCtx: LogContext,
        wsi: WorkspaceInstance,
        ownerId: string,
        maxTimeoutSecs: number = 30,
    ): Promise<HeadlessLogUrls | undefined> {
        if (isSupervisorAvailableSoon(wsi)) {
            const logEndpoint = HeadlessLogEndpoint.fromWithOwnerToken(wsi);
            const aborted = new Deferred<boolean>();
            setTimeout(() => aborted.resolve(true), maxTimeoutSecs * 1000);
            const streamIds = await this.retryOnError(
                () => this.supervisorListHeadlessLogs(logCtx, wsi.id, logEndpoint),
                "list headless log streams",
                this.continueWhileRunning(wsi.id),
                aborted,
            );
            if (streamIds !== undefined) {
                return streamIds;
            }
        }

        // we were unable to get a repsonse from supervisor - let's try content service next
        return await this.contentServiceListLogs(wsi, ownerId);
    }

    protected async contentServiceListLogs(
        wsi: WorkspaceInstance,
        ownerId: string,
    ): Promise<HeadlessLogUrls | undefined> {
        const req = new ListLogsRequest();
        req.setOwnerId(ownerId);
        req.setWorkspaceId(wsi.workspaceId);
        req.setInstanceId(wsi.id);
        const response = await new Promise<ListLogsResponse>((resolve, reject) => {
            const client = this.headlessLogClientProvider.getDefault();
            client.listLogs(req, (err: grpc.ServiceError | null, response: ListLogsResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });

        // send client to proxy with plugin, which in turn calls getHeadlessLogDownloadUrl below and redirects to that Url
        const streams: { [id: string]: string } = {};
        for (const taskId of response.getTaskIdList()) {
            streams[taskId] = this.config.hostUrl
                .with({
                    pathname: `${HEADLESS_LOG_DOWNLOAD_PATH_PREFIX}/${wsi.id}/${taskId}`,
                })
                .toString();
        }
        return {
            streams,
        };
    }

    protected async supervisorListHeadlessLogs(
        logCtx: LogContext,
        instanceId: string,
        logEndpoint: HeadlessLogEndpoint,
    ): Promise<HeadlessLogUrls | undefined> {
        const tasks = await this.supervisorListTasks(logCtx, logEndpoint);
        return this.renderTasksHeadlessLogUrls(logCtx, instanceId, tasks);
    }

    protected async supervisorListTasks(logCtx: LogContext, logEndpoint: HeadlessLogEndpoint): Promise<TaskStatus[]> {
        if (logEndpoint.url === "") {
            // if ideUrl is not yet set we're too early and we deem the workspace not ready yet: retry later!
            throw new Error(`instance's ${logCtx.instanceId} has no ideUrl, yet`);
        }

        const tasks = await new Promise<TaskStatus[]>((resolve, reject) => {
            const client = new StatusServiceClient(toSupervisorURL(logEndpoint.url), {
                transport: WebsocketTransport(),
            });

            const req = new TasksStatusRequest(); // Note: Don't set observe here at all, else it won't work!
            const stream = client.tasksStatus(req, HeadlessLogEndpoint.authHeaders(logCtx, logEndpoint));
            stream.on("data", (resp: TasksStatusResponse) => {
                resolve(resp.getTasksList());
                stream.cancel();
            });
            stream.on("end", (status?: Status) => {
                if (status && status.code !== grpc.status.OK) {
                    const err = new Error(`upstream ended with status code: ${status.code}`);
                    (err as any).status = status;
                    reject(err);
                }
            });
        });
        return tasks;
    }

    protected renderTasksHeadlessLogUrls(logCtx: LogContext, instanceId: string, tasks: TaskStatus[]): HeadlessLogUrls {
        // render URLs that point to server's /headless-logs/ endpoint which forwards calls to the running workspaces's supervisor
        const streams: { [id: string]: string } = {};
        for (const task of tasks) {
            const taskId = task.getId();
            const terminalId = task.getTerminal();
            if (task.getState() === TaskState.OPENING) {
                // this might be the case when there is no terminal for this task, yet.
                // if we find any such case, we deem the workspace not ready yet, and try to reconnect later,
                // to be sure to get hold of all terminals created.
                throw new Error(`instance's ${instanceId} task ${task.getId()} has no terminal yet`);
            }
            if (task.getState() === TaskState.CLOSED) {
                // if a task has already been closed we can no longer access it's terminal, and have to skip it.
                continue;
            }
            streams[taskId] = this.config.hostUrl
                .with({
                    pathname: `/headless-logs/${instanceId}/${terminalId}`,
                })
                .toString();
        }
        return {
            streams,
        };
    }

    /**
     * Retrieves a download URL for the headless log from content-service
     *
     * @param userId
     * @param wsi
     * @param ownerId
     * @param taskId
     * @returns
     */
    async getHeadlessLogDownloadUrl(
        userId: string,
        wsi: WorkspaceInstance,
        ownerId: string,
        taskId: string,
    ): Promise<string | undefined> {
        try {
            return await new Promise<string>((resolve, reject) => {
                const req = new LogDownloadURLRequest();
                req.setOwnerId(ownerId);
                req.setWorkspaceId(wsi.workspaceId);
                req.setInstanceId(wsi.id);
                req.setTaskId(taskId);
                const client = this.headlessLogClientProvider.getDefault();
                client.logDownloadURL(req, (err: grpc.ServiceError | null, response: LogDownloadURLResponse) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response.getUrl());
                    }
                });
            });
        } catch (err) {
            log.debug(
                { userId, workspaceId: wsi.workspaceId, instanceId: wsi.id },
                "an error occurred retrieving a headless log download URL",
                err,
                { taskId },
            );
            return undefined;
        }
    }

    /**
     * For now, simply stream the supervisor data
     * @param logCtx
     * @param logEndpoint
     * @param instanceId
     * @param terminalID
     * @param sink
     * @param doContinue
     * @param aborted
     */
    async streamWorkspaceLogWhileRunning(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
        instanceId: string,
        terminalID: string,
        sink: (chunk: string) => Promise<void>,
        aborted: Deferred<boolean>,
    ): Promise<void> {
        await this.streamWorkspaceLog(
            logCtx,
            logEndpoint,
            terminalID,
            sink,
            this.continueWhileRunning(instanceId),
            aborted,
        );
    }

    /**
     * For now, simply stream the supervisor data
     * @param logCtx
     * @param logEndpoint
     * @param terminalID
     * @param sink
     * @param doContinue
     * @param aborted
     */
    protected async streamWorkspaceLog(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
        terminalID: string,
        sink: (chunk: string) => Promise<void>,
        doContinue: () => Promise<boolean>,
        aborted: Deferred<boolean>,
    ): Promise<void> {
        const client = new TerminalServiceClient(toSupervisorURL(logEndpoint.url), {
            transport: WebsocketTransport(), // necessary because HTTPTransport causes caching issues
        });
        const req = new ListenTerminalRequest();
        req.setAlias(terminalID);

        let receivedDataYet = false;
        let stream: ResponseStream<ListenTerminalResponse> | undefined = undefined;
        aborted.promise
            .then(() => stream?.cancel())
            .catch((err) => {
                /** ignore */
            });
        const doStream = (retry: (doRetry?: boolean) => void) =>
            new Promise<void>((resolve, reject) => {
                // [gpl] this is the very reason we cannot redirect the frontend to the supervisor URL: currently we only have ownerTokens for authentication
                const decoder = new TextDecoder("utf-8");
                stream = client.listen(req, HeadlessLogEndpoint.authHeaders(logCtx, logEndpoint));
                stream.on("data", (resp: ListenTerminalResponse) => {
                    receivedDataYet = true;

                    const raw = resp.getData();
                    const data: string = typeof raw === "string" ? raw : decoder.decode(raw);
                    sink(data).catch((err) => {
                        stream?.cancel(); // If downstream reports an error: cancel connection to upstream
                        log.debug(logCtx, "stream cancelled", err);
                    });
                });
                stream.on("end", (status?: Status) => {
                    if (!status || status.code === grpc.status.OK) {
                        resolve();
                        return;
                    }

                    const err = new Error(`upstream ended with status code: ${status.code}`);
                    (err as any).status = status;
                    if (!receivedDataYet && status.code === grpc.status.UNAVAILABLE) {
                        log.debug("stream headless workspace log", err);
                        reject(err);
                        return;
                    }

                    retry(false);
                    reject(err);
                });
            });
        await this.retryOnError(doStream, "stream workspace logs", doContinue, aborted);
    }

    /**
     * Streaming imagebuild logs is different to other headless workspaces (prebuilds) because we do not store them as "workspace" (incl. status, etc.), but have a special field "workspace.imageBuildInfo".
     * @param logCtx
     * @param logEndpoint
     * @param sink
     * @param aborted
     */
    async streamImageBuildLog(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
        sink: (chunk: string) => Promise<void>,
        aborted: Deferred<boolean>,
    ): Promise<void> {
        const tasks = await this.supervisorListTasks(logCtx, logEndpoint);
        if (tasks.length === 0) {
            throw new Error(`imagebuild logs: not tasks found for endpoint ${logEndpoint.url}!`);
        }

        // we're just looking at the first stream; image builds just have one stream atm
        const task = tasks[0];
        await this.streamWorkspaceLog(
            logCtx,
            logEndpoint,
            task.getTerminal(),
            sink,
            () => Promise.resolve(true),
            aborted,
        );
    }

    /**
     * Retries op while the passed WorkspaceInstance is still starting. Retries are stopped if either:
     *  - `op` calls `retry(false)` and an err is thrown, it is re-thrown by this method
     *  - `aborted` resolves to `true`: `undefined` is returned
     *  - `(await while()) === true`: `undefined` is returned
     * @param op
     * @param description
     * @param doContinue
     * @param aborted
     * @returns
     */
    protected async retryOnError<T>(
        op: (cancel: () => void) => Promise<T>,
        description: string,
        doContinue: () => Promise<boolean>,
        aborted: Deferred<boolean>,
    ): Promise<T | undefined> {
        let retry = true;
        const retryFunction = (doRetry: boolean = true) => {
            retry = doRetry;
        };

        while (retry && !(aborted.isResolved && (await aborted.promise))) {
            try {
                return await op(retryFunction);
            } catch (err) {
                if (!retry) {
                    throw err;
                }

                const shouldContinue = await doContinue();
                if (!shouldContinue) {
                    return undefined;
                }

                log.debug(`unable to ${description}, retrying...`, err);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
            }
        }
        return undefined;
    }

    protected continueWhileRunning(instanceId: string): () => Promise<boolean> {
        const db = this.db;
        return async () => {
            const maybeInstance = await db.findInstanceById(instanceId);
            return !!maybeInstance && isSupervisorAvailableSoon(maybeInstance);
        };
    }
}

function isSupervisorAvailableSoon(wsi: WorkspaceInstance): boolean {
    switch (wsi.status.phase) {
        case "creating":
        case "building":
        case "preparing":
        case "initializing":
        case "pending":
        case "running":
            return true;
        default:
            return false;
    }
}

function toSupervisorURL(ideUrl: string): string {
    const u = new url.URL(ideUrl);
    u.pathname = HeadlessLogService.SUPERVISOR_API_PATH;
    return u.toString();
}
