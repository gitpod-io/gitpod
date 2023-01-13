/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { FetchWorkspacesReturnValue, useFetchWorkspaces } from "./fetchers";

type UseWorkspaceArgs = {
    limit: number;
};

export const useWorkspaces = ({ limit }: UseWorkspaceArgs) => {
    const fetchWorkspaces = useFetchWorkspaces({ limit });

    return useQuery<FetchWorkspacesReturnValue>({
        queryKey: getWorkspacesQueryKey(),
        queryFn: fetchWorkspaces,
    });
};

export const getWorkspacesQueryKey = () => ["workspaces"];
