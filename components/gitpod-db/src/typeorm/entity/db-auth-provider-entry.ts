/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";
import { TypeORM } from "../typeorm";
import { AuthProviderEntry, OAuth2Config } from "@gitpod/gitpod-protocol";
import { Transformer } from "../transformer";
import { getGlobalEncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";

@Entity()
export class DBAuthProviderEntry implements AuthProviderEntry {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column()
    ownerId: string;

    @Column()
    organizationId?: string;

    @Column("varchar")
    status: AuthProviderEntry.Status;

    @Column()
    host: string;

    @Column("varchar")
    type: AuthProviderEntry.Type;

    @Column({
        type: "simple-json",
        transformer: Transformer.compose(
            Transformer.SIMPLE_JSON([]),
            Transformer.encrypted(getGlobalEncryptionService),
        ),
    })
    oauth: OAuth2Config;

    @Index("ind_oauthRevision")
    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    oauthRevision?: string;

    @Column()
    deleted?: boolean;
}
