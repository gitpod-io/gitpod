/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Sort, SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";

export type Sorting = {
    orderBy: string;
    orderDir: "asc" | "desc";
};

export function parseSorting(
    sortList?: Sort[],
    opts?: { allowFields: string[]; defaultField?: string },
): Sorting | undefined {
    const defaultResult: Sorting | undefined = opts?.defaultField
        ? { orderBy: opts.defaultField, orderDir: "asc" }
        : undefined;
    if (!sortList || (sortList?.length ?? 0) === 0) {
        return defaultResult;
    }

    // grab the first sort entry - only 1 supported here
    const sort = sortList[0];
    if (!sort) {
        return defaultResult;
    }
    // defaults to urlRegexp
    const orderBy = sort.field || opts?.defaultField;
    if (!orderBy) {
        return defaultResult;
    }
    if (opts?.allowFields && !opts.allowFields.includes(orderBy)) {
        throw new ApplicationError(
            ErrorCodes.BAD_REQUEST,
            `orderBy must be one of ${opts.allowFields.map((f) => "'" + f + "'").join(" or ")}`,
        );
    }
    // defaults to ascending
    const orderDir: "asc" | "desc" = (sort.order || SortOrder.ASC) === SortOrder.DESC ? "desc" : "asc";

    return { orderBy, orderDir };
}
