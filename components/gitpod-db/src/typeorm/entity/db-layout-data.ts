/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity } from 'typeorm';

import { LayoutData } from '@gitpod/gitpod-protocol';
import { Transformer } from '../transformer';
import { TypeORM } from '../typeorm';

@Entity()
export class DBLayoutData implements LayoutData {
  @PrimaryColumn(TypeORM.WORKSPACE_ID_COLUMN_TYPE)
  workspaceId: string;

  @Column({
    type: 'timestamp',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
    transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
  })
  lastUpdatedTime: string;

  @Column()
  layoutData: string;
}
