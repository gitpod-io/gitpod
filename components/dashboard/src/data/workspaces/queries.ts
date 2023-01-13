/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getGitpodService } from "../../service/service";
import { WorkspacesFetcherResult, useWorkspacesFetcher } from "./fetchers";

type UseWorkspaceArgs = {
    limit: number;
};

export const useWorkspaces = ({ limit }: UseWorkspaceArgs) => {
    const fetchWorkspaces = useWorkspacesFetcher({ limit });

    return useQuery<WorkspacesFetcherResult>({
        queryKey: getListWorkspacesQueryKey(),
        queryFn: fetchWorkspaces,
    });
};

export const getListWorkspacesQueryKey = () => ["workspaces", "list"];

// TODO: Find a better place for this to live
export const useListenToWorkspacesWSMessages = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const disposable = getGitpodService().registerClient({
            onInstanceUpdate: (instance: WorkspaceInstance) => {
                const queryKey = getListWorkspacesQueryKey();
                let foundWorkspaces = false;

                // Update the workspace with the latest instance
                queryClient.setQueryData<WorkspacesFetcherResult>(queryKey, (oldWorkspacesData) => {
                    return oldWorkspacesData?.map((info) => {
                        if (info.workspace.id !== instance.workspaceId) {
                            return info;
                        }

                        foundWorkspaces = true;
                        return {
                            ...info,
                            latestInstance: instance,
                        };
                    });
                });

                if (!foundWorkspaces) {
                    // If the instance was for a workspace we don't have, it should get returned w/ an updated query
                    queryClient.invalidateQueries({ queryKey });
                }
            },
        });

        return () => {
            console.log("disposing client");
            disposable.dispose();
        };
    }, [queryClient]);
};
