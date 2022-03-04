/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import ContextMenu, { ContextMenuEntry } from "./ContextMenu";
import CaretDown from "../icons/CaretDown.svg";

export default function PendingChangesDropdown(props: { workspaceInstance?: WorkspaceInstance }) {
  const repo = props.workspaceInstance?.status?.repo;
  const headingStyle = 'text-gray-500 dark:text-gray-400 text-left';
  const itemStyle = 'text-gray-400 dark:text-gray-500 text-left -mt-5';
  const menuEntries: ContextMenuEntry[] = [];
  let totalChanges = 0;
  if (repo) {
    if ((repo.totalUntrackedFiles || 0) > 0) {
      totalChanges += repo.totalUntrackedFiles || 0;
      menuEntries.push({ title: 'Untracked Files', customFontStyle: headingStyle });
      (repo.untrackedFiles || []).forEach(item => menuEntries.push({ title: item, customFontStyle: itemStyle }));
    }
    if ((repo.totalUncommitedFiles || 0) > 0) {
      totalChanges += repo.totalUncommitedFiles || 0;
      menuEntries.push({ title: 'Uncommitted Files', customFontStyle: headingStyle });
      (repo.uncommitedFiles || []).forEach(item => menuEntries.push({ title: item, customFontStyle: itemStyle }));
    }
    if ((repo.totalUnpushedCommits || 0) > 0) {
      totalChanges += repo.totalUnpushedCommits || 0;
      menuEntries.push({ title: 'Unpushed Commits', customFontStyle: headingStyle });
      (repo.unpushedCommits || []).forEach(item => menuEntries.push({ title: item, customFontStyle: itemStyle }));
    }
  }
  if (totalChanges <= 0) {
    return <div className="text-sm text-gray-400 dark:text-gray-500">No Changes</div>;
  }
  return <ContextMenu menuEntries={menuEntries} classes="w-64 max-h-48 overflow-scroll mx-auto left-0 right-0">
    <p className="flex justify-center text-gitpod-red">
      <span>{totalChanges} Change{totalChanges === 1 ? '' : 's'}</span>
      <img className="m-2" src={CaretDown}/>
    </p>
  </ContextMenu>;
}