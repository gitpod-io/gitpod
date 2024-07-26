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
import { LoadingState } from "@podkit/loading/LoadingState";

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
        const logErrorListener = async (err: ApplicationError) => {
            if (err.code === ErrorCodes.NOT_FOUND) {
                setError(err);
                return;
            }

            const digest = await crypto.subtle.digest("sha256", new TextEncoder().encode(err.message + ":" + err.code));
            const toastId = new TextDecoder().decode(digest);
            toast("Fetching logs failed: " + err.message, { autoHide: false, id: toastId });
            setActiveToasts((prev) => new Set(prev).add(toastId));
        };

        logEmitter.on("logs-error", logErrorListener);

        return () => {
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
        if (error.code === ErrorCodes.NOT_FOUND && taskId === "image-build") {
            return (
                <PrebuildTaskErrorTab taskId={taskId}>
                    <span className="flex justify-center items-center gap-2">
                        Pulling container image <LoadingState delay={false} size={16} />
                    </span>
                </PrebuildTaskErrorTab>
            );
        }

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
                    taskId={taskId}
                    logsEmitter={logEmitter}
                />
            </Suspense>
        </TabsContent>
    );
});
