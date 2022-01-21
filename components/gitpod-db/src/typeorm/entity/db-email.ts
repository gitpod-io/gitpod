/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { EMail, EMailParameters } from '@gitpod/gitpod-protocol';
import { TypeORM } from '../../typeorm/typeorm';
import { Transformer } from '../../typeorm/transformer';

@Entity('d_b_email')
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
@Index('ind_campaignId_userId', ['campaignId', 'userId'])
export class DBEmail implements EMail {
  @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
  uid: string;

  @Column({
    length: 30,
  })
  campaignId: string;

  @Column(TypeORM.UUID_COLUMN_TYPE)
  userId: string;

  @Column()
  recipientAddress: string;

  @Column('json')
  params: EMailParameters;

  @Column()
  scheduledInternalTime: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  scheduledSendgridTime?: string;

  @Column({
    default: '',
    transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
  })
  error?: string;
}
