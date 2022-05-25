/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";

import { VolumeSnapshot } from "@gitpod/gitpod-protocol";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";

@Entity()
@Index("ind_dbsync", ["creationTime"]) // DBSync
export class DBVolumeSnapshot implements VolumeSnapshot {
    @PrimaryColumn(TypeORM.WORKSPACE_ID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.WORKSPACE_ID_COLUMN_TYPE)
    @Index()
    workspaceId: string;

    @Column({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    creationTime: string;

    @Column("varchar")
    volumeHandle: string;
}
