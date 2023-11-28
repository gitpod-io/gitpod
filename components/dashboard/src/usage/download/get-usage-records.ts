/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ListUsageRequest, Ordering, Usage } from "@gitpod/gitpod-protocol/lib/usage";
import { getGitpodService } from "../../service/service";

type GetAllUsageRecordsArgs = Pick<ListUsageRequest, "attributionId" | "from" | "to"> & {
    signal?: AbortSignal;
    onProgress?: (percentage: number) => void;
};

export const getAllUsageRecords = async ({
    attributionId,
    from,
    to,
    signal,
    onProgress,
}: GetAllUsageRecordsArgs): Promise<Usage[]> => {
    let page = 1;
    let totalPages: number | null = null;
    let records: Usage[] = [];

    while (totalPages === null || page <= totalPages) {
        if (signal?.aborted === true) {
            return [];
        }

        const timer = new Promise((r) => setTimeout(r, 1000));

        const resp = await getUsagePage({
            attributionId,
            from,
            to,
            page,
        });
        records = records.concat(resp.usageEntriesList);
        totalPages = resp.pagination?.totalPages ?? 0;

        if (totalPages > 0) {
            onProgress?.(Math.ceil((page / totalPages) * 100));
        }

        // ensure we only call once per second
        // TODO: consider starting timer here to ensure 1s between call completing and next call vs. 1s between start and next call
        await timer;

        page = page + 1;
    }

    return records;
};

type GetUsagePageArgs = Pick<ListUsageRequest, "attributionId" | "from" | "to"> & {
    page: number;
};
const getUsagePage = async ({ attributionId, from, to, page }: GetUsagePageArgs) => {
    const request: ListUsageRequest = {
        attributionId,
        from,
        to,
        order: Ordering.ORDERING_DESCENDING,
        pagination: {
            perPage: 1000,
            page,
        },
    };

    return await getGitpodService().server.listUsage(request);
};
