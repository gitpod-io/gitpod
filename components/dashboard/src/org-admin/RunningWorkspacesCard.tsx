/**
 * Copyright (c) Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { WorkspaceSession, WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useWorkspaceSessions } from "../data/insights/list-workspace-sessions-query";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import Alert from "../components/Alert";
import Spinner from "../icons/Spinner.svg";
import { toRemoteURL } from "../projects/render-utils";
import { displayTime } from "../usage/UsageEntry";
import { Timestamp } from "@bufbuild/protobuf";
import { WorkspaceStatusIndicator } from "../workspaces/WorkspaceStatusIndicator";

interface RunningWorkspacesCardProps {}

const isWorkspaceNotStopped = (session: WorkspaceSession): boolean => {
    return session.workspace?.status?.phase?.name !== WorkspacePhase_Phase.STOPPED;
};

export const RunningWorkspacesCard: FC<RunningWorkspacesCardProps> = () => {
    const lookbackHours = 48;

    const { data, fetchNextPage, hasNextPage, isLoading, isError, error, isFetchingNextPage } = useWorkspaceSessions({
        from: Timestamp.fromDate(dayjs().subtract(lookbackHours, "hours").startOf("day").toDate()),
    });

    useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const runningWorkspaces = useMemo(() => {
        if (!data?.pages) {
            return [];
        }
        const allSessions = data.pages.flatMap((page) => page);
        return allSessions.filter(isWorkspaceNotStopped);
    }, [data]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center w-full space-x-2 text-gray-400 text-sm p-8">
                <img alt="Loading Spinner" className="h-4 w-4 animate-spin" src={Spinner} />
                <span>Loading running workspaces...</span>
            </div>
        );
    }

    if (isError && error) {
        return (
            <Alert type="error" className="m-4">
                <p>Error loading running workspaces:</p>
                <pre>{error instanceof Error ? error.message : String(error)}</pre>
            </Alert>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mt-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">
                Currently Running Workspaces ({runningWorkspaces.length})
            </h3>
            {runningWorkspaces.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No workspaces are currently running.</p>
            ) : (
                <ItemsList className="text-gray-400 dark:text-gray-500">
                    <Item header={true} className="grid grid-cols-5 gap-x-3 bg-pk-surface-secondary dark:bg-gray-700">
                        <ItemField className="col-span-1 my-auto font-semibold">Status</ItemField>
                        <ItemField className="col-span-1 my-auto font-semibold">Workspace ID</ItemField>
                        <ItemField className="col-span-1 my-auto font-semibold">User</ItemField>
                        <ItemField className="col-span-1 my-auto font-semibold">Project</ItemField>
                        <ItemField className="col-span-1 my-auto font-semibold">Started</ItemField>
                    </Item>
                    {runningWorkspaces.map((session) => {
                        const workspace = session.workspace;
                        const owner = session.owner;
                        const context = session.context;
                        const status = workspace?.status;

                        const startedTimeString = session.startedTime
                            ? displayTime(session.startedTime.toDate().getTime())
                            : "-";
                        const projectContextURL =
                            context?.repository?.cloneUrl || workspace?.metadata?.originalContextUrl;

                        return (
                            <Item
                                key={session.id}
                                className="grid grid-cols-5 gap-x-3 hover:bg-gray-50 dark:hover:bg-gray-750"
                            >
                                <ItemField className="col-span-1 my-auto truncate">
                                    <WorkspaceStatusIndicator status={status} />
                                </ItemField>
                                <ItemField className="col-span-1 my-auto truncate font-mono text-xs">
                                    <span title={workspace?.id}>{workspace?.id || "-"}</span>
                                </ItemField>
                                <ItemField className="col-span-1 my-auto truncate">
                                    <span title={owner?.name}>{owner?.name || "-"}</span>
                                </ItemField>
                                <ItemField className="col-span-1 my-auto truncate">
                                    <span title={projectContextURL ? toRemoteURL(projectContextURL) : ""}>
                                        {projectContextURL ? toRemoteURL(projectContextURL) : "-"}
                                    </span>
                                </ItemField>
                                <ItemField className="col-span-1 my-auto truncate">
                                    <span title={startedTimeString}>{startedTimeString}</span>
                                </ItemField>
                            </Item>
                        );
                    })}
                </ItemsList>
            )}
        </div>
    );
};
