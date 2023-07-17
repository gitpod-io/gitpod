/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import ContextMenu, { ContextMenuEntry } from "./ContextMenu";
import CaretDown from "../icons/CaretDown.svg";
import { useRepoStatusQuery } from "../data/repo/repo-status-query";
import { WorkspaceInfo } from "@gitpod/gitpod-protocol";

export default function PendingChangesDropdown({ info }: { info: Partial<WorkspaceInfo> }) {
    const { data } = useRepoStatusQuery(info);
    if (!data) {
        return null;
    }
    const repoStatus = data.status;
    const headingStyle = "text-gray-500 dark:text-gray-400 text-left";
    const itemStyle = "text-gray-400 dark:text-gray-500 text-left -mt-5";
    const menuEntries: ContextMenuEntry[] = [];
    let totalChanges = 0;
    if (repoStatus) {
        if ((repoStatus.totalUntrackedFiles || 0) > 0) {
            totalChanges += repoStatus.totalUntrackedFiles || 0;
            menuEntries.push({ title: "Untracked Files", customFontStyle: headingStyle });
            (repoStatus.untrackedFiles || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
        if ((repoStatus.totalUncommitedFiles || 0) > 0) {
            totalChanges += repoStatus.totalUncommitedFiles || 0;
            menuEntries.push({ title: "Uncommitted Files", customFontStyle: headingStyle });
            (repoStatus.uncommitedFiles || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
        if ((repoStatus.totalUnpushedCommits || 0) > 0) {
            totalChanges += repoStatus.totalUnpushedCommits || 0;
            menuEntries.push({ title: "Unpushed Commits", customFontStyle: headingStyle });
            (repoStatus.unpushedCommits || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
    }
    if (totalChanges <= 0) {
        return <div className="text-sm text-gray-400 dark:text-gray-500">No Changes</div>;
    }
    return (
        <ContextMenu menuEntries={menuEntries} customClasses="w-64 max-h-48 overflow-scroll mx-auto left-0 right-0">
            <p className="flex justify-center text-gitpod-red">
                <span>
                    {totalChanges} Change{totalChanges === 1 ? "" : "s"}
                </span>
                <img className="m-2" src={CaretDown} alt="caret icon pointing down" />
            </p>
        </ContextMenu>
    );
}
