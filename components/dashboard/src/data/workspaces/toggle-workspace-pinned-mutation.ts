/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";

type ToggleWorkspacePinnedArgs = {
    workspaceId: string;
};

export const useToggleWorkspacedPinnedMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ workspaceId }: ToggleWorkspacePinnedArgs) => {
            return await getGitpodService().server.updateWorkspaceUserPin(workspaceId, "toggle");
        },
        onSuccess: (_, { workspaceId }) => {
            const queryKey = getListWorkspacesQueryKey();

            // Update workspace.pinned to account for the toggle so it's reflected immediately
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspaceData) => {
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
