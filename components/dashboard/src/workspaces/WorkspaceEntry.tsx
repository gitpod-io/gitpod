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
import { PinIcon } from "lucide-react";
import { useUpdateWorkspaceMutation } from "../data/workspaces/update-workspace-mutation";

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

    return (
        <Item className="whitespace-nowrap py-6 px-6 gap-6" solid={menuActive}>
            <ItemFieldIcon>
                <WorkspaceStatusIndicator status={workspace?.status} />
            </ItemFieldIcon>
            <div className="flex-grow flex flex-col justify-between">
                <a href={startUrl}>
                    <div className="font-medium text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400">
                        {info.id}
                    </div>
                </a>
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
                    <div className="flex flex-col justify-between px-3">
                        <div className="text-gray-500 dark:text-gray-400 overflow-ellipsis truncate">
                            <Tooltip content={currentBranch}>{currentBranch}</Tooltip>
                        </div>
                        <div className="mr-auto">
                            <PendingChangesDropdown gitStatus={gitStatus} />
                        </div>
                    </div>
                    <div className="px-3 flex items-center">
                        <Tooltip
                            content={`Last Activate ${dayjs(
                                info.status!.phase!.lastTransitionTime!.toDate(),
                            ).fromNow()}`}
                        >
                            <div className="text-sm w-full text-gray-400 overflow-ellipsis truncate">
                                {dayjs(info.status?.phase?.lastTransitionTime?.toDate() ?? new Date()).fromNow()}
                            </div>
                        </Tooltip>
                    </div>
                    {/* add pin tool */}
                    <div className="px-3 flex items-center">
                        <PinIcon
                            onClick={togglePinned}
                            className={
                                "px-2 flex items-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md cursor-pointer w-8 h-8 self-center" +
                                (workspace.metadata?.pinned ? "text-gray-600 dark:text-gray-300" : "text-gray-400")
                            }
                        />
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
