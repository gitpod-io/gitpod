/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInstanceUser } from '@gitpod/gitpod-protocol';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TypeORM } from '../typeorm';
import { Transformer } from '../transformer';

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBWorkspaceInstanceUser implements WorkspaceInstanceUser {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    instanceId: string;

    @PrimaryColumn()
    userId: string;

    @Column({
        type: 'timestamp',
        precision: 6,
        default: () => 'CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    lastSeen: string;

    @Column({
        default: false,
    })
    wasClosed: boolean;
}
