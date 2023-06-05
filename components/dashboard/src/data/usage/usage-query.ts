/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import dayjs from "dayjs";

export function useListUsage(request: ListUsageRequest) {
    const query = useQuery<ListUsageResponse, Error>(
        ["usage", request],
        () => {
            // TODO: can we just rely on the api errors here instead of clientside too?
            if (dayjs(request.from).isAfter(dayjs(request.to))) {
                throw new Error("The start date needs to be before the end date.");
            }
            if (dayjs(request.from).add(300, "day").isBefore(dayjs(request.to))) {
                throw new Error("Range is too long. Max range is 300 days.");
            }

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
