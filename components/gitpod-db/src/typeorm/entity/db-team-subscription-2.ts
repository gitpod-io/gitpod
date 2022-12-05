/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";

import { TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";

import { TypeORM } from "../../typeorm/typeorm";
import { Transformer } from "../../typeorm/transformer";

@Entity()
@Index("ind_team_paymentReference", ["teamId", "paymentReference"])
@Index("ind_team_startdate", ["teamId", "startDate"])
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBTeamSubscription2 implements TeamSubscription2 {
    @PrimaryColumn("uuid")
    id: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    teamId: string;

    @Column()
    paymentReference: string;

    @Column()
    startDate: string;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    endDate?: string;

    @Column()
    planId: string;

    @Column("int")
    quantity: number;

    @Column({
        default: "",
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    cancellationDate?: string;

    @Column({
        default: true,
    })
    excludeFromMoreResources: boolean;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
