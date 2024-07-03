/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import ContextMenu, { ContextMenuEntry } from "./ContextMenu";
import CaretDown from "../icons/CaretDown.svg";
import { WorkspaceGitStatus } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

export default function PendingChangesDropdown({ gitStatus }: { gitStatus?: WorkspaceGitStatus }) {
    const headingStyle = "text-gray-500 dark:text-gray-400 text-left";
    const itemStyle = "text-gray-400 dark:text-gray-500 text-left -mt-5";
    const menuEntries: ContextMenuEntry[] = [];
    let totalChanges = 0;
    if (gitStatus) {
        if ((gitStatus.totalUntrackedFiles || 0) > 0) {
            totalChanges += gitStatus.totalUntrackedFiles || 0;
            menuEntries.push({ title: "Untracked Files", customFontStyle: headingStyle });
            (gitStatus.untrackedFiles || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
        if ((gitStatus.totalUncommitedFiles || 0) > 0) {
            totalChanges += gitStatus.totalUncommitedFiles || 0;
            menuEntries.push({ title: "Uncommitted Files", customFontStyle: headingStyle });
            (gitStatus.uncommitedFiles || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
        if ((gitStatus.totalUnpushedCommits || 0) > 0) {
            totalChanges += gitStatus.totalUnpushedCommits || 0;
            menuEntries.push({ title: "Unpushed Commits", customFontStyle: headingStyle });
            (gitStatus.unpushedCommits || []).forEach((item) =>
                menuEntries.push({ title: item, customFontStyle: itemStyle }),
            );
        }
    }
    if (totalChanges <= 0) {
        return <div className="text-sm text-gray-400 dark:text-gray-500">No Changes</div>;
    }
    return (
        <ContextMenu menuEntries={menuEntries} customClasses="w-64 max-h-48 overflow-scroll mx-auto left-0 right-0">
            <p className="flex items-center text-gitpod-red">
                <span>
                    {totalChanges} Change{totalChanges === 1 ? "" : "s"}
                </span>
                <img className="m-2" src={CaretDown} alt="caret icon pointing down" />
            </p>
        </ContextMenu>
    );
}
