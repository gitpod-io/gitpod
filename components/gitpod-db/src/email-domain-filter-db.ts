/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { EmailDomainFilterEntry } from "@gitpod/gitpod-protocol";

export const EmailDomainFilterDB = Symbol("EmailDomainFilterDB");
export interface EmailDomainFilterDB {
    storeFilterEntry(entry: EmailDomainFilterEntry): Promise<void>;

    /**
     * @param emailDomain
     * @returns true iff this emailDomain is meant to be blocked
     */
    isBlocked(emailDomain: string): Promise<boolean>;
}
