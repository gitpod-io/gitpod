/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    WorkspacesFetcherResult,
    useDeleteWorkspaceFetcher,
    useUpdateWorkspaceDescriptionFetcher,
    useStopWorkspaceFetcher,
    useToggleWorkspacePinnedFetcher,
    useToggleWorkspaceSharedFetcher,
} from "./fetchers";
import { getListWorkspacesQueryKey } from "./queries";

export const useUpdateWorkspaceDescriptionMutation = () => {
    const queryClient = useQueryClient();
    const updateDescription = useUpdateWorkspaceDescriptionFetcher();

    return useMutation({
        mutationFn: updateDescription,
        onSuccess: (_, { workspaceId, newDescription }) => {
            const queryKey = getListWorkspacesQueryKey();

            // pro-actively update workspace description rather than reload all workspaces
            queryClient.setQueryData<WorkspacesFetcherResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.map((info) => {
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
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};

type DeleteInactiveWorkspacesArgs = {
    workspaceIds: string[];
};
export const useDeleteInactiveWorkspacesMutation = () => {
    const queryClient = useQueryClient();
    const deleteWorkspace = useDeleteWorkspaceFetcher();

    return useMutation({
        mutationFn: async ({ workspaceIds }: DeleteInactiveWorkspacesArgs) => {
            const deletedWorkspaceIds = [];

            for (const workspaceId of workspaceIds) {
                try {
                    await deleteWorkspace({ workspaceId });
                    deletedWorkspaceIds.push(workspaceId);
                } catch (e) {
                    // TODO good candidate for a toast?
                    console.error("Error deleting inactive workspace");
                }
            }

            return deletedWorkspaceIds;
        },
        onSuccess: (deletedWorkspaceIds) => {
            const queryKey = getListWorkspacesQueryKey();

            // Remove deleted workspaces from cache so it's reflected right away
            queryClient.setQueryData<WorkspacesFetcherResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.filter((info) => {
                    return !deletedWorkspaceIds.includes(info.workspace.id);
                });
            });

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
            const queryKey = getListWorkspacesQueryKey();

            // Remove workspace from cache so it's reflected right away
            queryClient.setQueryData<WorkspacesFetcherResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.filter((info) => {
                    return info.workspace.id !== workspaceId;
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};

export const useStopWorkspaceMutation = () => {
    const stopWorkspace = useStopWorkspaceFetcher();

    // No need to manually update workspace in cache here, we'll receive messages over the ws that will update it
    return useMutation({
        mutationFn: stopWorkspace,
    });
};

export const useToggleWorkspaceSharedMutation = () => {
    const queryClient = useQueryClient();
    const toggleWorkspaceShared = useToggleWorkspaceSharedFetcher();

    return useMutation({
        mutationFn: toggleWorkspaceShared,
        onSuccess: (_, { workspaceId, level }) => {
            const queryKey = getListWorkspacesQueryKey();

            // Update workspace.shareable to the level we set so it's reflected immediately
            queryClient.setQueryData<WorkspacesFetcherResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.map((info) => {
                    if (info.workspace.id !== workspaceId) {
                        return info;
                    }

                    return {
                        ...info,
                        workspace: {
                            ...info.workspace,
                            shareable: level === "everyone" ? true : false,
                        },
                    };
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};

export const useToggleWorkspacedPinnedMutation = () => {
    const queryClient = useQueryClient();
    const toggleWorkspacePinned = useToggleWorkspacePinnedFetcher();

    return useMutation({
        mutationFn: toggleWorkspacePinned,
        onSuccess: (_, { workspaceId }) => {
            const queryKey = getListWorkspacesQueryKey();

            // Update workspace.pinned to account for the toggle so it's reflected immediately
            queryClient.setQueryData<WorkspacesFetcherResult>(queryKey, (oldWorkspaceData) => {
                return oldWorkspaceData?.map((info) => {
                    if (info.workspace.id !== workspaceId) {
                        return info;
                    }

                    return {
                        ...info,
                        workspace: {
                            ...info.workspace,
                            pinned: !info.workspace.pinned,
                        },
                    };
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
