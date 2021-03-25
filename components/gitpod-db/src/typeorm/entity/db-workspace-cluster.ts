/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Column, Entity, Index } from "typeorm";
import { WorkspaceCluster, WorkspaceClusterState } from "@gitpod/gitpod-protocol/lib/workspace-cluster";

@Entity()
export class DBWorkspaceCluster implements WorkspaceCluster {
    @PrimaryColumn()
    name: string;

    @Column({
        type: "varchar",
        length: 255,
    })
    url: string;

    @Column({
        type: "blob",
        nullable: true,
        transformer: {
            to(value: any): any {
                console.log("TO DB: " + JSON.stringify(value));
                if (!value) {
                    // map ["", null, undefined] -> null
                    return null;
                }
                return value;
            },
            from(value: any): any {
                console.log("FROM DB: " + JSON.stringify(value));
                if (!value) {
                    // map ["", null, undefined] -> undefined
                    return undefined;
                }
                if (Buffer.isBuffer(value) && (value as Buffer).length === 0) {
                    // TypeORM seems to map MySQL 'NULL' to an empty buffer. We translate to 'undefined' here.
                    return undefined;
                }
                return value;
            }
        }
    })
    certificate?: string;

    @Index("ind_state")
    @Column({
        type: "char",
        length: 20,
    })
    state: WorkspaceClusterState;

    @Column()
    score: number;

    @Column()
    maxScore: number;

    @Index("ind_controller")
    @Column({
        type: "char",
        length: 20,
    })
    controller: string;
}