/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import React, { Suspense, useEffect, useState } from "react";
import {
    WorkspaceInstance,
    DisposableCollection,
    WorkspaceImageBuild,
    HEADLESS_LOG_STREAM_STATUS_CODE_REGEX,
    Disposable,
    PrebuildWithStatus,
} from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";
import { PrebuildStatus } from "../projects/Prebuilds";

const WorkspaceLogs = React.lazy(() => import("./WorkspaceLogs"));

export interface PrebuildLogsProps {
    // The workspace ID of the "prebuild" workspace
    workspaceId: string | undefined;
    onIgnorePrebuild?: () => void;
    children?: React.ReactNode;
}

export default function PrebuildLogs(props: PrebuildLogsProps) {
    const [workspaceInstance, setWorkspaceInstance] = useState<WorkspaceInstance | undefined>();
    const [error, setError] = useState<Error | undefined>();
    const [logsEmitter] = useState(new EventEmitter());
    const [prebuild, setPrebuild] = useState<PrebuildWithStatus | undefined>();

    function handlePrebuildUpdate(prebuild: PrebuildWithStatus) {
        if (prebuild.info.buildWorkspaceId === props.workspaceId) {
            setPrebuild(prebuild);

            // In case the Prebuild got "aborted" or "time(d)out" we want to user to proceed anyway
            if (props.onIgnorePrebuild && (prebuild.status === "aborted" || prebuild.status === "timeout")) {
                props.onIgnorePrebuild();
            }
            // TODO(gpl) We likely want to move the "happy path" logic (for status "available")
            // here as well at some point. For that to work we need a "registerPrebuildUpdate(prebuildId)" API
        }
    }

    useEffect(() => {
        const disposables = new DisposableCollection();
        (async () => {
            if (!props.workspaceId) {
                return;
            }
            setWorkspaceInstance(undefined);
            setPrebuild(undefined);

            // Try get hold of a recent WorkspaceInfo
            try {
                const info = await getGitpodService().server.getWorkspace(props.workspaceId);
                setWorkspaceInstance(info?.latestInstance);
            } catch (err) {
                console.error(err);
                setError(err);
            }

            // Try get hold of a recent Prebuild
            try {
                const pbws = await getGitpodService().server.findPrebuildByWorkspaceID(props.workspaceId);
                if (pbws) {
                    const foundPrebuild = await getGitpodService().server.getPrebuild(pbws.id);
                    if (foundPrebuild) {
                        handlePrebuildUpdate(foundPrebuild);
                    }
                }
            } catch (err) {
                console.error(err);
                setError(err);
            }

            // Register for future updates
            disposables.push(
                getGitpodService().registerClient({
                    onInstanceUpdate: (instance) => {
                        if (props.workspaceId === instance.workspaceId) {
                            setWorkspaceInstance(instance);
                        }
                    },
                    onWorkspaceImageBuildLogs: (
                        info: WorkspaceImageBuild.StateInfo,
                        content?: WorkspaceImageBuild.LogContent,
                    ) => {
                        if (!content) {
                            return;
                        }
                        logsEmitter.emit("logs", content.text);
                    },
                    onPrebuildUpdate(update: PrebuildWithStatus) {
                        if (update.info) {
                            handlePrebuildUpdate(update);
                        }
                    },
                }),
            );
        })();
        return function cleanup() {
            disposables.dispose();
        };
    }, [logsEmitter, props.workspaceId]);

    useEffect(() => {
        const workspaceId = props.workspaceId;
        if (!workspaceId || !workspaceInstance?.status.phase) {
            return;
        }

        const disposables = new DisposableCollection();
        switch (workspaceInstance.status.phase) {
            // "building" means we're building the Docker image for the prebuild's workspace so the workspace hasn't started yet.
            case "building":
                // Try to grab image build logs
                disposables.push(retryWatchWorkspaceImageBuildLogs(workspaceId));
                break;
            // When we're "running" we want to switch to the logs from the actual prebuild workspace, instead
            // When the prebuild has "stopped", we still want to go for the logs
            case "running":
            case "stopped":
                disposables.push(
                    watchHeadlessLogs(
                        workspaceInstance.id,
                        (chunk) => {
                            logsEmitter.emit("logs", chunk);
                        },
                        async () => false,
                    ),
                );
        }
        return function cleanup() {
            disposables.dispose();
        };
    }, [logsEmitter, props.workspaceId, workspaceInstance?.id, workspaceInstance?.status.phase]);

    return (
        <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex flex-col mb-8">
            <div className="h-96 flex">
                <Suspense fallback={<div />}>
                    <WorkspaceLogs classes="h-full w-full" logsEmitter={logsEmitter} errorMessage={error?.message} />
                </Suspense>
            </div>
            <div className="w-full bottom-0 h-20 px-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex space-x-2">
                {prebuild && <PrebuildStatus prebuild={prebuild} />}
                <div className="flex-grow" />
                {props.children}
            </div>
        </div>
    );
}

function retryWatchWorkspaceImageBuildLogs(workspaceId: string): Disposable {
    let abortImageLogs = false;
    (async () => {
        // Linear backoff + abort for re-trying fetching of imagebuild logs
        const initialDelaySeconds = 1;
        const backoffFactor = 1.2;
        const maxBackoffSeconds = 5;
        let delayInSeconds = initialDelaySeconds;

        while (true) {
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

function watchHeadlessLogs(
    instanceId: string,
    onLog: (chunk: string) => void,
    checkIsDone: () => Promise<boolean>,
): DisposableCollection {
    const disposables = new DisposableCollection();

    // initializing non-empty here to use this as a stopping signal for the retries down below
    disposables.push(Disposable.NULL);

    // retry configuration goes here
    const initialDelaySeconds = 1;
    const backoffFactor = 1.2;
    const maxBackoffSeconds = 5;
    let delayInSeconds = initialDelaySeconds;

    const startWatchingLogs = async () => {
        if (await checkIsDone()) {
            return;
        }

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
                            throw new StreamError(code);
                        }
                    }
                } else {
                    onLog(msg);
                }

                chunk = await reader.read();
            }
            reader.cancel();

            if (await checkIsDone()) {
                return;
            }
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

class StreamError extends Error {
    constructor(readonly code?: number) {
        super(`stream status code: ${code}`);
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
