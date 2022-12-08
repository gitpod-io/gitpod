/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamMemberRole } from "@gitpod/gitpod-protocol";
import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { Transformer } from "../transformer";
import { TypeORM } from "../typeorm";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBTeamMembership {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    @Index("ind_teamId")
    teamId: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    @Index("ind_userId")
    userId: string;

    @Column("varchar")
    role: TeamMemberRole;

    @Column("varchar")
    creationTime: string;

    @Column({
        ...TypeORM.UUID_COLUMN_TYPE,
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    subscriptionId?: string;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
