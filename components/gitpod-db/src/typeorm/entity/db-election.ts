/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Column, Entity, PrimaryColumn } from "typeorm";
import { Transformer } from "../transformer";

@Entity("d_b_election")
export class DBElection {
    @PrimaryColumn()
    electionName: string;

    @PrimaryColumn()
    leaderName: string;

    @Column({
        type: "timestamp",
        precision: 6,
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    updatedAt?: string;
}
