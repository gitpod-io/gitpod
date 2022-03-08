/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';

@injectable()
export class UserCounter {
    public expires: Date | null = null;

    protected data: number | null = null;

    protected readonly timeout: number = 60 * 1000; // Cache data for 1 minute

    get count(): number | null {
        if (this.expires !== null && Date.now() >= this.expires.getTime()) {
            // The timestamp is in range - return the data
            return this.data;
        }
        // Not in range - return null
        return null;
    }

    set count(userCount: number | null) {
        this.expires = new Date(Date.now() + this.timeout);

        this.data = userCount;
    }
}
