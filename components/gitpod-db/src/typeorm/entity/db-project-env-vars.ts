/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Entity, Column } from 'typeorm';
import { TypeORM } from '../typeorm';
import { ProjectEnvVarWithValue } from '@gitpod/gitpod-protocol';
import { Transformer } from '../transformer';
import { encryptionService } from '../user-db-impl';

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBProjectEnvVar implements ProjectEnvVarWithValue {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    // `projectId` is part of the primary key for safety reasons: This way it's impossible that a user
    // (maliciously or by accident) sends us an environment variable that has the same private key (`id`)
    // as the environment variable from another project.
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    projectId: string;

    @Column()
    name: string;

    @Column({
        type: 'simple-json',
        transformer: Transformer.compose(
            Transformer.SIMPLE_JSON([]),
            Transformer.encrypted(() => encryptionService),
        ),
    })
    value: string;

    @Column()
    censored: boolean;

    @Column('varchar')
    creationTime: string;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
