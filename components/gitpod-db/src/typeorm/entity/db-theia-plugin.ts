/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity } from 'typeorm';
import { TypeORM } from '../typeorm';
import { TheiaPlugin } from '@gitpod/gitpod-protocol';
import { Transformer } from '../transformer';

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBTheiaPlugin implements TheiaPlugin {
  @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
  id: string;

  @Column()
  pluginName: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  pluginId?: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  userId?: string;

  @Column()
  bucketName: string;

  @Column()
  path: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  hash?: string;

  @Column()
  state: TheiaPlugin.State;
}
