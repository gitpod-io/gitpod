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

type ToggleWorkspacePinnedArgs = {
    workspaceId: string;
};

export const useToggleWorkspacedPinnedMutation = () => {
    const queryClient = useQueryClient();
    const org = useCurrentOrg();

    return useMutation({
        mutationFn: async ({ workspaceId }: ToggleWorkspacePinnedArgs) => {
            return await getGitpodService().server.updateWorkspaceUserPin(workspaceId, "toggle");
        },
        onSuccess: (_, { workspaceId }) => {
            // TODO: use `useUpdateWorkspaceInCache` after respond Workspace object, see EXP-960
            const queryKey = getListWorkspacesQueryKey(org.data?.id);

            // Update workspace.pinned to account for the toggle so it's reflected immediately
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspaceData) => {
                return oldWorkspaceData?.map((info) => {
                    if (info.id !== workspaceId) {
                        return info;
                    }
                    const workspace = new Workspace(info);
                    if (!workspace.metadata) {
                        workspace.metadata = new WorkspaceMetadata();
                    }
                    workspace.metadata.pinned = !workspace.metadata.pinned;
                    return workspace;
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
