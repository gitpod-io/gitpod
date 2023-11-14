/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PaginationRequest } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;
export const PAGE_DEFAULT = 1;

export function selectPage<T>(all: T[], pagination?: PaginationRequest): T[] {
    const page = Math.max(pagination?.page || PAGE_DEFAULT, PAGE_DEFAULT);
    const pageSize = Math.min(pagination?.pageSize || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);

    return all.slice(pageSize * (page - 1), pageSize * page);
}
