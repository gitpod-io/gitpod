/**
 * Copyright (c) Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { WorkspaceSession, WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { workspaceClient } from "../service/public-api";
import { useWorkspaceSessions } from "../data/insights/list-workspace-sessions-query";
import { Button } from "@podkit/buttons/Button";
import ConfirmationModal from "../components/ConfirmationModal";
import { useToast } from "../components/toasts/Toasts";
import { useMaintenanceMode } from "../data/maintenance-mode/maintenance-mode-query";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import Alert from "../components/Alert";
import Spinner from "../icons/Spinner.svg";
import { toRemoteURL } from "../projects/render-utils";
import { displayTime } from "../usage/UsageEntry";
import { Timestamp } from "@bufbuild/protobuf";
import { WorkspaceStatusIndicator } from "../workspaces/WorkspaceStatusIndicator";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { Heading3 } from "../components/typography/headings";
import Tooltip from "../components/Tooltip";

const isWorkspaceNotStopped = (session: WorkspaceSession): boolean => {
    return session.workspace?.status?.phase?.name !== WorkspacePhase_Phase.STOPPED;
};

export const RunningWorkspacesCard: FC<{}> = () => {
    const lookbackHours = 48;
    const [isStopAllModalOpen, setIsStopAllModalOpen] = useState(false);
    const [isStoppingAll, setIsStoppingAll] = useState(false);
    const toast = useToast();
    const { isMaintenanceMode } = useMaintenanceMode();

    const { data, fetchNextPage, hasNextPage, isLoading, isError, error, isFetchingNextPage, refetch } =
        useWorkspaceSessions({
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

    const handleStopAllWorkspaces = async () => {
        if (runningWorkspaces.length === 0) {
            toast.toast({ type: "error", message: "No running workspaces to stop." });
            setIsStopAllModalOpen(false);
            return;
        }

        setIsStoppingAll(true);
        let successCount = 0;
        let errorCount = 0;

        const stopPromises = runningWorkspaces.map(async (session) => {
            if (session.workspace?.id) {
                try {
                    await workspaceClient.stopWorkspace({ workspaceId: session.workspace.id });
                    successCount++;
                } catch (e) {
                    console.error(`Failed to stop workspace ${session.workspace.id}:`, e);
                    errorCount++;
                }
            }
        });

        await Promise.allSettled(stopPromises);

        setIsStoppingAll(false);
        setIsStopAllModalOpen(false);

        if (errorCount > 0) {
            toast.toast({
                type: "error",
                message: `Failed to stop all workspaces`,
                description: `Attempted to stop ${runningWorkspaces.length} workspaces. ${successCount} stopped, ${errorCount} failed.`,
            });
        } else {
            toast.toast({
                type: "success",
                message: `Stop command sent`,
                description: `Successfully sent stop command for ${successCount} workspaces.`,
            });
        }
        refetch();
    };

    if (isLoading && !isStoppingAll) {
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

    const stopAllWorkspacesButton = (
        <Button
            variant="destructive"
            onClick={() => setIsStopAllModalOpen(true)}
            disabled={!isMaintenanceMode || isStoppingAll || isLoading || runningWorkspaces.length === 0}
        >
            Stop All Workspaces
        </Button>
    );

    return (
        <ConfigurationSettingsField>
            <div className="flex justify-between items-center mb-3">
                <Heading3>Currently Running Workspaces ({runningWorkspaces.length})</Heading3>
                {!isMaintenanceMode ? (
                    <Tooltip content="Enable maintenance mode to stop all workspaces">
                        {stopAllWorkspacesButton}
                    </Tooltip>
                ) : (
                    stopAllWorkspacesButton
                )}
            </div>
            {runningWorkspaces.length === 0 && !isLoading ? (
                <p className="text-pk-content-tertiary">No workspaces are currently running.</p>
            ) : (
                <ItemsList className="text-gray-400 dark:text-gray-500">
                    <Item
                        header={true}
                        className="grid grid-cols-[1fr_3fr_3fr_3fr_3fr] gap-x-3 bg-pk-surface-secondary dark:bg-gray-700"
                    >
                        <ItemField className="my-auto font-semibold">Status</ItemField>
                        <ItemField className="my-auto font-semibold">Workspace ID</ItemField>
                        <ItemField className="my-auto font-semibold">User</ItemField>
                        <ItemField className="my-auto font-semibold">Project</ItemField>
                        <ItemField className="my-auto font-semibold">Started</ItemField>
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
                                className="grid grid-cols-[1fr_3fr_3fr_3fr_3fr] gap-x-3 hover:bg-gray-50 dark:hover:bg-gray-750"
                            >
                                <ItemField className="my-auto truncate">
                                    <WorkspaceStatusIndicator status={status} />
                                </ItemField>
                                <ItemField className="my-auto truncate font-mono text-xs">
                                    <span title={workspace?.id}>{workspace?.id || "-"}</span>
                                </ItemField>
                                <ItemField className="my-auto truncate">
                                    <span title={owner?.name}>{owner?.name || "-"}</span>
                                </ItemField>
                                <ItemField className="my-auto truncate">
                                    <span title={projectContextURL ? toRemoteURL(projectContextURL) : ""}>
                                        {projectContextURL ? toRemoteURL(projectContextURL) : "-"}
                                    </span>
                                </ItemField>
                                <ItemField className="my-auto truncate">
                                    <span title={startedTimeString}>{startedTimeString}</span>
                                </ItemField>
                            </Item>
                        );
                    })}
                </ItemsList>
            )}
            <ConfirmationModal
                title="Confirm Stop All Workspaces"
                visible={isStopAllModalOpen}
                onClose={() => setIsStopAllModalOpen(false)}
                onConfirm={handleStopAllWorkspaces}
                buttonText={isStoppingAll ? "Stopping..." : "Confirm Stop All"}
                buttonType="destructive"
                buttonDisabled={isStoppingAll}
            >
                <p className="text-sm text-pk-content-secondary">
                    Are you sure you want to stop all {runningWorkspaces.length} currently running workspaces in this
                    organization? Workspaces will be backed up before stopping. This action cannot be undone.
                </p>
            </ConfirmationModal>
        </ConfigurationSettingsField>
    );
};
