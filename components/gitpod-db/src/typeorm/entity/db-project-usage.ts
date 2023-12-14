/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
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
}
