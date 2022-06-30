/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { BlockedRepository } from "@gitpod/gitpod-protocol/src/blocked-repositories-protocol";

export const BlockedRepositoryDB = Symbol("BlockedRepositoryDB");

export interface BlockedRepositoryDB {
    isRepositoryBlocked(contextURL: string): Promise<BlockedRepository | undefined>;
}
