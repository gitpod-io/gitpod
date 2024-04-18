/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";
import { Transformer } from "../transformer";

@Entity()
export class DBBlockedRepository implements BlockedRepository {
    @PrimaryGeneratedColumn()
    id: number;

    @Column("varchar")
    urlRegexp: string;

    @Column()
    blockUser: boolean;

    @Column()
    blockFreeUsage: boolean;

    @Column({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6)",
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    createdAt: string;

    @Column({
        type: "timestamp",
        precision: 6,
        default: () => "CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)",
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP,
    })
    updatedAt: string;

    // This column triggers the periodic deleter deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
