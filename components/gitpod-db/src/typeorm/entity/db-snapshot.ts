/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from 'typeorm';

import { Snapshot, SnapshotState } from '@gitpod/gitpod-protocol';
import { TypeORM } from '../typeorm';
import { Transformer } from '../transformer';

@Entity()
@Index('ind_dbsync', ['creationTime']) // DBSync
export class DBSnapshot implements Snapshot {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column({
        type: 'timestamp',
        precision: 6,
        default: () => 'CURRENT_TIMESTAMP(6)',
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    creationTime: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    availableTime?: string;

    @Column(TypeORM.WORKSPACE_ID_COLUMN_TYPE)
    @Index('ind_originalWorkspaceId')
    originalWorkspaceId: string;

    @Column()
    bucketId: string;

    @Column({ nullable: true })
    layoutData?: string;

    @Column({
        // because we introduced this as an afterthought the default is 'available'
        default: <SnapshotState>'available',
    })
    @Index('ind_state')
    state: SnapshotState;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    message?: string;
}
