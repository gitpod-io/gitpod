/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CommitContext, Workspace, WorkspaceInfo, ContextURL } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { FunctionComponent, useMemo, useState } from "react";
import { Item, ItemField, ItemFieldIcon } from "../components/ItemsList";
import PendingChangesDropdown from "../components/PendingChangesDropdown";
import Tooltip from "../components/Tooltip";
import dayjs from "dayjs";
import { WorkspaceEntryOverflowMenu } from "./WorkspaceOverflowMenu";
import { WorkspaceStatusIndicator } from "./WorkspaceStatusIndicator";
import { converter } from "../service/public-api";

type Props = {
    info: WorkspaceInfo;
    shortVersion?: boolean;
};

export const WorkspaceEntry: FunctionComponent<Props> = ({ info, shortVersion }) => {
    const [menuActive, setMenuActive] = useState(false);

    const gitStatus = converter.toGitStatus(info);

    const workspace = info.workspace;
    const currentBranch = gitStatus?.branch || "<unknown>";
    const project = getProjectPath(workspace);
    const normalizedContextUrl = ContextURL.getNormalizedURL(workspace)?.toString();
    const normalizedContextUrlDescription = normalizedContextUrl || workspace.contextURL; // Instead of showing nothing, we prefer to show the raw content instead

    const changeMenuState = (state: boolean) => {
        setMenuActive(state);
    };

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
        <Item className="whitespace-nowrap py-6 px-6" solid={menuActive}>
            <ItemFieldIcon>
                <WorkspaceStatusIndicator instance={info?.latestInstance} />
            </ItemFieldIcon>
            <ItemField className="w-3/12 flex flex-col my-auto">
                <a href={startUrl}>
                    <div className="font-medium text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400">
                        {workspace.id}
                    </div>
                </a>
                <Tooltip content={project ? "https://" + project : ""} allowWrap={true}>
                    <a href={project ? "https://" + project : undefined}>
                        <div className="text-sm overflow-ellipsis truncate text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                            {project || "Unknown"}
                        </div>
                    </a>
                </Tooltip>
            </ItemField>
            {!shortVersion && (
                <>
                    <ItemField className="w-4/12 flex flex-col my-auto">
                        <div className="text-gray-500 dark:text-gray-400 overflow-ellipsis truncate">
                            {workspace.description}
                        </div>
                        <a href={normalizedContextUrl}>
                            <div className="text-sm text-gray-400 dark:text-gray-500 overflow-ellipsis truncate hover:text-blue-600 dark:hover:text-blue-400">
                                {normalizedContextUrlDescription}
                            </div>
                        </a>
                    </ItemField>
                    <ItemField className="w-2/12 flex flex-col my-auto">
                        <div className="text-gray-500 dark:text-gray-400 overflow-ellipsis truncate">
                            <Tooltip content={currentBranch}>{currentBranch}</Tooltip>
                        </div>
                        <div className="mr-auto">
                            <PendingChangesDropdown gitStatus={gitStatus} />
                        </div>
                    </ItemField>
                    <ItemField className="w-2/12 flex my-auto">
                        <Tooltip content={`Created ${dayjs(info.workspace.creationTime).fromNow()}`}>
                            <div className="text-sm w-full text-gray-400 overflow-ellipsis truncate">
                                {dayjs(WorkspaceInfo.lastActiveISODate(info)).fromNow()}
                            </div>
                        </Tooltip>
                    </ItemField>
                    <WorkspaceEntryOverflowMenu changeMenuState={changeMenuState} info={info} />
                </>
            )}
        </Item>
    );
};

export function getProjectPath(ws: Workspace) {
    if (CommitContext.is(ws.context)) {
        return `${ws.context.repository.host}/${ws.context.repository.owner}/${ws.context.repository.name}`;
    } else {
        return undefined;
    }
}
