/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PaginationRequest } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;
export const PAGE_DEFAULT = 1;

export type PaginationToken = {
    offset: number;
};

// Selects a page of results from a larger result-set
export function selectPage<T>(all: T[], pagination?: PaginationRequest): T[] {
    const { offset } = parsePaginationToken(pagination?.token);
    const pageSize: number = pagination?.pageSize || PAGE_SIZE_DEFAULT;
    const actualPageSize = Math.min(pageSize, PAGE_SIZE_MAX);

    return all.slice(offset, offset + actualPageSize);
}

export function parsePaginationToken(token?: string): PaginationToken {
    const paginationToken: PaginationToken = {
        offset: 0,
    };

    if (token) {
        try {
            const providedToken: string = token;
            const decoded = Buffer.from(providedToken, "base64").toString("utf-8");

            const parsedToken: any = JSON.parse(decoded);
            if (parsedToken.hasOwnProperty("offset") && Number.isInteger(parsedToken.offset)) {
                paginationToken.offset = parsedToken.offset;
            }

            return paginationToken;
        } catch (e) {
            // TODO: Do we want to log anything here?
        }
    }

    return paginationToken;
}

export function generatePaginationToken(token: PaginationToken): string {
    return Buffer.from(JSON.stringify(token)).toString("base64");
}
