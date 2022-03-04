/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity } from "typeorm";

import { TypeORM } from "../typeorm";
import { Transformer } from "../transformer";

@Entity()
export class DBLicenseKey {

    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column({
        type: 'timestamp',
        precision: 6,
        default: () => 'CURRENT_TIMESTAMP(6)',
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP
    })
    installationTime: string;

    @Column()
    key: string;

}