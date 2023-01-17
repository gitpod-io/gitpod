/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInfo } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export type ListWorkspacesQueryResult = WorkspaceInfo[];

type UseListWorkspacesQueryArgs = {
    limit: number;
};

export const useListWorkspacesQuery = ({ limit }: UseListWorkspacesQueryArgs) => {
    return useQuery<ListWorkspacesQueryResult>({
        queryKey: getListWorkspacesQueryKey(),
        queryFn: async () => {
            // TODO: Can we update the backend api to sort & rank pinned over non-pinned for us?
            const [infos, pinned] = await Promise.all([
                getGitpodService().server.getWorkspaces({
                    limit,
                    includeWithoutProject: true,
                }),
                // Additional fetch for pinned workspaces
                // see also: https://github.com/gitpod-io/gitpod/issues/4488
                getGitpodService().server.getWorkspaces({
                    limit,
                    pinnedOnly: true,
                    includeWithoutProject: true,
                }),
            ]);

            // Merge both data sets into one unique (by ws id) array
            const workspacesMap = new Map(infos.map((ws) => [ws.workspace.id, ws]));
            const pinnedWorkspacesMap = new Map(pinned.map((ws) => [ws.workspace.id, ws]));
            const workspaces = Array.from(new Map([...workspacesMap, ...pinnedWorkspacesMap]).values());

            return workspaces;
        },
    });
};

export const getListWorkspacesQueryKey = () => ["workspaces", "list"];
