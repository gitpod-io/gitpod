/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { prebuildClient } from "../../service/public-api";
import { useEffect, useMemo, useState } from "react";
import { matchPrebuildError, onDownloadPrebuildLogsUrl } from "@gitpod/public-api-common/lib/prebuild-utils";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ReplayableEventEmitter } from "../../utils";
import { Disposable } from "@gitpod/gitpod-protocol";

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
export function usePrebuildLogsEmitter(prebuildId: string, taskId: string) {
    const emitter = useMemo(
        () => new ReplayableEventEmitter<LogEventTypes>(),
        // We would like to re-create the emitter when the prebuildId or taskId changes, so that logs of old tasks / prebuilds are not mixed with the new ones.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [prebuildId, taskId],
    );
    const [disposable, setDisposable] = useState<Disposable | undefined>();

    useEffect(() => {
        // The abortcontroller is meant to abort all activity on unmounting this effect
        const abortController = new AbortController();
        const watch = async () => {
            let dispose: () => void | undefined;
            abortController.signal.addEventListener("abort", () => {
                dispose?.();
            });

            const { prebuild } = await prebuildClient.getPrebuild({ prebuildId });
            if (!prebuild) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `Prebuild ${prebuildId} not found`);
            }

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

            dispose = onDownloadPrebuildLogsUrl(
                task.logUrl,
                (msg) => {
                    const error = matchPrebuildError(msg);
                    if (!error) {
                        emitter.emit("logs", msg);
                    } else {
                        emitter.emit("logs-error", error);
                    }
                },
                {
                    includeCredentials: true,
                    maxBackoffTimes: 3,
                    onEnd: () => {},
                },
            );
        };
        watch()
            .then(() => {})
            .catch((err) => {
                emitter.emit("error", err);
            });

        // The Disposable is meant as to give clients a way to stop watching logs before the component is unmounted. As such it decouples the individual AbortControllers that might get re-created multiple times.
        setDisposable(
            Disposable.create(() => {
                abortController.abort();
            }),
        );

        return () => {
            abortController.abort();
            emitter.clearLog();
            emitter.removeAllListeners();
        };
    }, [emitter, prebuildId, taskId]);

    return { emitter, disposable };
}
