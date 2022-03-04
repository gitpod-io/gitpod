/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";

import { AccountEntry, AccountEntryKind } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { TypeORM } from "../../typeorm/typeorm";
import { Transformer } from "../../typeorm/transformer";

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBAccountEntry implements AccountEntry {

    @PrimaryColumn("uuid")
    uid: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @Column('double')
    amount: number;

    @Column()
    date: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    expiryDate?: string;

    @Column({
        type: 'char',
        length: 7
    })
    kind: AccountEntryKind

    @Column({
        type: 'simple-json',
        nullable: true
    })
    description?: object;

    @Column({
        type: 'char',
        length: 36,
        nullable: true
    })
    creditId?: string;
}