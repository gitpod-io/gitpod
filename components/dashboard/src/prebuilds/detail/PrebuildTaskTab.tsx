/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { Suspense, memo, useEffect } from "react";
import { usePrebuildLogsEmitter } from "../../data/prebuilds/prebuild-logs-emitter";
import React from "react";
import { useToast } from "../../components/toasts/Toasts";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { TabsContent } from "@podkit/tabs/Tabs";
import { PrebuildTaskErrorTab } from "./PrebuildTaskErrorTab";
import type { PlainMessage } from "@bufbuild/protobuf";
import { useHistory } from "react-router";

const WorkspaceLogs = React.lazy(() => import("../../components/WorkspaceLogs"));

type Props = {
    taskId: string;
    prebuild: PlainMessage<Prebuild>;
};
export const PrebuildTaskTab = memo(({ taskId, prebuild }: Props) => {
    const { emitter: logEmitter } = usePrebuildLogsEmitter(prebuild, taskId);
    const [error, setError] = React.useState<ApplicationError | undefined>();
    const { toast, dismissToast } = useToast();
    const [activeToasts, setActiveToasts] = React.useState<Set<string>>(new Set());
    const history = useHistory();

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

            const toastId = crypto.randomUUID();
            toast("Fetching logs failed: " + err.message, { autoHide: false, id: toastId });
            setActiveToasts((prev) => new Set(prev).add(toastId));
        };

        logEmitter.on("error", errorListener);
        logEmitter.on("logs-error", logErrorListener);

        return () => {
            logEmitter.removeListener("error", errorListener);
            logEmitter.removeListener("logs-error", logErrorListener);
            setError(undefined);
        };
    }, [logEmitter, taskId, toast]);

    useEffect(() => {
        // When navigating away from the page, dismiss all toasts
        history.listen(() => {
            activeToasts.forEach((toastId) => {
                dismissToast(toastId);
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                    key={prebuild.id + taskId}
                    classes="w-full h-full"
                    xtermClasses="absolute top-0 left-0 bottom-0 right-0 ml-6 my-0 mt-4"
                    logsEmitter={logEmitter}
                />
            </Suspense>
        </TabsContent>
    );
});
