/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Column, Entity, PrimaryColumn } from "typeorm";
import { Transformer } from "../transformer";
import { TypeORM } from "../typeorm";
import { encryptionService } from "../user-db-impl";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBLinkedInToken {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @Column({
        type: "simple-json",
        transformer: Transformer.compose(
            Transformer.SIMPLE_JSON([]),
            // Relies on the initialization of the var in UserDbImpl
            Transformer.encrypted(() => encryptionService),
        ),
    })
    token: { token: string };
}
