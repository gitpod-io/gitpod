/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DisposableCollection } from "@gitpod/gitpod-protocol";
import { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { PrebuildStatus } from "../projects/Prebuilds";
import { useWorkspaceLogs } from "../service/logs-watcher-service";
import { prebuildClient, watchPrebuild } from "../service/public-api";

const Logs = React.lazy(() => import("./Logs"));

export interface PrebuildLogsProps {
    // The workspace ID of the "prebuild" workspace
    workspaceId: string | undefined;
    children?: React.ReactNode;
}

export default function PrebuildLogs(props: PrebuildLogsProps) {
    const [error, setError] = useState<Error | undefined>();
    const [prebuild, setPrebuild] = useState<Prebuild | undefined>();
    const onLogs = useWorkspaceLogs(props.workspaceId);

    const handlePrebuildUpdate = useCallback(
        (prebuild: Prebuild) => {
            if (prebuild.workspaceId === props.workspaceId) {
                setPrebuild(prebuild);
            }
        },
        [props],
    );

    useEffect(() => {
        if (!props.workspaceId) {
            return;
        }
        const toDispose = new DisposableCollection();
        (async () => {
            try {
                const response = await prebuildClient.listPrebuilds({ workspaceId: props.workspaceId });
                if (toDispose.disposed) {
                    return;
                }
                const prebuild = response.prebuilds[0];
                if (prebuild) {
                    handlePrebuildUpdate(prebuild);
                    toDispose.push(
                        watchPrebuild(
                            {
                                scope: {
                                    case: "prebuildId",
                                    value: prebuild.id,
                                },
                            },
                            handlePrebuildUpdate,
                        ),
                    );
                } else {
                    setError(new Error("Prebuild not found"));
                }
            } catch (err) {
                console.error(err);
                setError(err);
            }
        })();
        return () => toDispose.dispose();
    }, [props.workspaceId, handlePrebuildUpdate]);

    return (
        <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex flex-col mb-8">
            <div className="h-96 flex">
                <Suspense fallback={<div />}>
                    <Logs classes="h-full w-full" onLogs={onLogs} errorMessage={error?.message} />
                </Suspense>
            </div>
            <div className="w-full bottom-0 h-20 px-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex flex-row items-center space-x-2">
                {prebuild && <PrebuildStatus prebuild={prebuild} />}
                <div className="flex-grow" />
                {props.children}
            </div>
        </div>
    );
}
