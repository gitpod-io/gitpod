/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EmailDomainFilterEntry } from "@gitpod/gitpod-protocol";

export const EmailDomainFilterDB = Symbol("EmailDomainFilterDB");
export interface EmailDomainFilterDB {
    storeFilterEntry(entry: EmailDomainFilterEntry): Promise<void>;
    getFilterEntries(): Promise<EmailDomainFilterEntry[]>;

    /**
     * @param emailDomain
     * @returns true iff this emailDomain is meant to be blocked
     */
    isBlocked(emailDomain: string): Promise<boolean>;
}
