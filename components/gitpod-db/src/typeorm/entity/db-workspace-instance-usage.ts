/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";
import { WorkspaceType } from "@gitpod/gitpod-protocol";

@Entity()
export class DBWorkspaceInstanceUsage {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    instanceId: string;

    @Column("varchar")
    @Index("ind_attributionId")
    attributionId: string;

    @Column("varchar")
    userId: string;

    @Column("varchar")
    workspaceId: string;

    @Column("varchar")
    projectId: string;

    @Column("varchar")
    workspaceType: WorkspaceType;

    @Column("varchar")
    workspaceClass: string;

    @Column({
        type: "timestamp",
        precision: 6,
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    @Index("ind_startedAt")
    startedAt: string;

    @Column({
        type: "timestamp",
        precision: 6,
        nullable: true,
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    @Index("ind_stoppedAt")
    stoppedAt: string;

    @Column("double")
    creditsUsed: number;

    @Column()
    generationId: number;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
