/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity } from 'typeorm';
import { TypeORM } from '../typeorm';
import { OneTimeSecret } from '@gitpod/gitpod-protocol';
import { Transformer } from '../transformer';
import { encryptionService } from '../user-db-impl';

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBOneTimeSecret implements OneTimeSecret {
  @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
  id: string;

  @Column({
    type: 'simple-json',
    // Relies on the initialization of the var in OneTimeSecretDbImpl
    transformer: Transformer.compose(
      Transformer.SIMPLE_JSON([]),
      Transformer.encrypted(() => encryptionService),
    ),
  })
  value: string;

  @Column({
    type: 'timestamp',
    precision: 6,
  })
  expirationTime: string;

  @Column()
  deleted: boolean;
}
