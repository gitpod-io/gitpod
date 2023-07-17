/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Workspace, WorkspaceInfo, WorkspaceInstanceRepoStatus } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getGitpodService } from "../../service/service";

export interface RepoStatusQueryResult {
    status?: WorkspaceInstanceRepoStatus;
}

export const useRepoStatusQuery = (info: Partial<WorkspaceInfo>) => {
    const [liveSupported, setLiveSupported] = useState(true);

    return useQuery<RepoStatusQueryResult>({
        queryKey: [
            "git-status",
            info.workspace?.id ?? "",
            info.latestInstance?.id ?? "",
            info.latestInstance?.status.phase ?? "",
            info.latestInstance?.ideUrl ?? "",
        ],
        queryFn: async () => {
            if (!info.workspace) {
                return {};
            }
            if (!info.latestInstance) {
                return {
                    status: {
                        branch: Workspace.getBranchName(info.workspace),
                    },
                };
            }
            if (info.latestInstance.status.phase !== "running") {
                if (info.latestInstance.status.repo) {
                    return {
                        status: info.latestInstance.status.repo,
                    };
                }
                return {
                    status: {
                        branch: Workspace.getBranchName(info.workspace),
                    },
                };
            }
            try {
                const ownerToken = await getGitpodService().server.getOwnerToken(info.workspace.id);
                const workspaceUrl = new URL(info.latestInstance.ideUrl);
                workspaceUrl.pathname = "/_supervisor/v1/status/git";
                const response = await fetch(workspaceUrl.toString(), {
                    headers: {
                        Authorization: `Bearer ${ownerToken}`,
                    },
                });
                if (response.status === 404) {
                    // supervisor does not support live git status (backward compatibility)
                    console.warn("supervisor does not support live git status, fallback to workspace info");
                    setLiveSupported(false);
                    if (info.latestInstance.status.repo) {
                        return {
                            status: info.latestInstance.status.repo,
                        };
                    }
                    return {
                        status: {
                            branch: Workspace.getBranchName(info.workspace),
                        },
                    };
                }
                if (response.status === 200) {
                    const result = await response.json();
                    return result;
                }
            } catch (e) {
                console.debug("failed to fetch git status:", e);
                // no-op, refetch each 5s
            }
            return {
                // undefined, since we don't know live state of running workspace
            };
        },
        retry: false,
        refetchInterval: () => (liveSupported ? 5000 : false),
    });
};
