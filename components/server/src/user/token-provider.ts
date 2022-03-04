/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Token, User } from "@gitpod/gitpod-protocol";

export const TokenProvider = Symbol('TokenProvider');
export interface TokenProvider {
    /**
     * Returns a valid authentication token for the given host and user
     * @param user
     * @param host
     */
    getTokenForHost(user: User, host: string): Promise<Token>;

    /**
     * Retrieves a fresh port authentication token for the given user
     * @param user
     * @param workspaceId
     */
    getFreshPortAuthenticationToken(user: User, workspaceId: string): Promise<Token>;
}