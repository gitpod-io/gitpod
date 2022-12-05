/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EduEmailDomain } from "@gitpod/gitpod-protocol";

export const EduEmailDomainDB = Symbol("EduEmailDomainDB");
export interface EduEmailDomainDB {
    storeDomainEntry(domain: EduEmailDomain): Promise<void>;

    readEducationalInstitutionDomains(): Promise<EduEmailDomain[]>;
}
