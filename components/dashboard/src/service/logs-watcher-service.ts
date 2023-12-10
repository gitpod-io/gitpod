/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol/lib/util/disposable";
import { Emitter, Event } from "@gitpod/gitpod-protocol/lib/util/event";
import { getGitpodService } from "./service";
import { HEADLESS_LOG_STREAM_STATUS_CODE_REGEX, WorkspaceImageBuild } from "@gitpod/gitpod-protocol";
import { useEffect, useMemo } from "react";
import { WorkspacePhase_Phase, WorkspaceStatus } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { watchWorkspaceStatus } from "../data/workspaces/listen-to-workspace-ws-messages";
import { isServiceEnabled } from "./public-api";

export function useWorkspaceLogs(workspaceId: string | undefined): Event<string> {
    const logsWatcher = useMemo(() => new FeatureFlaggedLogsWatcher(workspaceId), [workspaceId]);
    useEffect(() => {
        logsWatcher.watch();
        return () => logsWatcher.dispose();
    }, [logsWatcher]);
    return logsWatcher.onLogs;
}

interface LogsWatcher extends Disposable {
    readonly onLogs: Event<string>;
    watch(): void;
}

class FeatureFlaggedLogsWatcher implements LogsWatcher {
    protected readonly toDispose = new DisposableCollection();
    dispose(): void {
        this.toDispose.dispose();
    }

    protected readonly onLogsEmitter = new Emitter<string>();
    readonly onLogs = this.onLogsEmitter.event;

    constructor(protected readonly workspaceId: string | undefined) {}

    watch(): void {
        (async () => {
            const isEnabled = await isServiceEnabled("logs");
            if (this.toDispose.disposed) {
                return;
            }
            const watcher = isEnabled
                ? new GRPCLogsWatcher(this.workspaceId)
                : new JsonRpcLogsWatcher(this.workspaceId);
            this.toDispose.push(watcher.onLogs((log) => this.onLogsEmitter.fire(log)));
            this.toDispose.push(watcher);
            watcher.watch();
        })();
    }
}

abstract class AbstractLogsWatcher implements Disposable {
    protected readonly toDispose = new DisposableCollection();
    dispose(): void {
        this.toDispose.dispose();
    }

    protected readonly onLogsEmitter = new Emitter<string>();
    readonly onLogs = this.onLogsEmitter.event;

    constructor(protected readonly workspaceId: string | undefined) {
        this.toDispose.push(this.onLogsEmitter);
    }

    watch(): void {
        if (this.workspaceId) {
            return;
        }

        this.toDispose.push(
            watchWorkspaceStatus(this.workspaceId, (response) => {
                if (response.status) {
                    this.onWorkspaceStatus(response.status);
                }
            }),
        );
    }

    abstract onWorkspaceStatus(status: WorkspaceStatus | undefined): void;

    protected streamLogs(resolveLogsUrl: () => Promise<string>): DisposableCollection {
        const disposables = new DisposableCollection();

        // initializing non-empty here to use this as a stopping signal for the retries down below
        disposables.push(Disposable.NULL);

        // retry configuration goes here
        const initialDelaySeconds = 1;
        const backoffFactor = 1.2;
        const maxBackoffSeconds = 5;
        let delayInSeconds = initialDelaySeconds;

        const startWatchingLogs = async () => {
            const retryBackoff = async (reason: string, err?: Error) => {
                delayInSeconds = Math.min(delayInSeconds * backoffFactor, maxBackoffSeconds);

                console.debug("re-trying headless-logs because: " + reason, err);
                await new Promise((resolve) => {
                    setTimeout(resolve, delayInSeconds * 1000);
                });
                if (disposables.disposed) {
                    return; // and stop retrying
                }
                startWatchingLogs().catch(console.error);
            };

            let response: Response | undefined = undefined;
            let reader: ReadableStreamDefaultReader<Uint8Array> | undefined = undefined;
            try {
                const logsUrl = await resolveLogsUrl();
                if (logsUrl) {
                    await retryBackoff("no logs url");
                    return;
                }
                console.log("fetching from logs url: " + logsUrl);
                response = await fetch(logsUrl, {
                    method: "GET",
                    cache: "no-cache",
                    credentials: "include",
                    keepalive: true,
                    headers: {
                        TE: "trailers", // necessary to receive stream status code
                    },
                });
                reader = response.body?.getReader();
                if (!reader) {
                    await retryBackoff("no reader");
                    return;
                }
                disposables.push({ dispose: () => reader?.cancel() });

                const decoder = new TextDecoder("utf-8");
                let chunk = await reader.read();
                while (!chunk.done) {
                    const msg = decoder.decode(chunk.value, { stream: true });

                    // In an ideal world, we'd use res.addTrailers()/response.trailer here. But despite being introduced with HTTP/1.1 in 1999, trailers are not supported by popular proxies (nginx, for example).
                    // So we resort to this hand-written solution:
                    const matches = msg.match(HEADLESS_LOG_STREAM_STATUS_CODE_REGEX);
                    if (matches) {
                        if (matches.length < 2) {
                            console.debug("error parsing log stream status code. msg: " + msg);
                        } else {
                            const code = parseStatusCode(matches[1]);
                            if (code !== 200) {
                                throw new Error(`stream status code: ${code}`);
                            }
                        }
                    } else {
                        this.onLogsEmitter.fire(msg);
                    }

                    chunk = await reader.read();
                }
                reader.cancel();
            } catch (err) {
                reader?.cancel().catch(console.debug);
                if (err.code === 400) {
                    // sth is really off, and we _should not_ retry
                    console.error("stopped watching headless logs", err);
                    return;
                }
                await retryBackoff("error while listening to stream", err);
            }
        };
        startWatchingLogs().catch(console.error);

        return disposables;
    }
}

class GRPCLogsWatcher extends AbstractLogsWatcher {
    private status: WorkspaceStatus | undefined;
    private toDisposeOnWorkspaceStatus = new DisposableCollection();
    onWorkspaceStatus(status: WorkspaceStatus): void {
        if (this.status?.urls?.logs === status.urls?.logs) {
            return;
        }
        this.status = status;
        this.toDisposeOnWorkspaceStatus.dispose();
        this.toDisposeOnWorkspaceStatus = new DisposableCollection();
        this.toDispose.push(this.toDisposeOnWorkspaceStatus);
        if (status.urls?.logs) {
            this.toDisposeOnWorkspaceStatus.push(
                this.streamLogs(async () => {
                    return status.urls?.logs!;
                }),
            );
        }
    }
}

class JsonRpcLogsWatcher extends AbstractLogsWatcher {
    private status: WorkspaceStatus | undefined;
    private toDisposeOnWorkspaceStatus = new DisposableCollection();
    onWorkspaceStatus(status: WorkspaceStatus): void {
        if (this.status?.phase?.name === status.phase?.name && this.status?.statusVersion === status.statusVersion) {
            return;
        }
        this.status = status;
        this.toDisposeOnWorkspaceStatus.dispose();
        this.toDisposeOnWorkspaceStatus = new DisposableCollection();
        this.toDispose.push(this.toDisposeOnWorkspaceStatus);
        switch (status.phase?.name) {
            // "building" means we're building the Docker image for the prebuild's workspace so the workspace hasn't started yet.
            case WorkspacePhase_Phase.IMAGEBUILD:
                // Try to grab image build logs
                this.toDisposeOnWorkspaceStatus.push(this.retryWatchWorkspaceImageBuildLogs());
                break;
            // When we're "running" we want to switch to the logs from the actual prebuild workspace, instead
            // When the prebuild has "stopped", we still want to go for the logs
            case WorkspacePhase_Phase.RUNNING:
            case WorkspacePhase_Phase.STOPPED:
                this.toDisposeOnWorkspaceStatus.push(
                    this.streamLogs(async () => {
                        const logSources = await getGitpodService().server.getHeadlessLog(status.instanceId!);
                        const streamIds = Object.keys(logSources.streams);
                        if (streamIds.length < 1) {
                            return "";
                        }
                        return logSources.streams[streamIds[0]];
                    }),
                );
        }
    }

    watch(): void {
        super.watch();
        this.toDispose.push(
            getGitpodService().registerClient({
                onWorkspaceImageBuildLogs: (
                    _: WorkspaceImageBuild.StateInfo,
                    content?: WorkspaceImageBuild.LogContent,
                ) => {
                    if (!content) {
                        return;
                    }
                    this.onLogsEmitter.fire(content.text);
                },
            }),
        );
    }

    private retryWatchWorkspaceImageBuildLogs(): Disposable {
        let abortImageLogs = false;
        (async () => {
            // Linear backoff + abort for re-trying fetching of imagebuild logs
            const initialDelaySeconds = 1;
            const backoffFactor = 1.2;
            const maxBackoffSeconds = 5;
            let delayInSeconds = initialDelaySeconds;

            while (!abortImageLogs) {
                delayInSeconds = Math.min(delayInSeconds * backoffFactor, maxBackoffSeconds);

                console.debug("re-trying image build logs");
                // eslint-disable-next-line
                await new Promise((resolve) => {
                    setTimeout(resolve, delayInSeconds * 1000);
                });
                if (abortImageLogs) {
                    return;
                }
                try {
                    await getGitpodService().server.watchWorkspaceImageBuildLogs(this.workspaceId!);
                } catch (err) {
                    console.error("watchWorkspaceImageBuildLogs", err);
                }
            }
        })();
        return Disposable.create(() => {
            abortImageLogs = true;
        });
    }
}

function parseStatusCode(code: string | undefined): number | undefined {
    try {
        if (!code) {
            return undefined;
        }
        return Number.parseInt(code);
    } catch (err) {
        return undefined;
    }
}
