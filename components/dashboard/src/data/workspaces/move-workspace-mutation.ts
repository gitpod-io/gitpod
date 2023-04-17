/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";
import { useCurrentOrg } from "../organizations/orgs-query";

type MoveWorkspaceMutationArgs = {
    workspaceId: string;
    targetOrganizationId: string;
};

export const useMoveWorkspaceMutation = () => {
    const queryClient = useQueryClient();
    const currentOrg = useCurrentOrg();

    return useMutation({
        mutationFn: async (args: MoveWorkspaceMutationArgs) => {
            return await getGitpodService().server.moveWorkspace(args.workspaceId, args.targetOrganizationId);
        },
        onSuccess: (_, { workspaceId }) => {
            // Update workspaces list immediately
            queryClient.setQueryData<ListWorkspacesQueryResult>(
                getListWorkspacesQueryKey(currentOrg.data?.id),
                (oldWorkspaceData) => {
                    return oldWorkspaceData?.filter((info) => info.workspace.id === workspaceId);
                },
            );

            queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
        },
    });
};
