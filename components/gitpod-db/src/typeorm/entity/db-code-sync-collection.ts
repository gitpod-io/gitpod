/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, PrimaryColumn } from "typeorm";
import { TypeORM } from "../typeorm";

@Entity()
// on DB but not Typeorm: @Index("ind_dbsync", ["_lastModified"])   // DBSync
export class DBCodeSyncCollection {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    collection: string;
}
