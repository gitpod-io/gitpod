/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useMemo } from "react";
import { matchPrebuildError } from "@gitpod/public-api-common/lib/prebuild-utils";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Disposable, DisposableCollection, HEADLESS_LOG_STREAM_STATUS_CODE_REGEX } from "@gitpod/gitpod-protocol";
import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { PlainMessage } from "@bufbuild/protobuf";
import { ReplayableEventEmitter } from "../../utils";

type LogEventTypes = {
    error: [Error];
    logs: [string];
    "logs-error": [ApplicationError];
};

/**
 * Watches the logs of a prebuild task by returning an EventEmitter that emits logs, logs-error, and error events.
 * @param prebuildId ID of the prebuild to watch
 * @param taskId ID of the task to watch.
 */
export function usePrebuildLogsEmitter(prebuild: PlainMessage<Prebuild>, taskId: string) {
    const emitter = useMemo(
        () => {
            console.log("creating new emitter", { id: prebuild.id, taskId });
            return new ReplayableEventEmitter<LogEventTypes>();
        },
        // We would like to re-create the emitter when the prebuildId or taskId changes, so that logs of old tasks / prebuilds are not mixed with the new ones.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [prebuild.id, taskId],
    );

    const shouldFetchLogs = useMemo(() => {
        const phase = prebuild.status?.phase?.name;
        if (phase === PrebuildPhase_Phase.QUEUED && taskId === "image-build") {
            return true;
        }
        switch (phase) {
            case PrebuildPhase_Phase.QUEUED:
            case PrebuildPhase_Phase.UNSPECIFIED:
                return false;
            // This is the online case: we do the actual streaming
            // All others below are terminal states, where we get re-directed to the actual
            case PrebuildPhase_Phase.BUILDING:
            case PrebuildPhase_Phase.AVAILABLE:
            case PrebuildPhase_Phase.FAILED:
            case PrebuildPhase_Phase.ABORTED:
            case PrebuildPhase_Phase.TIMEOUT:
                return true;
        }
    }, [prebuild.status?.phase?.name, taskId]);

    useEffect(() => {
        console.log("usePrebuildLogsEmitter", {
            id: prebuild.id,
            taskId,
            shouldFetchLogs,
        });
        if (!shouldFetchLogs || emitter.hasReachedEnd()) {
            return;
        }
        console.log("going to fetch logs for " + taskId);

        // build streamUrl
        const task = {
            taskId,
            logUrl: "",
        };
        if (taskId === "image-build") {
            if (!prebuild.status?.imageBuildLogUrl) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `Image build logs URL not found in response`);
            }
            task.logUrl = prebuild.status?.imageBuildLogUrl;
        } else {
            const logUrl = prebuild?.status?.taskLogs?.find((log) => log.taskId === taskId)?.logUrl;
            if (!logUrl) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `Task ${taskId} not found`);
            }

            task.logUrl = logUrl;
        }

        // stream
        const disposables = new DisposableCollection();
        disposables.push(
            streamPrebuildLogs(
                task.logUrl,
                (msg) => {
                    emitter.emit("logs", msg);
                },
                async () => false,
                () => {
                    console.log("End reached", { id: prebuild.id, taskId });
                    emitter.markReachedEnd();
                },
            ),
        );

        return () => {
            disposables.dispose();
            console.log("Disposing PrebuildLogsEmitter", prebuild.id, taskId);
            if (!emitter.hasReachedEnd()) {
                // If we haven't finished yet, but the page is re-rendered, clear the output we already got.
                emitter.emit("reset");
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emitter, prebuild.id, taskId, shouldFetchLogs]);

    return { emitter };
}

function streamPrebuildLogs(
    streamUrl: string,
    onLog: (chunk: string) => void,
    checkIsDone: () => Promise<boolean>,
    onEnd?: () => void,
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
            console.log("fetching from streamUrl: " + streamUrl);
            response = await fetch(streamUrl, {
                method: "GET",
                cache: "no-cache",
                credentials: "include",
                keepalive: true,
                headers: {
                    TE: "trailers", // necessary to receive stream status code
                },
                redirect: "follow",
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
                const prebuildMatches = matchPrebuildError(msg);
                if (matches) {
                    if (matches.length < 2) {
                        console.debug("error parsing log stream status code. msg: " + msg);
                    } else {
                        const code = parseStatusCode(matches[1]);
                        if (code !== 200) {
                            throw new StreamError(code);
                        }
                    }
                } else if (prebuildMatches && prebuildMatches.code === ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE) {
                    // reset backoff because this error is expected
                    delayInSeconds = initialDelaySeconds;
                    throw prebuildMatches;
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
        } finally {
            reader?.cancel().catch(console.debug);
            if (onEnd) {
                onEnd();
            }
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
