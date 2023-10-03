/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";

import { TokenEntry, Token } from "@gitpod/gitpod-protocol";

import { Transformer } from "../transformer";
import { TypeORM } from "../typeorm";
import { getGlobalEncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBTokenEntry implements TokenEntry {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    uid: string;

    @Column("varchar")
    authProviderId: string;

    @Column("varchar")
    authId: string;

    @Index("ind_expiryDate")
    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    expiryDate?: string;

    @Column()
    refreshable?: boolean;

    @Column({
        type: "simple-json",
        transformer: Transformer.compose(
            Transformer.SIMPLE_JSON([]),
            Transformer.encrypted(getGlobalEncryptionService),
        ),
    })
    token: Token;

    @Column()
    deleted?: boolean;
}
