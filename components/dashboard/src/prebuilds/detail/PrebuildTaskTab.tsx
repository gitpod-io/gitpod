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
import { PrebuildTaskErrorTab } from "./PrebuildTaskErrorTab";

const WorkspaceLogs = React.lazy(() => import("../../components/WorkspaceLogs"));

type Props = {
    taskId: string;
    prebuild: Prebuild;
};
export const PrebuildTaskTab = ({ taskId, prebuild }: Props) => {
    const { emitter: logEmitter, disposable: disposeStreamingLogs } = usePrebuildLogsEmitter(prebuild.id, taskId);
    const [error, setError] = React.useState<ApplicationError | undefined>();
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
                // We don't want to show a toast for this error, we handle it in the UI
                return;
            }
            if (err?.message) {
                toast("Fetching logs failed: " + err.message);
            }
        };

        const logErrorListener = (err: ApplicationError) => {
            if (err.code === ErrorCodes.NOT_FOUND) {
                setError(err);
                return;
            }

            toast("Fetching logs failed: " + err.message, { autoHide: false, id: PersistedToastID });
        };

        logEmitter.on("error", errorListener);
        logEmitter.on("logs-error", logErrorListener);

        return () => {
            logEmitter.removeListener("error", errorListener);
            logEmitter.removeListener("logs-error", logErrorListener);
            setError(undefined);
        };
    }, [logEmitter, taskId, toast]);

    if (error) {
        return (
            <PrebuildTaskErrorTab taskId={taskId}>
                Logs of this prebuild task are inaccessible. Use <code>gp validate --prebuild --headless</code> in a
                workspace to see logs and debug prebuild issues.{" "}
                <a
                    href="https://www.gitpod.io/docs/configure/workspaces#validate-your-gitpod-configuration"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="gp-link"
                >
                    Learn more
                </a>
                .
            </PrebuildTaskErrorTab>
        );
    }

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
