/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    FetchWorkspacesReturnValue,
    useDeleteWorkspaceFetcher,
    useFetchUpdateWorkspaceDescription,
    useStopWorkspaceFetcher,
    useToggleWorkspacePinnedFetcher,
    useToggleWorkspaceSharedFetcher,
} from "./fetchers";
import { getWorkspacesQueryKey } from "./queries";

export const useUpdateWorkspaceDescription = () => {
    const queryClient = useQueryClient();
    const updateDescription = useFetchUpdateWorkspaceDescription();

    return useMutation({
        mutationFn: updateDescription,
        onSuccess: (_, { workspaceId, newDescription }) => {
            const queryKey = getWorkspacesQueryKey();

            // pro-actively update workspace description rather than reload all workspaces
            queryClient.setQueryData<FetchWorkspacesReturnValue>(queryKey, (oldWorkspacesData) => {
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

export const useDeleteWorkspaceMutation = () => {
    const queryClient = useQueryClient();
    const deleteWorkspace = useDeleteWorkspaceFetcher();

    return useMutation({
        mutationFn: deleteWorkspace,
        onSuccess: (_, { workspaceId }) => {
            const queryKey = getWorkspacesQueryKey();

            // Remove workspace from cache so it's reflected right away
            queryClient.setQueryData<FetchWorkspacesReturnValue>(queryKey, (oldWorkspacesData) => {
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
            const queryKey = getWorkspacesQueryKey();

            // Update workspace.shareable to the level we set so it's reflected immediately
            queryClient.setQueryData<FetchWorkspacesReturnValue>(queryKey, (oldWorkspacesData) => {
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
            const queryKey = getWorkspacesQueryKey();

            // Update workspace.pinned to account for the toggle so it's reflected immediately
            queryClient.setQueryData<FetchWorkspacesReturnValue>(queryKey, (oldWorkspaceData) => {
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
