/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInfo } from "@gitpod/gitpod-protocol";
import { useCallback } from "react";
import { hoursBefore, isDateSmallerOrEqual } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { getGitpodService } from "../../service/service";

type UseFetchWorkspacesArgs = {
    limit: number;
};

type FetchWorkspacesReturnValue = {
    active: WorkspaceInfo[];
    inactive: WorkspaceInfo[];
};

export const useFetchWorkspaces = ({ limit = 50 }: UseFetchWorkspacesArgs) => {
    return useCallback(async (): Promise<FetchWorkspacesReturnValue> => {
        const [infos, pinned] = await Promise.all([
            getGitpodService().server.getWorkspaces({
                limit,
                includeWithoutProject: true,
            }),
            // Additional fetch for pinned workspaces
            // see also: https://github.com/gitpod-io/gitpod/issues/4488
            getGitpodService().server.getWorkspaces({
                limit,
                pinnedOnly: true,
                includeWithoutProject: true,
            }),
        ]);

        const workspacesMap = new Map(infos.map((ws) => [ws.workspace.id, ws]));
        const pinnedWorkspacesMap = new Map(pinned.map((ws) => [ws.workspace.id, ws]));

        const mergedWorkspaces = new Map([...workspacesMap, ...pinnedWorkspacesMap]);

        const workspaces = Array.from(mergedWorkspaces.values());

        const sortedWorkspaces = workspaces.sort((a, b) => {
            const result = workspaceActiveDate(b).localeCompare(workspaceActiveDate(a));
            if (result === 0) {
                // both active now? order by creationtime
                return WorkspaceInfo.lastActiveISODate(b).localeCompare(WorkspaceInfo.lastActiveISODate(a));
            }
            return result;
        });

        const activeWorkspaces = sortedWorkspaces.filter((ws) => isWorkspaceActive(ws));

        // respecting the limit, return inactive workspaces as well
        const inactiveWorkspaces = sortedWorkspaces
            .filter((ws) => !isWorkspaceActive(ws))
            .slice(0, limit - activeWorkspaces.length);

        return {
            active: activeWorkspaces,
            inactive: inactiveWorkspaces,
        };
    }, [limit]);
};

/**
 * Given a WorkspaceInfo, return a timestamp of the last related activitiy
 *
 * @param info WorkspaceInfo
 * @returns string timestamp
 */
function workspaceActiveDate(info: WorkspaceInfo): string {
    if (!info.latestInstance) {
        return info.workspace.creationTime;
    }
    if (info.latestInstance.status.phase === "stopped" || info.latestInstance.status.phase === "unknown") {
        return WorkspaceInfo.lastActiveISODate(info);
    }

    const now = new Date().toISOString();
    return info.latestInstance.stoppedTime || info.latestInstance.stoppingTime || now;
}

/**
 * Returns a boolean indicating if the workspace should be considered active.
 * A workspace is considered active if it is pinned, not stopped, or was active within the last 24 hours
 *
 * @param info WorkspaceInfo
 * @returns boolean If workspace is considered active
 */
function isWorkspaceActive(info: WorkspaceInfo): boolean {
    const lastSessionStart = WorkspaceInfo.lastActiveISODate(info);
    const twentyfourHoursAgo = hoursBefore(new Date().toISOString(), 24);

    return (
        (info.workspace.pinned ||
            (!!info.latestInstance && info.latestInstance.status?.phase !== "stopped") ||
            isDateSmallerOrEqual(twentyfourHoursAgo, lastSessionStart)) &&
        !info.workspace.softDeleted
    );
}
