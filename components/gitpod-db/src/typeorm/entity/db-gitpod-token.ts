/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodToken, GitpodTokenType } from "@gitpod/gitpod-protocol";
import { Column, Entity, PrimaryColumn } from "typeorm";
import { Transformer } from "../transformer";
import { TypeORM } from "../typeorm";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBGitpodToken implements GitpodToken {
    @PrimaryColumn("varchar")
    tokenHash: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    name?: string;

    @Column({ type: "int" })
    type: GitpodTokenType;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @Column("simple-array")
    scopes: string[];

    @Column()
    created: string;
}
