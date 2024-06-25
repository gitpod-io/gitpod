/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";
import { TypeORM } from "../typeorm";
import { AuditLog } from "@gitpod/gitpod-protocol/lib/audit-log";

@Entity()
export class DBAuditLog implements AuditLog {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column("varchar")
    timestamp: string;

    @Column("varchar")
    organizationId: string;

    @Column("varchar")
    actorId: string;

    @Column("varchar")
    action: string;

    @Column("simple-json")
    args: object[];
}
