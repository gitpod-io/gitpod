/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";
import { CostCenter } from "@gitpod/gitpod-protocol";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBCostCenter implements CostCenter {
    @PrimaryColumn()
    id: string;

    @Column()
    spendingLimit: number;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
