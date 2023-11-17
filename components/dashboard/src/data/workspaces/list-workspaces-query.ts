/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { workspaceClient } from "../../service/public-api";
import { Workspace } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

export type ListWorkspacesQueryResult = Workspace[];

type UseListWorkspacesQueryArgs = {
    limit: number;
};

export const useListWorkspacesQuery = ({ limit }: UseListWorkspacesQueryArgs) => {
    const currentOrg = useCurrentOrg();
    return useQuery<ListWorkspacesQueryResult>({
        queryKey: getListWorkspacesQueryKey(currentOrg.data?.id),
        queryFn: async () => {
            // TODO: Can we update the backend api to sort & rank pinned over non-pinned for us?
            const [infos, pinned] = await Promise.all([
                workspaceClient.listWorkspaces({
                    pagination: {
                        pageSize: limit,
                    },
                    pinned: false,
                    organizationId: currentOrg.data?.id,
                }),
                // Additional fetch for pinned workspaces
                // see also: https://github.com/gitpod-io/gitpod/issues/4488
                workspaceClient.listWorkspaces({
                    pagination: {
                        pageSize: limit,
                    },
                    pinned: true,
                    organizationId: currentOrg.data?.id,
                }),
            ]);

            // Merge both data sets into one unique (by ws id) array
            const workspacesMap = new Map(infos.workspaces.map((ws) => [ws.id, ws]));
            const pinnedWorkspacesMap = new Map(pinned.workspaces.map((ws) => [ws.id, ws]));
            const workspaces = Array.from(new Map([...workspacesMap, ...pinnedWorkspacesMap]).values());

            return workspaces;
        },
        enabled: !!currentOrg.data,
    });
};

export function getListWorkspacesQueryKey(orgId?: string) {
    if (!orgId) {
        return ["workspaces", "list"];
    }
    return ["workspaces", "list", orgId];
}
