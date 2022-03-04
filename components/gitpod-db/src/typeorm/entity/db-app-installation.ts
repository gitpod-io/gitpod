/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Column, PrimaryColumn, Entity, Index } from "typeorm";
import { AppInstallation, AppInstallationPlatform, AppInstallationState } from "@gitpod/gitpod-protocol";
import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";

@Entity()
@Index("ind_dbsync", ["creationTime"])   // DBSync
export class DBAppInstallation implements AppInstallation {
    @PrimaryColumn()
    platform: AppInstallationPlatform;

    @PrimaryColumn()
    installationID: string;

    @Column({
        ...TypeORM.UUID_COLUMN_TYPE,
        nullable: true
    })
    ownerUserID?: string;

    @Column()
    platformUserID?: string;

    @PrimaryColumn()
    state: AppInstallationState;

    @Column({
        type: 'timestamp',
        precision: 6,
        default: () => 'CURRENT_TIMESTAMP(6)',
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP
    })
    creationTime: string;

    @Column({
        type: 'timestamp',
        precision: 6,
        default: () => 'CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP
    })
    lastUpdateTime: string;

}
