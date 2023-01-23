/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getGitpodService } from "../../service/service";
import { getListWorkspacesQueryKey, ListWorkspacesQueryResult } from "./list-workspaces-query";

export const useListenToWorkspacesWSMessages = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const disposable = getGitpodService().registerClient({
            onInstanceUpdate: (instance: WorkspaceInstance) => {
                const queryKey = getListWorkspacesQueryKey();
                let foundWorkspaces = false;

                // Update the workspace with the latest instance
                queryClient.setQueryData<ListWorkspacesQueryResult>(queryKey, (oldWorkspacesData) => {
                    return oldWorkspacesData?.map((info) => {
                        if (info.workspace.id !== instance.workspaceId) {
                            return info;
                        }

                        foundWorkspaces = true;
                        return {
                            ...info,
                            latestInstance: instance,
                        };
                    });
                });

                if (!foundWorkspaces) {
                    // If the instance was for a workspace we don't have, it should get returned w/ an updated query
                    queryClient.invalidateQueries({ queryKey });
                }
            },
        });

        return () => {
            disposable.dispose();
        };
    }, [queryClient]);
};
