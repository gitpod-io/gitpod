/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInstance, WorkspaceInstanceRepoStatus } from "@gitpod/gitpod-protocol";
import ContextMenu, { ContextMenuEntry } from "./ContextMenu";
import { useFeatureFlag } from "../data/featureflag-query";

export default function PendingChangesDropdown(props: { workspaceInstance?: WorkspaceInstance }) {
    const liveGitStatus = useFeatureFlag("supervisor_live_git_status");
    let repo: WorkspaceInstanceRepoStatus | undefined;
    if (liveGitStatus) {
        repo = props.workspaceInstance?.gitStatus;
    } else {
        repo = props.workspaceInstance?.status?.repo;
    }
    const headingStyle = "text-gray-500 dark:text-gray-400 text-left";
    const itemStyle = "text-gray-400 dark:text-gray-500 text-left -mt-5";
    const menuEntries: ContextMenuEntry[] = [];
    let totalChanges = 0;
    if (repo) {
        if ((repo.totalUntrackedFiles || 0) > 0) {
            totalChanges += repo.totalUntrackedFiles || 0;
            menuEntries.push({ title: "Untracked Files", customFontStyle: headingStyle });
            (repo.untrackedFiles || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
        if ((repo.totalUncommitedFiles || 0) > 0) {
            totalChanges += repo.totalUncommitedFiles || 0;
            menuEntries.push({ title: "Uncommitted Files", customFontStyle: headingStyle });
            (repo.uncommitedFiles || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
        if ((repo.totalUnpushedCommits || 0) > 0) {
            totalChanges += repo.totalUnpushedCommits || 0;
            menuEntries.push({ title: "Unpushed Commits", customFontStyle: headingStyle });
            (repo.unpushedCommits || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
    }
    if (totalChanges <= 0) {
        return <></>;
    }
    return (
        <ContextMenu menuEntries={menuEntries} customClasses="w-64 max-h-48 overflow-scroll mx-auto left-0 right-0">
            <span className="inline" title="Pending Changes">
                <span className="bg-gitpod-red text-gray-50 rounded-xl px-1.5 py-0.5 text-xs ml-2 font-medium">
                    {totalChanges}
                </span>
            </span>
        </ContextMenu>
    );
}
