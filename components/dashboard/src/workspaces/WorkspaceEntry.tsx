/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CommitContext, Workspace, WorkspaceInfo, WorkspaceInstanceRepoStatus } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { FunctionComponent, useMemo, useState } from "react";
import { Item, ItemField, ItemFieldIcon } from "../components/ItemsList";
import PendingChangesDropdown from "../components/PendingChangesDropdown";
import dayjs from "dayjs";
import { WorkspaceEntryOverflowMenu } from "./WorkspaceOverflowMenu";
import { WorkspaceStatusIndicator } from "./WorkspaceStatusIndicator";
import { useFeatureFlag } from "../data/featureflag-query";

type Props = {
    info: WorkspaceInfo;
    shortVersion?: boolean;
};

export const WorkspaceEntry: FunctionComponent<Props> = ({ info, shortVersion }) => {
    const [menuActive, setMenuActive] = useState(false);

    const liveGitStatus = useFeatureFlag("supervisor_live_git_status");
    let repo: WorkspaceInstanceRepoStatus | undefined;
    if (liveGitStatus) {
        repo = info.latestInstance?.gitStatus;
    } else {
        repo = info.latestInstance?.status.repo;
    }

    const workspace = info.workspace;
    const currentBranch = repo?.branch || Workspace.getBranchName(info.workspace) || "<unknown>";
    const project = getProjectPath(workspace);

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
            <ItemField className="w-3/12 my-auto">
                <a href={startUrl}>
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400 max-w-xs overflow-hidden whitespace-nowrap truncate">
                        {true ? currentBranch : "Custom description (branch)"}
                    </span>
                </a>
                <span className="text-gray-300 font-normal inline-block px-1">&middot;</span>
                <span className="text-sm w-full text-gray-400 overflow-ellipsis font-normal truncate">
                    {dayjs(WorkspaceInfo.lastActiveISODate(info)).fromNow()}
                </span>
                <PendingChangesDropdown workspaceInstance={info.latestInstance} />

                <a href={project ? "https://" + project : undefined}>
                    <div className="text-sm overflow-ellipsis truncate text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 max-w-32">
                        {project || "Unknown"}
                    </div>
                </a>
            </ItemField>
            <WorkspaceEntryOverflowMenu changeMenuState={changeMenuState} info={info} />
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
