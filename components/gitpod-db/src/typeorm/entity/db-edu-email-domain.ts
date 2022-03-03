/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, PrimaryColumn } from 'typeorm';
import { EduEmailDomain } from '@gitpod/gitpod-protocol';

@Entity('d_b_edu_email_domain')
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBEduEmailDomain implements EduEmailDomain {
    @PrimaryColumn()
    domain: string;
}
