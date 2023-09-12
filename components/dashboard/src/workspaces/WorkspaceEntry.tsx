/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    CommitContext,
    Workspace,
    WorkspaceInfo,
    ContextURL,
    WorkspaceInstanceRepoStatus,
} from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { FunctionComponent, useMemo, useState } from "react";
import { Item, ItemField, ItemFieldIcon } from "../components/ItemsList";
import PendingChangesDropdown from "../components/PendingChangesDropdown";
import Tooltip from "../components/Tooltip";
import dayjs from "dayjs";
import { WorkspaceEntryOverflowMenu } from "./WorkspaceOverflowMenu";
import { WorkspaceStatusIndicator } from "./WorkspaceStatusIndicator";
import { useFeatureFlag } from "../data/featureflag-query";
import { useListProjectsQuery } from "../data/projects/list-projects-query";
import { toRemoteURL } from "../projects/render-utils";

type Props = {
    info: WorkspaceInfo;
    shortVersion?: boolean;
};

export const WorkspaceEntry: FunctionComponent<Props> = ({ info, shortVersion }) => {
    const [menuActive, setMenuActive] = useState(false);
    const liveGitStatus = useFeatureFlag("supervisor_live_git_status");
    const listProjectsQuery = useListProjectsQuery();

    let repo: WorkspaceInstanceRepoStatus | undefined;
    if (liveGitStatus) {
        repo = info.latestInstance?.gitStatus;
    } else {
        repo = info.latestInstance?.status.repo;
    }

    const workspace = info.workspace;
    const currentBranch = repo?.branch || Workspace.getBranchName(info.workspace) || "<unknown>";
    const project = workspace.projectId
        ? listProjectsQuery.data?.projects.find((p) => p.id === workspace.projectId)
        : undefined;
    const normalizedContextUrl = ContextURL.getNormalizedURL(workspace)?.toString();
    const normalizedContextUrlDescription = normalizedContextUrl || workspace.contextURL; // Instead of showing nothing, we prefer to show the raw content instead
    const projectName =
        project?.name || (CommitContext.is(workspace.context) && workspace.context.repository.name) || "";
    const repositoryUrl = toRemoteURL(
        project?.cloneUrl || (CommitContext.is(workspace.context) && workspace.context.repository.cloneUrl) || "",
    );

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

    if (liveGitStatus) {
        return (
            <Item className="whitespace-nowrap py-3 relative" solid={menuActive}>
                <div className="flex items-center px-3">
                    <WorkspaceStatusIndicator instance={info?.latestInstance} />
                </div>
                <div className="flex-grow overflow-x-hidden overflow-ellipses">
                    <div className="flex space-x-2 items-center">
                        <a
                            href={startUrl}
                            className="font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            {currentBranch}
                        </a>
                        <div className="text-sm">&middot;</div>
                        <a
                            href={startUrl}
                            className="text-sm text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            {projectName}
                        </a>
                        <div className="text-sm text-gray-400">&middot;</div>
                        <div className="text-sm w-full text-gray-400 overflow-ellipsis truncate">{repositoryUrl}</div>
                    </div>
                    <div className="flex items-center">
                        <PendingChangesDropdown workspaceInstance={info.latestInstance} />
                    </div>
                </div>
                <div className="flex items-center px-6">
                    <Tooltip content={`Created ${dayjs(info.workspace.creationTime).fromNow()}`}>
                        <div className="text-sm w-full text-gray-400 overflow-ellipsis truncate">
                            {dayjs(WorkspaceInfo.lastActiveISODate(info)).fromNow()}
                        </div>
                    </Tooltip>
                </div>
                <WorkspaceEntryOverflowMenu changeMenuState={changeMenuState} info={info} />
            </Item>
        );
    }

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
                            <PendingChangesDropdown workspaceInstance={info.latestInstance} />
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
