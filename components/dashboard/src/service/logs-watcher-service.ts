/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol/lib/util/disposable";
import { Emitter, Event } from "@gitpod/gitpod-protocol/lib/util/event";
import { getGitpodService } from "./service";
import { HEADLESS_LOG_STREAM_STATUS_CODE_REGEX, WorkspaceImageBuild } from "@gitpod/gitpod-protocol";
import { useEffect } from "react";
import { WorkspacePhase_Phase, WorkspaceStatus } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { watchWorkspaceStatus } from "../data/workspaces/listen-to-workspace-ws-messages";

export function useWorkspaceLogs(workspaceId: string | undefined): Event<string> {
    const logsWatcher = createJsonRpcWatcher(workspaceId);

    useEffect(() => {
        return () => logsWatcher.dispose();
    }, [workspaceId, logsWatcher]);

    return logsWatcher.onLogs;
}

interface LogsWatcher extends Disposable {
    readonly onLogs: Event<string>;
}

function createJsonRpcWatcher(workspaceId: string | undefined): LogsWatcher {
    if (!workspaceId) {
        return {
            onLogs: Event.None,
            dispose: () => {},
        };
    }
    const toDispose = new DisposableCollection();
    const onLogsEmitter = new Emitter<string>();
    toDispose.push(onLogsEmitter);

    let lastStatus: WorkspaceStatus | undefined = undefined;
    let toDisposeOnWorkspaceStatus = new DisposableCollection();
    const onWorkspaceStatus = (status: WorkspaceStatus | undefined) => {
        if (!status) {
            return;
        }
        if (lastStatus?.phase?.name === status.phase?.name && lastStatus?.statusVersion === status.statusVersion) {
            return;
        }
        lastStatus = status;
        toDisposeOnWorkspaceStatus.dispose();
        toDisposeOnWorkspaceStatus = new DisposableCollection();
        toDispose.push(toDisposeOnWorkspaceStatus);
        switch (status.phase?.name) {
            // "building" means we're building the Docker image for the prebuild's workspace so the workspace hasn't started yet.
            case WorkspacePhase_Phase.IMAGEBUILD:
                // Try to grab image build logs
                toDisposeOnWorkspaceStatus.push(retryWatchWorkspaceImageBuildLogs(workspaceId));
                break;
            // When we're "running" we want to switch to the logs from the actual prebuild workspace, instead
            // When the prebuild has "stopped", we still want to go for the logs
            case WorkspacePhase_Phase.RUNNING:
            case WorkspacePhase_Phase.STOPPED:
                toDisposeOnWorkspaceStatus.push(
                    watchHeadlessLogs(status.instanceId!, (chunk) => {
                        onLogsEmitter.fire(chunk);
                    }),
                );
        }
    };

    toDispose.push(watchWorkspaceStatus(workspaceId, (response) => onWorkspaceStatus(response?.status)));
    toDispose.push(
        getGitpodService().registerClient({
            onWorkspaceImageBuildLogs: (_: WorkspaceImageBuild.StateInfo, content?: WorkspaceImageBuild.LogContent) => {
                if (!content) {
                    return;
                }
                onLogsEmitter.fire(content.text);
            },
        }),
    );

    return {
        onLogs: onLogsEmitter.event,
        dispose: () => toDispose.dispose(),
    };
}

function retryWatchWorkspaceImageBuildLogs(workspaceId: string): Disposable {
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
                await getGitpodService().server.watchWorkspaceImageBuildLogs(workspaceId);
            } catch (err) {
                console.error("watchWorkspaceImageBuildLogs", err);
            }
        }
    })();
    return Disposable.create(() => {
        abortImageLogs = true;
    });
}

function watchHeadlessLogs(instanceId: string, onLog: (chunk: string) => void): DisposableCollection {
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
            const logSources = await getGitpodService().server.getHeadlessLog(instanceId);
            // TODO(gpl) Only listening on first stream for now
            const streamIds = Object.keys(logSources.streams);
            if (streamIds.length < 1) {
                await retryBackoff("no streams");
                return;
            }

            const streamUrl = logSources.streams[streamIds[0]];
            console.log("fetching from streamUrl: " + streamUrl);
            response = await fetch(streamUrl, {
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
                    onLog(msg);
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
