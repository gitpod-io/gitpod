/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import { Repository, User } from "@gitpod/gitpod-protocol"

export const RepositoryProvider = Symbol('RepositoryProvider');
export interface RepositoryProvider {
    getRepo(user: User, owner: string, repo: string): Promise<Repository>;
}