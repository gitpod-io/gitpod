/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity()
export class DBLongRunningMigration {
    @PrimaryColumn()
    name: string;

    @Column({ type: "timestamp", precision: 6 })
    firstRun: Date;

    @Column({ type: "timestamp", precision: 6 })
    lastRun: Date;

    @Column()
    completed: boolean;
}
