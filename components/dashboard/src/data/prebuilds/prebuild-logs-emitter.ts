/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import { prebuildClient, workspaceClient } from "../../service/public-api";
import { useEffect, useState } from "react";
import { matchPrebuildError, onDownloadPrebuildLogsUrl } from "@gitpod/public-api-common/lib/prebuild-utils";
import { Disposable, WorkspaceImageBuild } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { getGitpodService } from "../../service/service";
import pRetry from "p-retry";

/**
 *
 * @param prebuildId ID of the prebuild to watch
 * @param taskId ID of the task to watch. If `null`, watch will not be started and if `image-build` is passed, it will watch the image build logs.
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
            if (taskId === "image-build" && prebuild?.workspaceId) {
                const workspace = await workspaceClient.getWorkspace({ workspaceId: prebuild.workspaceId });
                if (workspace.workspace?.status?.phase?.name === WorkspacePhase_Phase.IMAGEBUILD) {
                    await pRetry(
                        async () => {
                            await getGitpodService().server.watchWorkspaceImageBuildLogs(prebuild.workspaceId);
                        },
                        {
                            retries: 10,
                            onFailedAttempt: (error) => {
                                console.error(
                                    `Failed to watch image build logs for workspace ${prebuild.workspaceId} attempt ${error.attemptNumber}: ${error.message}`,
                                );
                            },
                        },
                    );
                    dispose = getGitpodService().registerClient({
                        onWorkspaceImageBuildLogs: (
                            _: WorkspaceImageBuild.StateInfo,
                            content?: WorkspaceImageBuild.LogContent,
                        ) => {
                            if (!content) {
                                return;
                            }
                            emitter.emit("logs", content.text);
                        },
                    }).dispose;
                }

                return;
            }

            const task = prebuild?.status?.taskLogs?.find((log) => log.taskId === taskId);
            if (!task?.logUrl) {
                setIsLoading(false);
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `Task ${taskId} not found`);
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
