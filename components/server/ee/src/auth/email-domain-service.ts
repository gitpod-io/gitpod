/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { EmailDomainFilterDB } from "@gitpod/gitpod-db/lib/email-domain-filter-db";
import { BlockedUserFilter } from "../../../src/auth/blocked-user-filter";

export const EMailDomainService = Symbol("EMailDomainService");
export interface EMailDomainService extends BlockedUserFilter {}

@injectable()
export class EMailDomainServiceImpl implements EMailDomainService {
    @inject(EmailDomainFilterDB) protected readonly domainFilterDb: EmailDomainFilterDB;

    async isBlocked(email: string): Promise<boolean> {
        const { domain } = this.parseMail(email);
        return this.domainFilterDb.isBlocked(domain);
    }

    protected parseMail(email: string): { user: string; domain: string } {
        const parts = email.split("@");
        if (parts.length !== 2) {
            throw new Error("Invalid E-Mail address: " + email);
        }
        return { user: parts[0], domain: parts[1].toLowerCase() };
    }
}
