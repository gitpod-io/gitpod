/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceClient } from "../../service/public-api";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";
import { useCurrentOrg } from "../organizations/orgs-query";

type DeleteWorkspaceArgs = {
    workspaceId: string;
};

export const useDeleteWorkspaceMutation = () => {
    const queryClient = useQueryClient();
    const org = useCurrentOrg();

    return useMutation({
        mutationFn: async ({ workspaceId }: DeleteWorkspaceArgs) => {
            return await workspaceClient.deleteWorkspace({ workspaceId });
        },
        onSuccess: (_, { workspaceId }) => {
            const queryKey = getListWorkspacesQueryKey(org.data?.id);

            // Remove workspace from cache so it's reflected right away
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.filter((info) => {
                    return info.id !== workspaceId;
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
