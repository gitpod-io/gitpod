/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PaginationRequest } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";

export interface ParsedPagination {
    offset: number;
    limit: number;
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
export function parsePagination(
    pagination: Partial<PaginationRequest> | undefined,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    maxPageSize = MAX_PAGE_SIZE,
): ParsedPagination {
    let pageSize = pagination?.pageSize ?? defaultPageSize;
    if (!Number.isInteger(pageSize)) {
        pageSize = defaultPageSize;
    }
    if (pageSize < 0) {
        pageSize = defaultPageSize;
    } else if (pageSize > maxPageSize) {
        pageSize = maxPageSize;
    }
    let page = pagination?.page ?? 0;
    if (!Number.isInteger(page) || (page ?? 0) < 0) {
        page = 0;
    }
    return {
        offset: page * pageSize,
        limit: pageSize,
    };
}
