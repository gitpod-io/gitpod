/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";
import { WorkspaceInstanceMetrics } from "@gitpod/gitpod-protocol";

@Entity()
export class DBWorkspaceInstanceMetrics {
    @PrimaryColumn()
    instanceId: string;

    @Column("json", { nullable: true })
    metrics?: WorkspaceInstanceMetrics;

    @Column()
    _lastModified: Date;
}
