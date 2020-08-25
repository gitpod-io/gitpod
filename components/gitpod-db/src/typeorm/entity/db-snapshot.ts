/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";

import { Snapshot } from "@gitpod/gitpod-protocol";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";

@Entity()
@Index("ind_dbsync", ["creationTime"])   // DBSync
export class DBSnapshot implements Snapshot {

    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column({
        type: 'timestamp',
        precision: 6,
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP
    })
    creationTime: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    @Index("ind_originalWorkspaceId")
    originalWorkspaceId: string;

    @Column()
    bucketId: string;

    @Column({ nullable: true })
    layoutData?: string;

}