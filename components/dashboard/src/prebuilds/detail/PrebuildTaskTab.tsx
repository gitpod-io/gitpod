/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { Suspense, useEffect } from "react";
import { usePrebuildLogsEmitter } from "../../data/prebuilds/prebuild-logs-emitter";
import React from "react";
import { useToast } from "../../components/toasts/Toasts";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { TabsContent } from "@podkit/tabs/Tabs";
import { PersistedToastID } from "./PrebuildDetailPage";

const WorkspaceLogs = React.lazy(() => import("../../components/WorkspaceLogs"));

type Props = {
    taskId: string;
    prebuild: Prebuild;
    onLogNotFound: () => void;
};
export const PrebuildTaskTab = ({ taskId, prebuild, onLogNotFound }: Props) => {
    const { emitter: logEmitter, disposable: disposeStreamingLogs } = usePrebuildLogsEmitter(prebuild.id, taskId);
    const { toast } = useToast();

    useEffect(() => {
        if (prebuild.status?.phase?.name === PrebuildPhase_Phase.ABORTED) {
            disposeStreamingLogs?.dispose();
        }
    }, [prebuild.status?.phase?.name, disposeStreamingLogs]);

    useEffect(() => {
        const errorListener = (err: Error) => {
            if (err?.name === "AbortError") {
                return;
            }
            if (err instanceof ApplicationError && err.code === ErrorCodes.NOT_FOUND) {
                // We don't want to show a toast for this error, because it's handled by `notFoundError` in `PrebuildDetailPage`
                return;
            }
            if (err?.message) {
                toast("Fetching logs failed: " + err.message);
            }
        };

        const logErrorListener = (err: ApplicationError) => {
            if (err.code === ErrorCodes.NOT_FOUND) {
                onLogNotFound();
                return;
            }

            toast("Fetching logs failed: " + err.message, { autoHide: false, id: PersistedToastID });
        };

        logEmitter.on("error", errorListener);
        logEmitter.on("logs-error", logErrorListener);

        return () => {
            logEmitter.removeListener("error", errorListener);
            logEmitter.removeListener("logs-error", logErrorListener);
        };
    }, [logEmitter, onLogNotFound, taskId, toast]);

    return (
        <TabsContent value={taskId} className="h-112 mt-0 border-pk-border-base">
            <Suspense fallback={<div />}>
                <WorkspaceLogs
                    classes="w-full h-full"
                    xtermClasses="absolute top-0 left-0 bottom-0 right-0 ml-6 my-0 mt-4"
                    logsEmitter={logEmitter}
                    key={taskId}
                />
            </Suspense>
        </TabsContent>
    );
};
