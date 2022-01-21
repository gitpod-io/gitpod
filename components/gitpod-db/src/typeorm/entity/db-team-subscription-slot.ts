/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { TeamSubscriptionSlot, AssigneeIdentifier } from '@gitpod/gitpod-protocol/lib/team-subscription-protocol';
import { TypeORM } from '../../typeorm/typeorm';
import { Transformer } from '../../typeorm/transformer';
import { PrimaryColumn, Entity, Column, Index } from 'typeorm';

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBTeamSubscriptionSlot implements TeamSubscriptionSlot {
  @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
  id: string;

  @Column(TypeORM.UUID_COLUMN_TYPE)
  @Index('ind_tsid')
  teamSubscriptionId: string;

  @Column({
    ...TypeORM.UUID_COLUMN_TYPE,
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  assigneeId?: string;

  @Column({
    ...TypeORM.UUID_COLUMN_TYPE,
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  subscriptionId?: string;

  @Column({
    type: 'simple-json',
    nullable: true,
  })
  assigneeIdentifier?: AssigneeIdentifier;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  cancellationDate?: string;
}
