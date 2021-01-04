/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity } from "typeorm";
import { TypeORM } from "../typeorm";
import { AuthProviderEntry, OAuth2Config } from "@gitpod/gitpod-protocol";
import { Transformer } from "../transformer";
import { encryptionService } from "../user-db-impl";

@Entity()
export class DBAuthProviderEntry implements AuthProviderEntry {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column()
    ownerId: string;

    @Column('varchar')
    status: AuthProviderEntry.Status;

    @Column()
    host: string;

    @Column('varchar')
    type: AuthProviderEntry.Type;

    @Column({
        type: "simple-json",
        transformer: Transformer.compose(
            Transformer.SIMPLE_JSON([]),
            // Relies on the initialization of the var in UserDbImpl
            Transformer.encrypted(() => encryptionService)
        )
    })
    oauth: OAuth2Config;

    @Column()
    deleted?: boolean;
}
