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

type DeleteWorkspaceArgs = {
    workspaceId: string;
};

export const useDeleteWorkspaceMutation = () => {
    const queryClient = useQueryClient();
    const usePublicApiWorkspacesService = !!useFeatureFlag("usePublicApiWorkspacesService").data;
    const org = useCurrentOrg();

    return useMutation({
        mutationFn: async ({ workspaceId }: DeleteWorkspaceArgs) => {
            return usePublicApiWorkspacesService
                ? await workspacesService.deleteWorkspace({ workspaceId })
                : await getGitpodService().server.deleteWorkspace(workspaceId);
        },
        onSuccess: (_, { workspaceId }) => {
            const queryKey = getListWorkspacesQueryKey(org.data?.id);

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
