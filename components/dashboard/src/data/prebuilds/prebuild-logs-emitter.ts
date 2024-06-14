/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import { prebuildClient } from "../../service/public-api";
import { useEffect, useState } from "react";
import { matchPrebuildError, onDownloadPrebuildLogsUrl } from "@gitpod/public-api-common/lib/prebuild-utils";
import { Disposable } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

/**
 *
 * @param prebuildId ID of the prebuild to watch
 * @param taskId ID of the task to watch. If `null`, watch will not be started.
 * @returns
 */
export function usePrebuildLogsEmitter(prebuildId: string, taskId: string | null) {
    const [emitter] = useState(new EventEmitter());
    const [isLoading, setIsLoading] = useState(true);
    const [disposable, setDisposable] = useState<Disposable | undefined>();

    useEffect(() => {
        setIsLoading(true);
    }, [prebuildId, taskId]);

    useEffect(() => {
        const controller = new AbortController();
        const watch = async () => {
            if (taskId === null) {
                setIsLoading(false);
                return;
            }
            if (!prebuildId || !taskId) {
                setIsLoading(false);
                return;
            }

            let dispose: () => void | undefined;
            controller.signal.addEventListener("abort", () => {
                dispose?.();
            });

            const { prebuild } = await prebuildClient.getPrebuild({ prebuildId });
            if (!prebuild) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `Prebuild ${prebuildId} not found`);
            }

            setIsLoading(true);

            const task = {
                taskId,
                logUrl: "",
            };
            if (taskId === "image-build") {
                if (!prebuild.status?.imageBuildLogUrl) {
                    setIsLoading(false);
                    throw new ApplicationError(ErrorCodes.NOT_FOUND, `Image build logs URL not found in response`);
                }
                task.logUrl = prebuild.status?.imageBuildLogUrl;
            } else {
                const logUrl = prebuild?.status?.taskLogs?.find((log) => log.taskId === taskId)?.logUrl;
                if (!logUrl) {
                    setIsLoading(false);
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
                    onEnd: () => {
                        setIsLoading(false);
                    },
                },
            );
        };
        watch()
            .then(() => {})
            .catch((err) => {
                emitter.emit("error", err);
            });
        setDisposable(
            Disposable.create(() => {
                controller.abort();
            }),
        );
        return () => {
            controller.abort();
            emitter.removeAllListeners();
        };
    }, [emitter, prebuildId, taskId]);
    return { emitter, isLoading, disposable };
}
