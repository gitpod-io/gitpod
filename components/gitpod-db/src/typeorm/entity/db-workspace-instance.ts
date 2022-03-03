/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Index, Entity } from 'typeorm';

import {
    WorkspaceInstance,
    WorkspaceInstanceStatus,
    WorkspaceInstancePhase,
    WorkspaceInstanceConfiguration,
    ImageBuildInfo,
} from '@gitpod/gitpod-protocol';
import { TypeORM } from '../typeorm';
import { Transformer } from '../transformer';

@Entity()
@Index('ind_find_wsi_ws_in_period', ['workspaceId', 'startedTime', 'stoppedTime']) // findInstancesWithWorkspaceInPeriod
@Index('ind_phasePersisted_region', ['phasePersisted', 'region']) // findInstancesByPhaseAndRegion
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBWorkspaceInstance implements WorkspaceInstance {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.WORKSPACE_ID_COLUMN_TYPE)
    @Index()
    workspaceId: string;

    @Column()
    region: string;

    @Column()
    creationTime: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    startedTime?: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    deployedTime?: string;

    /**
     * StoppingTime is the time the workspace first entered the STOPPING phase, i.e.
     * began to shut down on the cluster.
     */
    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    stoppingTime?: string;

    /**
     * StoppedTime is the time the workspace entered the STOPPED phase, i.e.
     * was actually stopped on the cluster.
     */
    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
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
    @Index('ind_phasePersisted')
    phasePersisted: WorkspaceInstancePhase;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted?: boolean;

    @Column({
        type: 'simple-json',
        nullable: true,
    })
    configuration?: WorkspaceInstanceConfiguration;

    @Column('simple-json', { nullable: true })
    imageBuildInfo?: ImageBuildInfo;
}
