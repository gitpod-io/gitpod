/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity } from 'typeorm';
import { TypeORM } from '../typeorm';
import { UserEnvVar } from '@gitpod/gitpod-protocol';
import { Transformer } from '../transformer';
import { encryptionService } from '../user-db-impl';

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBUserEnvVar implements UserEnvVar {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    // userId must be part of the primary key as otherwise malicious users could overwrite
    // the value of arbitrary user env vars because we use TypeORM.save. If the userId were
    // not part of the primary key, this save call would overwrite env vars with arbitrary IDs,
    // allowing an attacker to steal other users environment variables.
    // But userId is part of the primary key and we ensure that users can only overwrite/set variables
    // that belong to them.
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @Column()
    name: string;

    @Column({
        type: 'simple-json',
        // Relies on the initialization of the var in UserDbImpl
        transformer: Transformer.compose(
            Transformer.SIMPLE_JSON([]),
            Transformer.encrypted(() => encryptionService),
        ),
    })
    value: string;

    @Column()
    repositoryPattern: string;

    @Column()
    deleted?: boolean;
}
