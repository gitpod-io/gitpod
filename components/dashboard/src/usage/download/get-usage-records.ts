/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ListUsageRequest, Ordering, Usage } from "@gitpod/gitpod-protocol/lib/usage";
import { getGitpodService } from "../../service/service";

type GetAllUsageRecordsArgs = Pick<ListUsageRequest, "attributionId" | "from" | "to">;

export const getAllUsageRecords = async ({ attributionId, from, to }: GetAllUsageRecordsArgs) => {
    let page = 1;
    let totalPages: number | null = null;
    let records: Usage[] = [];

    // TODO: figure out a throttle for this
    while (totalPages === null || page < totalPages) {
        const timer = new Promise((r) => setTimeout(r, 1000));

        const resp = await getUsagePage({
            attributionId,
            from,
            to,
            page,
        });
        records = records.concat(resp.usageEntriesList);
        totalPages = resp.pagination?.totalPages ?? 0;
        page = page + 1;

        // ensure we only call once per second
        await timer;
    }

    return records;
};

type GetUsagePageArgs = GetAllUsageRecordsArgs & {
    page: number;
};
const getUsagePage = async ({ attributionId, from, to, page }: GetUsagePageArgs) => {
    const request: ListUsageRequest = {
        attributionId,
        from,
        to,
        order: Ordering.ORDERING_DESCENDING,
        pagination: {
            // TODO: determine a good upper bound here
            perPage: 1000,
            page,
        },
    };

    return await getGitpodService().server.listUsage(request);
};
