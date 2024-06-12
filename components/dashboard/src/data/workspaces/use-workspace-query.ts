/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Workspace } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useQuery } from "@tanstack/react-query";
import { workspaceClient } from "../../service/public-api";

type UseWorkspaceArgs = {
    workspaceId: string;
};
export const useWorkspaceQuery = ({ workspaceId }: UseWorkspaceArgs) => {
    const currentOrg = useCurrentOrg();
    return useQuery<Workspace>({
        queryKey: getWorkspaceQueryKey(workspaceId),
        queryFn: async () => {
            const { workspace } = await workspaceClient.getWorkspace({
                workspaceId,
            });
            if (!workspace) {
                throw new Error("Workspace not found");
            }

            return workspace;
        },
        enabled: !!currentOrg.data,
    });
};

export function getWorkspaceQueryKey(workspaceId: string) {
    return ["workspace", "detail", workspaceId];
}
