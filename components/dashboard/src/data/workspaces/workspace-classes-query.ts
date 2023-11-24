/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { workspaceClient } from "../../service/public-api";
import { WorkspaceClass } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

export const useWorkspaceClasses = () => {
    return useQuery<WorkspaceClass[]>({
        queryKey: ["workspace-classes"],
        queryFn: async () => {
            const response = await workspaceClient.listWorkspaceClasses({});
            return response.workspaceClasses;
        },
        cacheTime: 1000 * 60 * 60, // 1h
        staleTime: 1000 * 60 * 60, // 1h
    });
};
