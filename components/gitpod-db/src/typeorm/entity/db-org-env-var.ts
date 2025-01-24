/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Entity, Column } from "typeorm";
import { TypeORM } from "../typeorm";
import { OrgEnvVarWithValue } from "@gitpod/gitpod-protocol";
import { Transformer } from "../transformer";
import { getGlobalEncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBOrgEnvVar implements OrgEnvVarWithValue {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    // `orgId` is part of the primary key for safety reasons: This way it's impossible that a user
    // (maliciously or by accident) sends us an environment variable that has the same private key (`id`)
    // as the environment variable from another project.
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    orgId: string;

    @Column()
    name: string;

    @Column({
        type: "simple-json",
        transformer: Transformer.compose(
            Transformer.SIMPLE_JSON([]),
            Transformer.encrypted(getGlobalEncryptionService),
        ),
    })
    value: string;

    @Column({
        type: "varchar",
        length: 36,
    })
    creationTime: string;
}
