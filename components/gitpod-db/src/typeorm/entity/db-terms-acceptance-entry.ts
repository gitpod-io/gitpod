/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TermsAcceptanceEntry } from '@gitpod/gitpod-protocol';

/**
 * A single entry per User is created/managed over time.
 *
 * The revision of terms is provided by the current deployment of `components/server`.
 */
@Entity()
// on DB but not Typeorm: @Index("ind_userId", ["userId"])   // DBSync
export class DBTermsAcceptanceEntry implements TermsAcceptanceEntry {
  @PrimaryColumn()
  userId: string;

  @Column()
  termsRevision: string;

  @Column()
  acceptionTime: string;
}
