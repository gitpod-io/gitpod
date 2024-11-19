/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";

export const BlockedRepositoryDB = Symbol("BlockedRepositoryDB");

export interface BlockedRepositoryDB {
    findAllBlockedRepositories(
        offset: number,
        limit: number,
        orderBy: keyof BlockedRepository,
        orderDir: "DESC" | "ASC",
        searchTerm?: string,
        minCreationDate?: Date,
        maxCreationDate?: Date,
    ): Promise<{ total: number; rows: BlockedRepository[] }>;

    findBlockedRepositoryByURL(contextURL: string): Promise<BlockedRepository | undefined>;

    createBlockedRepository(urlRegexp: string, blockUser: boolean, blockFreeUsage: boolean): Promise<BlockedRepository>;

    deleteBlockedRepository(id: number): Promise<void>;
}
