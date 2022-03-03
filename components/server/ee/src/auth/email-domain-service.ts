/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from 'inversify';
import * as SwotJs from 'swot-js';

import { EmailDomainFilterDB } from '@gitpod/gitpod-db/lib/email-domain-filter-db';
import { EduEmailDomainDB } from '@gitpod/gitpod-db/lib/edu-email-domain-db';
import { BlockedUserFilter } from '../../../src/auth/blocked-user-filter';

export const EMailDomainService = Symbol('EMailDomainService');
export interface EMailDomainService extends BlockedUserFilter {
    hasEducationalInstitutionSuffix(email: string): Promise<boolean>;
}

@injectable()
export class EMailDomainServiceImpl implements EMailDomainService {
    @inject(EmailDomainFilterDB) protected readonly domainFilterDb: EmailDomainFilterDB;
    @inject(EduEmailDomainDB) protected readonly eduDomainDb: EduEmailDomainDB;

    protected readonly swotJsPromise = this.initSwotJs();

    async isBlocked(email: string): Promise<boolean> {
        const { domain } = this.parseMail(email);
        return !this.domainFilterDb.filter(domain);
    }

    async hasEducationalInstitutionSuffix(email: string): Promise<boolean> {
        const { domain } = this.parseMail(email);

        if (await this.checkSwotJsForEducationalInstitutionSuffix(domain)) {
            return true;
        }
        return this.checkDBForEducationalInstitutionSuffix(domain);
    }

    protected async checkDBForEducationalInstitutionSuffix(domain: string): Promise<boolean> {
        const entries = await this.eduDomainDb.readEducationalInstitutionDomains();
        const domains = entries.map((entry) => entry.domain);
        return domains.some((d) => domain === d);
    }

    protected async checkSwotJsForEducationalInstitutionSuffix(email: string): Promise<boolean> {
        const swotJs = await this.swotJsPromise;
        return !!swotJs.check(email);
    }

    protected parseMail(email: string): { user: string; domain: string } {
        const parts = email.split('@');
        if (parts.length !== 2) {
            throw new Error('Invalid E-Mail address: ' + email);
        }
        return { user: parts[0], domain: parts[1].toLowerCase() };
    }

    protected initSwotJs(): Promise<any> {
        return new Promise((resolve, reject) => {
            const swotCallback = () => resolve(result);
            const result = new SwotJs(swotCallback);
        });
    }
}
