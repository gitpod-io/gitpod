/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, Column, PrimaryColumn } from "typeorm";

import { TypeORM } from "../../typeorm/typeorm";

@Entity()
// on DB but not Typeorm: @Index("ind_dbsync", ["_lastModified"])   // DBSync
export class DBProjectUsage {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    projectId: string;

    @Column("varchar")
    lastWebhookReceived: string;

    @Column("varchar")
    lastWorkspaceStart: string;

    // This column triggers the db-sync deletion mechanism. It's not intended for public consumption.
    @Column()
    deleted: boolean;
}
