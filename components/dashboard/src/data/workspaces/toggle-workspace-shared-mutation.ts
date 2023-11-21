/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { AdmissionLevel, Workspace } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

type ToggleWorkspaceSharedArgs = {
    workspaceId: string;
    level: AdmissionLevel;
};

export const useToggleWorkspaceSharedMutation = () => {
    const queryClient = useQueryClient();
    const org = useCurrentOrg();

    return useMutation({
        mutationFn: async ({ workspaceId, level }: ToggleWorkspaceSharedArgs) => {
            if (level === AdmissionLevel.UNSPECIFIED) {
                return;
            }
            return await getGitpodService().server.controlAdmission(
                workspaceId,
                level === AdmissionLevel.EVERYONE ? "everyone" : "owner",
            );
        },
        onSuccess: (_, { workspaceId, level }) => {
            if (level === AdmissionLevel.UNSPECIFIED) {
                return;
            }
            // TODO: use `useUpdateWorkspaceInCache` after respond Workspace object, see EXP-960
            const queryKey = getListWorkspacesQueryKey(org.data?.id);

            // Update workspace.shareable to the level we set so it's reflected immediately
            queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
                return oldWorkspacesData?.map((info) => {
                    if (info.id !== workspaceId) {
                        return info;
                    }

                    const workspace = new Workspace(info);
                    if (workspace.status) {
                        workspace.status.admission = level;
                    }
                    return workspace;
                });
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
