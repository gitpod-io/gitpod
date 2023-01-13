/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FetchWorkspacesReturnValue, useDeleteWorkspaceFetcher, useFetchUpdateWorkspaceDescription } from "./fetchers";
import { getWorkspacesQueryKey } from "./queries";

export const useUpdateWorkspaceDescription = () => {
    const queryClient = useQueryClient();
    const updateDescription = useFetchUpdateWorkspaceDescription();

    return useMutation({
        mutationFn: updateDescription,
        onSuccess: (_, { workspaceId, newDescription }) => {
            const queryKey = getWorkspacesQueryKey();

            // TODO: This is a lot of work (and error prone) to update the description, should we just invalidate the query instead?
            const workspacesData: FetchWorkspacesReturnValue | undefined = queryClient.getQueryData(queryKey);
            if (!workspacesData) {
                return;
            }

            // pro-actively update workspace description rather than reload all workspaces
            const updatedWorkspacesData = workspacesData.map((info) => {
                if (info.workspace.id !== workspaceId) {
                    return info;
                }

                return {
                    ...info,
                    workspace: {
                        ...info.workspace,
                        description: newDescription,
                    },
                };
            });

            queryClient.setQueryData(queryKey, updatedWorkspacesData);

            // Invalidate so we get the latest from the server
            queryClient.invalidateQueries({ queryKey });
        },
    });
};

export const useDeleteWorkspaceMutation = () => {
    const queryClient = useQueryClient();
    const deleteWorkspace = useDeleteWorkspaceFetcher();

    return useMutation({
        mutationFn: deleteWorkspace,
        onSuccess: (_, { workspaceId }) => {
            const queryKey = getWorkspacesQueryKey();

            const workspacesData: FetchWorkspacesReturnValue | undefined = queryClient.getQueryData(queryKey);
            if (!workspacesData) {
                return;
            }

            // pro-actively prune workspace from list
            const updatedWorkspacesData = workspacesData.filter((info) => {
                return info.workspace.id !== workspaceId;
            });

            queryClient.setQueryData(queryKey, updatedWorkspacesData);

            // Invalidate the query so we can get new data
            // queryClient.invalidateQueries({ queryKey });
        },
    });
};
