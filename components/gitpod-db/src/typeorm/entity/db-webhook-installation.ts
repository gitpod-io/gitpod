/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { TypeORM } from "../typeorm";

@Entity()
export class DBWebhookInstallation {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    @Index()
    projectId: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    installerUserId: string;
}
