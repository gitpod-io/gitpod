/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { FunctionComponent, useCallback, useMemo, useState } from "react";
import { Item, ItemFieldIcon } from "../components/ItemsList";
import PendingChangesDropdown from "../components/PendingChangesDropdown";
import Tooltip from "../components/Tooltip";
import dayjs from "dayjs";
import { WorkspaceEntryOverflowMenu } from "./WorkspaceOverflowMenu";
import { WorkspaceStatusIndicator } from "./WorkspaceStatusIndicator";
import { Workspace } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { GitBranchIcon, PinIcon } from "lucide-react";
import { useUpdateWorkspaceMutation } from "../data/workspaces/update-workspace-mutation";
import { fromWorkspaceName } from "./RenameWorkspaceModal";
import { Button } from "@podkit/buttons/Button";
import { cn } from "@podkit/lib/cn";

type Props = {
    info: Workspace;
    shortVersion?: boolean;
};

export const WorkspaceEntry: FunctionComponent<Props> = ({ info, shortVersion }) => {
    const [menuActive, setMenuActive] = useState(false);
    const updateWorkspace = useUpdateWorkspaceMutation();

    const gitStatus = info.status?.gitStatus;

    const workspace = info;
    const currentBranch = gitStatus?.branch || "<unknown>";
    const project = getProjectPath(workspace);

    const changeMenuState = (state: boolean) => {
        setMenuActive(state);
    };

    const togglePinned = useCallback(() => {
        updateWorkspace.mutate({
            workspaceId: workspace.id,
            metadata: {
                pinned: !workspace.metadata?.pinned,
            },
        });
    }, [updateWorkspace, workspace.id, workspace.metadata?.pinned]);

    // Could this be `/start#${workspace.id}` instead?
    const startUrl = useMemo(
        () =>
            new GitpodHostUrl(window.location.href)
                .with({
                    pathname: "/start/",
                    hash: "#" + workspace.id,
                })
                .toString(),
        [workspace.id],
    );

    let gridCol =
        "grid-cols-[minmax(32px,32px),minmax(100px,auto),minmax(100px,300px),minmax(80px,160px),minmax(32px,32px),minmax(32px,32px)]";
    if (shortVersion) {
        gridCol = "grid-cols-[minmax(32px,32px),minmax(100px,auto)]";
    }

    return (
        <Item className={`whitespace-nowrap py-6 px-4 gap-3 grid ${gridCol}`} solid={menuActive}>
            <ItemFieldIcon className="min-w-8">
                <WorkspaceStatusIndicator status={workspace?.status} />
            </ItemFieldIcon>
            <div className="flex-grow flex flex-col py-auto truncate">
                <Tooltip content={info.id} allowWrap={true}>
                    <a href={startUrl}>
                        <div className="font-medium text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400">
                            {fromWorkspaceName(info) || info.id}
                        </div>
                    </a>
                </Tooltip>
                <Tooltip content={project ? "https://" + project : ""} allowWrap={true}>
                    <a href={project ? "https://" + project : undefined}>
                        <div className="text-sm overflow-ellipsis truncate text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                            {project || "Unknown"}
                        </div>
                    </a>
                </Tooltip>
            </div>
            {!shortVersion && (
                <>
                    <div className="flex flex-col justify-between">
                        <div className="text-gray-500 dark:text-gray-400 flex flex-row gap-1 items-center overflow-hidden">
                            <div className="min-w-4">
                                <GitBranchIcon className="h-4 w-4" />
                            </div>
                            <Tooltip
                                content={currentBranch}
                                className="truncate overflow-ellipsis max-w-[120px] w-auto"
                            >
                                {currentBranch}
                            </Tooltip>
                        </div>
                        <div className="mr-auto">
                            <PendingChangesDropdown gitStatus={gitStatus} />
                        </div>
                    </div>
                    <div className="flex items-center">
                        {/*
                         * Tooltip for workspace last active time
                         * Displays relative time (e.g. "2 days ago") as visible text
                         * Shows exact date and time with GMT offset on hover
                         * Uses dayjs for date formatting and relative time calculation
                         * Handles potential undefined dates with fallback to current date
                         * Removes leading zero from single-digit GMT hour offsets
                         */}
                        <Tooltip
                            content={`Last active: ${dayjs(
                                info.status?.phase?.lastTransitionTime?.toDate() ?? new Date(),
                            ).format("MMM D, YYYY, h:mm A")} GMT${dayjs(
                                info.status?.phase?.lastTransitionTime?.toDate() ?? new Date(),
                            )
                                .format("Z")
                                .replace(/^([+-])0/, "$1")}`}
                            className="w-full"
                        >
                            <div className="text-sm w-full text-gray-400 overflow-ellipsis truncate">
                                {dayjs(info.status?.phase?.lastTransitionTime?.toDate() ?? new Date()).fromNow()}
                            </div>
                        </Tooltip>
                    </div>
                    <div className="min-w-8 flex items-center">
                        <Tooltip content={workspace.metadata?.pinned ? "Unpin" : "Pin"}>
                            <Button
                                onClick={togglePinned}
                                variant={"ghost"}
                                className={
                                    "group px-2 flex items-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md w-8 h-8"
                                }
                            >
                                <PinIcon
                                    className={cn(
                                        "w-4 h-4 self-center",
                                        workspace.metadata?.pinned
                                            ? "text-gray-600 dark:text-gray-300"
                                            : "text-gray-300 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                                    )}
                                />
                            </Button>
                        </Tooltip>
                    </div>
                    <WorkspaceEntryOverflowMenu changeMenuState={changeMenuState} info={info} />
                </>
            )}
        </Item>
    );
};

export function getProjectPath(ws: Workspace) {
    // TODO: Remove and call papi ContextService
    return ws.metadata!.originalContextUrl.replace("https://", "");
}
