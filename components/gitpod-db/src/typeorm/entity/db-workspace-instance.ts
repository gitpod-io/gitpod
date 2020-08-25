/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Index, Entity } from "typeorm";

import { WorkspaceInstance, WorkspaceInstanceStatus, WorkspaceInstancePhase, WorkspaceInstanceConfiguration } from "@gitpod/gitpod-protocol";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";


@Entity()
@Index("ind_find_wsi_ws_in_period", ['workspaceId', 'startedTime', 'stoppedTime'])   // findInstancesWithWorkspaceInPeriod
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBWorkspaceInstance implements WorkspaceInstance {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    @Index()
    workspaceId: string;

    @Column()
    region: string;

    @Column()
    creationTime: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    startedTime?: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    deployedTime?: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    stoppedTime?: string;

    @Column()
    ideUrl: string;

    @Column()
    workspaceImage: string;

    @Column('json')
    status: WorkspaceInstanceStatus;

    /**
     * This field is a databse-only copy of status.phase for the sole purpose of creating indexes on it.
     * Is replicated inside workspace-db-impl.ts/storeInstance.
     */
    @Column()
    @Index("ind_phasePersisted")
    phasePersisted: WorkspaceInstancePhase;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted?: boolean;

    @Column({
        type: 'simple-json',
        nullable: true,
    })
    configuration?: WorkspaceInstanceConfiguration;

}