/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from 'typeorm';

import { PrebuiltWorkspace, PrebuiltWorkspaceState } from '@gitpod/gitpod-protocol';
import { TypeORM } from '../typeorm';
import { Transformer } from '../transformer';

@Entity()
@Index('ind_ac4a9aece1a455da0dc653888f', ['cloneURL', 'commit'])
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBPrebuiltWorkspace implements PrebuiltWorkspace {
  @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
  id: string;

  @Column()
  cloneURL: string;

  @Column()
  commit: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  @Index('ind_projectId')
  projectId?: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  branch?: string;

  @Column()
  @Index('ind_6a04b7005d5ad0e664725f9f17')
  state: PrebuiltWorkspaceState;

  @Column({
    type: 'timestamp',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
  })
  creationTime: string;

  @Column(TypeORM.WORKSPACE_ID_COLUMN_TYPE)
  @Index('ind_buildWorkspaceId')
  buildWorkspaceId: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  snapshot?: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  error?: string;
}
