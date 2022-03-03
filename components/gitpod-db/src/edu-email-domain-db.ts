/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { EduEmailDomain } from '@gitpod/gitpod-protocol';

export const EduEmailDomainDB = Symbol('EduEmailDomainDB');
export interface EduEmailDomainDB {
    storeDomainEntry(domain: EduEmailDomain): Promise<void>;

    readEducationalInstitutionDomains(): Promise<EduEmailDomain[]>;
}
