/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodServer } from "@gitpod/gitpod-protocol";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";

type ToggleWorkspaceSharedArgs = {
    workspaceId: string;
    level: GitpodServer.AdmissionLevel;
};

export const useToggleWorkspaceSharedMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ workspaceId, level }: ToggleWorkspaceSharedArgs) => {
            return await getGitpodService().server.controlAdmission(workspaceId, level);
        },
        onSuccess: (_, { workspaceId, level }) => {
            const queryKey = getListWorkspacesQueryKey();

            // Update workspace.shareable to the level we set so it's reflected immediately
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
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
