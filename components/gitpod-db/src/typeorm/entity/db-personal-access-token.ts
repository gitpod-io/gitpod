/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";

import { TypeORM } from "../typeorm";

@Entity()
// PersonalAccessToken defines the DB model.
// It is primarily created by the Public API, when a user requests a token.
// We define it in the TypeORM model such that we can support authentication from server.
// We only use the model definition on Server to perform Reads, never writes to ensure the write path is consistent.
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBPersonalAccessToken {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column("varchar")
    userId: string;

    @Column("varchar")
    hash: string;

    @Column("varchar")
    name: string;

    @Column({
        type: "text",
        transformer: {
            to(value: any): any {
                if (!Array.isArray(value)) {
                    throw new Error(`Unknown scopes type when serializing ${value}`);
                }

                return value.join(",");
            },
            from(value: any): any {
                if (typeof value !== "string") {
                    throw new Error(`Unknown scope value ${value}`);
                }

                if (!value) {
                    return [];
                }

                return value.split(",");
            },
        },
    })
    scopes: string[];

    @Column("datetime")
    expirationTime: Date | null;

    @Column("datetime")
    createdAt: Date;

    @Column()
    deleted?: boolean;
}
