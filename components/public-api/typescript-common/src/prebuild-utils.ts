/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Disposable, DisposableCollection, HEADLESS_LOG_STREAM_STATUS_CODE_REGEX } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCode, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

/**
 * new entry for the stream prebuild logs, contains logs of imageBuild (if it has) and prebuild tasks(first task only for now) logs
 * will be respond by public api gitpod.v1 PrebuildService.GetPrebuildLogUrl
 */
export const PREBUILD_LOGS_PATH_PREFIX = "/prebuild-logs";

export function getPrebuildLogPath(prebuildId: string, taskId?: string): string {
    const result = PREBUILD_LOGS_PATH_PREFIX + "/" + prebuildId;
    if (taskId) {
        return result + "/" + taskId;
    }
    return result;
}

/** cmp. @const HEADLESS_LOG_STREAM_ERROR_REGEX */
const PREBUILD_LOG_STREAM_ERROR = "X-Prebuild-Error";
const PREBUILD_LOG_STREAM_ERROR_REGEX = /X-Prebuild-Error#(?<code>[0-9]+)#(?<message>.*?)#X-Prebuild-Error/;

export function matchPrebuildError(msg: string): undefined | ApplicationError {
    const result = PREBUILD_LOG_STREAM_ERROR_REGEX.exec(msg);
    if (!result || !result.groups) {
        return;
    }
    return new ApplicationError(Number(result.groups.code) as ErrorCode, result.groups.message);
}

export function getPrebuildErrorMessage(err: any) {
    let code: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
    let message = "unknown error";
    if (err instanceof ApplicationError) {
        code = err.code;
        message = err.message;
    } else if (err instanceof Error) {
        message = "unexpected error";
    }
    return `${PREBUILD_LOG_STREAM_ERROR}#${code}#${message}#${PREBUILD_LOG_STREAM_ERROR}`;
}

const defaultBackoffTimes = 3;
interface Options {
    includeCredentials: boolean;
    maxBackoffTimes?: number;
    onEnd?: () => void;
}

/**
 * backoff fetch prebuild logs
 * @returns a function to cancel fetching
 */
export function onDownloadPrebuildLogsUrl(
    streamUrl: string,
    onLog: (message: string) => void,
    options: Options,
): () => void {
    const disposables = new DisposableCollection();

    // initializing non-empty here to use this as a stopping signal for the retries down below
    disposables.push(Disposable.NULL);

    // retry configuration goes here
    const initialDelaySeconds = 1;
    const backoffFactor = 1.2;
    const maxBackoffSeconds = 5;
    let delayInSeconds = initialDelaySeconds;
    let currentBackoffTimes = 0;

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
            currentBackoffTimes += 1;
            console.debug("fetching from streamUrl: " + streamUrl);
            response = await fetch(streamUrl, {
                method: "GET",
                cache: "no-cache",
                credentials: options.includeCredentials ? "include" : undefined,
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
                            throw new ApplicationError(
                                ErrorCodes.INTERNAL_SERVER_ERROR,
                                `prebuild log download status code: ${code}`,
                            );
                        }
                    }
                } else if (prebuildMatches && prebuildMatches.code === ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE) {
                    // reset backoff because this error is expected
                    delayInSeconds = initialDelaySeconds;
                    currentBackoffTimes = 0;
                    throw prebuildMatches;
                } else {
                    onLog(msg);
                }

                chunk = await reader.read();
            }
        } catch (err) {
            if (currentBackoffTimes > (options.maxBackoffTimes ?? defaultBackoffTimes)) {
                console.debug("stopped watching headless logs, max backoff reached", err);
                return;
            }
            if (err.code === 400) {
                // sth is really off, and we _should not_ retry
                console.debug("stopped watching headless logs", err);
                return;
            }
            await retryBackoff("error while listening to stream", err);
        } finally {
            reader?.cancel().catch(console.debug);
            if (options.onEnd) {
                options.onEnd();
            }
        }
    };
    startWatchingLogs().catch(console.error);

    return () => {
        disposables.dispose();
    };
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
