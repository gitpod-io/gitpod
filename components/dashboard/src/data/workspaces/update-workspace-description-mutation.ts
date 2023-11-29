/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { Workspace, WorkspaceMetadata } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

type UpdateWorkspaceDescriptionArgs = {
    workspaceId: string;
    newDescription: string;
};
export const useUpdateWorkspaceDescriptionMutation = () => {
    const queryClient = useQueryClient();
    const org = useCurrentOrg();

    return useMutation({
        mutationFn: async ({ workspaceId, newDescription }: UpdateWorkspaceDescriptionArgs) => {
            return await getGitpodService().server.setWorkspaceDescription(workspaceId, newDescription);
        },
        onSuccess: (_, { workspaceId, newDescription }) => {
            // TODO: use `useUpdateWorkspaceInCache` after respond Workspace object, see EXP-960
            const queryKey = getListWorkspacesQueryKey(org.data?.id);

            // pro-actively update workspace description rather than reload all workspaces
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.map((info) => {
                    if (info.id !== workspaceId) {
                        return info;
                    }

                    // TODO: Once the update description response includes an updated record,
                    // we can return that instead of having to know what to merge manually (same for other mutations)
                    const workspace = new Workspace(info);
                    if (!workspace.metadata) {
                        workspace.metadata = new WorkspaceMetadata();
                    }
                    workspace.metadata.name = newDescription;
                    return workspace;
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
