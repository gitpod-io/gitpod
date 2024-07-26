/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
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
import { ResponseStream } from "@gitpod/supervisor-api-grpcweb/lib/terminal_pb_service";
import { ListenToOutputRequest, ListenToOutputResponse } from "@gitpod/supervisor-api-grpcweb/lib/task_pb";
import { TaskServiceClient } from "@gitpod/supervisor-api-grpcweb/lib/task_pb_service";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import * as grpc from "@grpc/grpc-js";
import { Config } from "../config";
import * as browserHeaders from "browser-headers";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { WebsocketTransport } from "../util/grpc-web-ws-transport";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import {
    ListLogsRequest,
    ListLogsResponse,
    LogDownloadURLRequest,
    LogDownloadURLResponse,
} from "@gitpod/content-service/lib/headless-log_pb";
import { CachingHeadlessLogServiceClientProvider } from "../util/content-service-sugar";
import { ctxIsAborted, ctxOnAbort } from "../util/request-context";
import { PREBUILD_LOGS_PATH_PREFIX as PREBUILD_LOGS_PATH_PREFIX_common } from "@gitpod/public-api-common/lib/prebuild-utils";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export const HEADLESS_LOGS_PATH_PREFIX = "/headless-logs";
export const HEADLESS_LOG_DOWNLOAD_PATH_PREFIX = "/headless-log-download";
export const PREBUILD_LOGS_PATH_PREFIX = PREBUILD_LOGS_PATH_PREFIX_common;

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
                (cancel) => this.supervisorListHeadlessLogs(logCtx, wsi.id, logEndpoint, cancel),
                "list headless log streams",
                this.continueWhileRunning(wsi.id),
            );
            if (streamIds !== undefined) {
                return {
                    ...streamIds,
                    online: true,
                };
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
            online: false,
        };
    }

    protected async supervisorListHeadlessLogs(
        logCtx: LogContext,
        instanceId: string,
        logEndpoint: HeadlessLogEndpoint,
        cancel?: (retry: boolean) => void,
    ): Promise<HeadlessLogUrls | undefined> {
        const tasks = await this.supervisorListTasks(logCtx, logEndpoint, cancel);
        return this.renderTasksHeadlessLogUrls(logCtx, instanceId, tasks);
    }

    protected async supervisorListTasks(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
        cancel?: (retry: boolean) => void,
    ): Promise<TaskStatus[]> {
        if (logEndpoint.url === "") {
            // if ideUrl is not yet set we're too early and we deem the workspace not ready yet: retry later!
            cancel?.(false);
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
                throw new Error(`instance's ${instanceId} task ${taskId} has no terminal yet`);
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
    ): Promise<string> {
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
            log.error(
                { userId, workspaceId: wsi.workspaceId, instanceId: wsi.id },
                "an error occurred retrieving a headless log download URL",
                err,
                { taskId },
            );
            throw err;
        }
    }

    /**
     * For now, simply stream the supervisor data
     * @param logCtx
     * @param logEndpoint
     * @param instanceId
     * @param taskIdentifier
     * @param sink
     * @param doContinue
     * @param aborted
     */
    async streamWorkspaceLogWhileRunning(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
        instanceId: string,
        taskIdentifier: { terminalId: string } | { taskId: string },
        sink: (chunk: Uint8Array) => Promise<void>,
    ): Promise<void> {
        await this.streamWorkspaceLog(logCtx, logEndpoint, taskIdentifier, sink, this.continueWhileRunning(instanceId));
    }

    /**
     * For now, simply stream the supervisor data
     * @param logCtx
     * @param logEndpoint
     * @param taskIdentifier
     * @param sink
     * @param doContinue
     */
    protected async streamWorkspaceLog(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
        taskIdentifier: { terminalId: string } | { taskId: string },
        sink: (chunk: Uint8Array) => Promise<void>,
        doContinue: () => Promise<boolean>,
    ): Promise<void> {
        const taskClient = new TaskServiceClient(toSupervisorURL(logEndpoint.url), {
            transport: WebsocketTransport(), // necessary because HTTPTransport causes caching issues
        });

        let taskId: string;
        if ("terminalId" in taskIdentifier) {
            const terminalId = taskIdentifier.terminalId;
            const tasks = await this.supervisorListTasks(logCtx, logEndpoint);
            const taskIndex = tasks.findIndex((t) => t.getTerminal() === terminalId);
            if (taskIndex < 0) {
                log.warn(logCtx, "stream workspace logs: terminal not found", { terminalId, tasks });
                throw new ApplicationError(ErrorCodes.NOT_FOUND, "terminal not found");
            }
            taskId = taskIndex.toString();
        } else {
            taskId = taskIdentifier.taskId;
        }

        const req = new ListenToOutputRequest();
        req.setTaskId(taskId);

        const authHeaders = HeadlessLogEndpoint.authHeaders(logCtx, logEndpoint);

        let receivedDataYet = false;
        let stream: ResponseStream<ListenToOutputResponse> | undefined = undefined;
        ctxOnAbort(() => stream?.cancel());
        const doStream = (cancel: (retry: boolean) => void) =>
            new Promise<void>((resolve, reject) => {
                // [gpl] this is the very reason we cannot redirect the frontend to the supervisor URL: currently we only have ownerTokens for authentication
                const encoder = new TextEncoder();
                stream = taskClient.listenToOutput(req, authHeaders);
                stream.on("data", (resp: ListenToOutputResponse) => {
                    receivedDataYet = true;

                    const raw = resp.getData();
                    const data: Uint8Array = typeof raw === "string" ? encoder.encode(raw) : raw;
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

                    cancel(false);
                    reject(err);
                });
            });
        await this.retryOnError(doStream, "stream workspace logs", doContinue);
    }

    /**
     * Streaming imagebuild logs is different to other headless workspaces (prebuilds) because we do not store them as "workspace" (incl. status, etc.), but have a special field "workspace.imageBuildInfo".
     * @param logCtx
     * @param logEndpoint
     * @param sink
     */
    async streamImageBuildLog(
        logCtx: LogContext,
        logEndpoint: HeadlessLogEndpoint,
        sink: (chunk: Uint8Array) => Promise<void>,
    ): Promise<void> {
        const tasks = await this.supervisorListTasks(logCtx, logEndpoint);
        if (tasks.length === 0) {
            throw new Error(`imagebuild logs: not tasks found for endpoint ${logEndpoint.url}!`);
        }

        // we're just looking at the first stream; image builds just have one stream atm
        const task = tasks[0];
        await this.streamWorkspaceLog(logCtx, logEndpoint, { taskId: task.getId() }, sink, () => Promise.resolve(true));
    }

    /**
     * Retries op while the passed WorkspaceInstance is still starting. Retries are stopped if either:
     *  - `op` calls `retry(false)` and an err is thrown, it is re-thrown by this method
     *  - `aborted` resolves to `true`: `undefined` is returned
     *  - `(await while()) === true`: `undefined` is returned
     * @param op
     * @param description
     * @param doContinue
     * @returns
     */
    protected async retryOnError<T>(
        op: (cancel: (retry: boolean) => void) => Promise<T>,
        description: string,
        doContinue: () => Promise<boolean>,
    ): Promise<T | undefined> {
        let retry = true;
        const cancelFunction = (doRetry: boolean) => {
            retry = doRetry;
        };

        while (retry && !ctxIsAborted()) {
            try {
                return await op(cancelFunction);
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
