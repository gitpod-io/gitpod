/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EmailDomainFilterDB } from "@gitpod/gitpod-db/lib";
import { inject, injectable } from "inversify";

@injectable()
export class BlockedUserService {
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
