/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, PrimaryColumn } from "typeorm";
import { EduEmailDomain } from "@gitpod/gitpod-protocol";

@Entity("d_b_edu_email_domain")
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBEduEmailDomain implements EduEmailDomain {
    @PrimaryColumn()
    domain: string;
}
