/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";

export const BlockedUserFilter = Symbol("BlockedUserFilter");

/**
 * BlockedUserFilter is used during the signup of a user do filter out users who
 * have previously been blocked from the service.
 */
export interface BlockedUserFilter {

    /**
     * isBlocked returns true if the email is blocked and the user cannot sign up.
     */
    isBlocked(primaryEmail: string): Promise<boolean>;

}

/**
 * NoOneBlockedUserFilter blocks no one
 */
@injectable()
export class NoOneBlockedUserFilter implements BlockedUserFilter {

    async isBlocked(primaryEmail: string): Promise<boolean> {
        return false;
    }

}