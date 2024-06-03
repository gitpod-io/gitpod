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

export function usePrebuildLogsEmitter(prebuildId: string, taskId: string) {
    const [emitter] = useState(new EventEmitter());
    const [isLoading, setIsLoading] = useState(true);
    const [disposable, setDisposable] = useState<Disposable | undefined>();

    useEffect(() => {
        setIsLoading(true);
    }, [prebuildId, taskId]);

    useEffect(() => {
        const controller = new AbortController();
        const watch = async () => {
            if (!prebuildId || !taskId) {
                return;
            }
            let dispose: () => void | undefined;
            controller.signal.addEventListener("abort", () => {
                dispose?.();
            });
            const prebuild = await prebuildClient.getPrebuild({ prebuildId });
            const task = prebuild.prebuild?.status?.taskLogs?.find((log) => log.taskId === taskId);
            if (!task?.logUrl) {
                throw new Error("no prebuild logs url found");
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
        };
    }, [emitter, prebuildId, taskId]);
    return { emitter, isLoading, disposable };
}
