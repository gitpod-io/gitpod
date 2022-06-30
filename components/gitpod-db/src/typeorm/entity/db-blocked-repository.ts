/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { BlockedRepository } from "@gitpod/gitpod-protocol/src/blocked-repositories-protocol";
import { Entity, Column, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class DBBlockedRepository implements BlockedRepository {
    @PrimaryGeneratedColumn()
    id: number;

    @Column("varchar")
    urlRegexp: string;

    @Column()
    blockUser: boolean;

    @CreateDateColumn()
    createdAt: string;

    @UpdateDateColumn()
    updatedAt: string;

    @DeleteDateColumn()
    deletedAt: string;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
