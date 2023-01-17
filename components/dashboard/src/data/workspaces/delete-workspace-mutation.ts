/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFeatureFlags } from "../../contexts/FeatureFlagContext";
import { workspacesService } from "../../service/public-api";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";

type DeleteWorkspaceArgs = {
    workspaceId: string;
};

export const useDeleteWorkspaceMutation = () => {
    const queryClient = useQueryClient();
    const { usePublicApiWorkspacesService } = useFeatureFlags();

    return useMutation({
        mutationFn: async ({ workspaceId }: DeleteWorkspaceArgs) => {
            return usePublicApiWorkspacesService
                ? await workspacesService.deleteWorkspace({ workspaceId })
                : await getGitpodService().server.deleteWorkspace(workspaceId);
        },
        onSuccess: (_, { workspaceId }) => {
            const queryKey = getListWorkspacesQueryKey();

            // Remove workspace from cache so it's reflected right away
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.filter((info) => {
                    return info.workspace.id !== workspaceId;
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
