/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Column, Entity, PrimaryColumn } from "typeorm";
import { TypeORM } from "../typeorm";
import { LinkedInProfile } from "@gitpod/gitpod-protocol";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBLinkedInProfile {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @Column({
        type: "simple-json",
        nullable: false,
    })
    profile: LinkedInProfile;

    @Column("varchar")
    creationTime: string;
}
