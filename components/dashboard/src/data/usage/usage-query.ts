/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export function useListUsage(request: ListUsageRequest) {
    const query = useQuery<ListUsageResponse, Error>(
        ["usage", request],
        () => {
            return getGitpodService().server.listUsage(request);
        },
        {
            cacheTime: 1000 * 60 * 10, // 10 minutes
            staleTime: 1000 * 60 * 10, // 10 minutes
            retry: false,
        },
    );
    return query;
}
