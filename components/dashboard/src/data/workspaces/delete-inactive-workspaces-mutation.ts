/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspacesService } from "../../service/public-api";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useFeatureFlag } from "../featureflag-query";

type DeleteInactiveWorkspacesArgs = {
    workspaceIds: string[];
};
export const useDeleteInactiveWorkspacesMutation = () => {
    const queryClient = useQueryClient();
    const usePublicApiWorkspacesService = !!useFeatureFlag("publicApiExperimentalWorkspaceService").data;
    const org = useCurrentOrg();

    return useMutation({
        mutationFn: async ({ workspaceIds }: DeleteInactiveWorkspacesArgs) => {
            const deletedWorkspaceIds = [];

            for (const workspaceId of workspaceIds) {
                try {
                    usePublicApiWorkspacesService
                        ? await workspacesService.deleteWorkspace({ workspaceId })
                        : await getGitpodService().server.deleteWorkspace(workspaceId);

                    deletedWorkspaceIds.push(workspaceId);
                } catch (e) {
                    // TODO good candidate for a toast?
                    console.error("Error deleting inactive workspace");
                }
            }

            return deletedWorkspaceIds;
        },
        onSuccess: (deletedWorkspaceIds) => {
            const queryKey = getListWorkspacesQueryKey(org.data?.id);

            // Remove deleted workspaces from cache so it's reflected right away
            // Using the result of the mutationFn so we only remove workspaces that were delete
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.filter((info) => {
                    return !deletedWorkspaceIds.includes(info.workspace.id);
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
