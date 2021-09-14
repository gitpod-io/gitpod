/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { HeadlessLogUrls } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { inject, injectable } from "inversify";
import * as url from "url";
import { Status, StatusServiceClient } from '@gitpod/supervisor-api-grpcweb/lib/status_pb_service'
import { TasksStatusRequest, TasksStatusResponse, TaskStatus } from "@gitpod/supervisor-api-grpcweb/lib/status_pb";
import { ResponseStream, TerminalServiceClient } from "@gitpod/supervisor-api-grpcweb/lib/terminal_pb_service";
import { ListenTerminalRequest, ListenTerminalResponse } from "@gitpod/supervisor-api-grpcweb/lib/terminal_pb";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import * as grpc from '@grpc/grpc-js';
import { Config } from "../config";
import * as browserHeaders from "browser-headers";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TextDecoder } from "util";
import { WebsocketTransport } from "../util/grpc-web-ws-transport";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { HeadlessLogServiceClient } from '@gitpod/content-service/lib/headless-log_grpc_pb';
import { ListLogsRequest, ListLogsResponse, LogDownloadURLRequest, LogDownloadURLResponse } from '@gitpod/content-service/lib/headless-log_pb';
import { HEADLESS_LOG_DOWNLOAD_PATH_PREFIX } from "./headless-log-controller";

@injectable()
export class HeadlessLogService {
    static readonly SUPERVISOR_API_PATH = "/_supervisor/v1";

    @inject(WorkspaceDB) protected readonly db: WorkspaceDB;
    @inject(Config) protected readonly config: Config;
    @inject(HeadlessLogServiceClient) protected readonly headlessLogClient: HeadlessLogServiceClient;

    public async getHeadlessLogURLs(userId: string, wsi: WorkspaceInstance, ownerId: string, maxTimeoutSecs: number = 30): Promise<HeadlessLogUrls | undefined> {
        if (isSupervisorAvailableSoon(wsi)) {
            const aborted = new Deferred<boolean>();
            setTimeout(() => aborted.resolve(true), maxTimeoutSecs * 1000);
            const streamIds = await this.retryWhileInstanceIsRunning(wsi, () => this.supervisorListHeadlessLogs(wsi), "list headless log streams", aborted);
            if (streamIds !== undefined) {
                return streamIds;
            }
        }

        // we were unable to get a repsonse from supervisor - let's try content service next
        return await this.contentServiceListLogs(userId, wsi, ownerId);
    }

    protected async contentServiceListLogs(userId: string, wsi: WorkspaceInstance, ownerId: string): Promise<HeadlessLogUrls | undefined> {
        const req = new ListLogsRequest();
        req.setOwnerId(ownerId);
        req.setWorkspaceId(wsi.workspaceId);
        req.setInstanceId(wsi.id);
        const response = await new Promise<ListLogsResponse>((resolve, reject) => {
            this.headlessLogClient.listLogs(req, (err: grpc.ServiceError | null, response: ListLogsResponse) => {
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
            streams[taskId] = this.config.hostUrl.with({
                pathname: `${HEADLESS_LOG_DOWNLOAD_PATH_PREFIX}/${wsi.id}/${taskId}`,
            }).toString();
        }
        return {
            streams
        };
    }

    protected async supervisorListHeadlessLogs(wsi: WorkspaceInstance): Promise<HeadlessLogUrls> {
        if (wsi.ideUrl === "") {
            // if ideUrl is not yet set we're too early and we deem the workspace not ready yet: retry later!
            throw new Error(`instance's ${wsi.id} has no ideUrl, yet`);
        }

        const tasks = await new Promise<TaskStatus[]>((resolve, reject) => {
            const client = new StatusServiceClient(toSupervisorURL(wsi.ideUrl), {
                transport: WebsocketTransport(),
            });

            const req = new TasksStatusRequest();   // Note: Don't set observe here at all, else it won't work!
            const stream = client.tasksStatus(req, authHeaders(wsi));
            stream.on('data', (resp: TasksStatusResponse) => {
                resolve(resp.getTasksList());
                stream.cancel();
            });
            stream.on('end', (status?: Status) => {
                if (status && status.code !== grpc.status.OK) {
                    const err = new Error(`upstream ended with status code: ${status.code}`);
                    (err as any).status = status;
                    reject(err);
                }
            });
        });

        // render URLs that point to server's /headless-logs/ endpoint which forwards calls to the running workspaces's supervisor
        const streams: { [id: string]: string } = {};
        for (const task of tasks) {
            const taskId = task.getId();
            const terminalId = task.getTerminal();
            if (terminalId === "") {
                // this might be the case when there is no terminal for this task, yet.
                // if we find any such case, we deem the workspace not ready yet, and try to reconnect later,
                // to be sure to get hold of all terminals created.
                throw new Error(`instance's ${wsi.id} task ${task.getId} has no terminal yet`);
            }
            streams[taskId] = this.config.hostUrl.with({
                pathname: `/headless-logs/${wsi.id}/${terminalId}`,
            }).toString();
        }
        return {
            streams
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
    async getHeadlessLogDownloadUrl(userId: string, wsi: WorkspaceInstance, ownerId: string, taskId: string): Promise<string | undefined> {
        try {
            return await new Promise<string>((resolve, reject) => {
                const req = new LogDownloadURLRequest();
                req.setOwnerId(ownerId);
                req.setWorkspaceId(wsi.workspaceId);
                req.setInstanceId(wsi.id);
                req.setTaskId(taskId);
                this.headlessLogClient.logDownloadURL(req, (err: grpc.ServiceError | null, response: LogDownloadURLResponse) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response.getUrl());
                    }
                });
            });
        } catch (err) {
            log.debug({ userId, workspaceId: wsi.workspaceId, instanceId: wsi.id }, "an error occurred retrieving a headless log download URL", err, { taskId });
            return undefined;
        }
    }

    /**
     * For now, simply stream the supervisor data
     *
     * @param workspace
     * @param terminalID
     */
    async streamWorkspaceLog(wsi: WorkspaceInstance, terminalID: string, sink: (chunk: string) => Promise<void>, aborted: Deferred<boolean>): Promise<void> {
        const client = new TerminalServiceClient(toSupervisorURL(wsi.ideUrl), {
            transport: WebsocketTransport(),    // necessary because HTTPTransport causes caching issues
        });
        const req = new ListenTerminalRequest();
        req.setAlias(terminalID);

        let receivedDataYet = false;
        let stream: ResponseStream<ListenTerminalResponse> | undefined = undefined;
        aborted.promise.then(() => stream?.cancel());
        const doStream = (cancelRetry: () => void) => new Promise<void>((resolve, reject) => {
            // [gpl] this is the very reason we cannot redirect the frontend to the supervisor URL: currently we only have ownerTokens for authentication
            const decoder = new TextDecoder('utf-8')
            stream = client.listen(req, authHeaders(wsi));
            stream.on('data', (resp: ListenTerminalResponse) => {
                receivedDataYet = true;

                const raw = resp.getData();
                const data: string = typeof raw === 'string' ? raw : decoder.decode(raw);
                sink(data)
                    .catch((err) => {
                        stream?.cancel();    // If downstream reports an error: cancel connection to upstream
                        log.debug({ instanceId: wsi.id }, "stream cancelled", err);
                    });
            });
            stream.on('end', (status?: Status) => {
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

                cancelRetry();
                reject(err);
            });
        });
        await this.retryWhileInstanceIsRunning(wsi, doStream, "stream workspace logs", aborted);
    }

    /**
     * Retries op while the passed WorkspaceInstance is still starting. Retries are stopped if either:
     *  - `op` calls `cancel()` and an err is thrown, it is re-thrown by this method
     *  - `aborted` resolves to `true`: `undefined` is returned
     *  - if the instance enters the either STOPPING/STOPPED phases, we stop retrying, and return `undefined`
     * @param wsi
     * @param op
     * @param description
     * @param aborted
     * @returns
     */
    protected async retryWhileInstanceIsRunning<T>(wsi: WorkspaceInstance, op: (cancel: () => void) => Promise<T>, description: string, aborted: Deferred<boolean>): Promise<T | undefined> {
        let cancelled = false;
        const cancel = () => { cancelled = true; };

        let instance = wsi;
        while (!cancelled && !(aborted.isResolved && (await aborted.promise)) ) {
            try {
                return await op(cancel);
            } catch (err) {
                if (cancelled) {
                    throw err;
                }

                log.debug(`unable to ${description}`, err);
                const maybeInstance = await this.db.findInstanceById(instance.id);
                if (!maybeInstance) {
                    return undefined;
                }
                instance = maybeInstance;

                if (!this.shouldRetry(instance)) {
                    return undefined;
                }
                log.debug(`re-trying ${description}...`);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                continue;
            }
        }
        return undefined;
    }

    protected shouldRetry(wsi: WorkspaceInstance): boolean {
        return isSupervisorAvailableSoon(wsi);
    }
}

function isSupervisorAvailableSoon(wsi: WorkspaceInstance): boolean {
    switch (wsi.status.phase) {
        case "creating":
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

function authHeaders(wsi: WorkspaceInstance): browserHeaders.BrowserHeaders | undefined {
    const ownerToken = wsi.status.ownerToken;
    if (!ownerToken) {
        log.warn({ instanceId: wsi.id }, "workspace logs: owner token not found");
        return undefined;
    }
    const headers = new browserHeaders.BrowserHeaders();
    headers.set("x-gitpod-owner-token", ownerToken);
    return headers;
}
