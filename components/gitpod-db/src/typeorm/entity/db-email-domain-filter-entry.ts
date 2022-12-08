/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";
import { EmailDomainFilterEntry } from "@gitpod/gitpod-protocol";

@Entity("d_b_email_domain_filter")
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBEmailDomainFilterEntry implements EmailDomainFilterEntry {
    @PrimaryColumn()
    domain: string;

    @Column()
    negative: boolean;
}
