/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useFetchWorkspaces } from "./fetchers";

type UseWorkspaceArgs = {
    limit: number;
};

export const useWorkspaces = ({ limit }: UseWorkspaceArgs) => {
    const fetchWorkspaces = useFetchWorkspaces({ limit });

    return useQuery({
        queryKey: getWorkspacesQueryKey(),
        queryFn: fetchWorkspaces,
    });
};

const getWorkspacesQueryKey = () => ["workspaces"];
