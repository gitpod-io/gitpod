/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

import { TeamSubscription } from '@gitpod/gitpod-protocol/lib/team-subscription-protocol';

import { TypeORM } from '../../typeorm/typeorm';
import { Transformer } from '../../typeorm/transformer';

@Entity()
@Index('ind_user_paymentReference', ['userId', 'paymentReference'])
@Index('ind_user_startdate', ['userId', 'startDate'])
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBTeamSubscription implements TeamSubscription {
  @PrimaryColumn('uuid')
  id: string;

  @Column(TypeORM.UUID_COLUMN_TYPE)
  userId: string;

  @Column()
  paymentReference: string;

  @Column()
  startDate: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  endDate?: string;

  @Column()
  planId: string;

  @Column('int')
  quantity: number;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  cancellationDate?: string;

  @Column({
    default: false,
  })
  deleted?: boolean;
}
