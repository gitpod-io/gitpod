/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";
import { TypeORM } from "../typeorm";
import { AuditLog } from "@gitpod/gitpod-protocol/lib/audit-log";
import { Transformer } from "../transformer";

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

    @Column({
        type: "text", // it's JSON on DB, but we aim to disable the Typeorm-internal JSON-transformer we can't control and can't disable otherwise
        transformer: Transformer.SIMPLE_JSON_CUSTOM(
            [],
            function (key: string, value: any) {
                if (typeof value === "bigint") {
                    return `bigint:${value.toString()}`;
                }
                return value;
            },
            function (key: string, value: any) {
                if (typeof value === "string" && value.startsWith("bigint:")) {
                    const v: string = value.substring(7);
                    return BigInt(v);
                }
                return value;
            },
        ),
    })
    args: object[];
}
