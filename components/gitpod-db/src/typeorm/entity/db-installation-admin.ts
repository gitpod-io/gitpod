/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { InstallationAdmin, InstallationAdminSettings } from '@gitpod/gitpod-protocol';
import { Entity, Column, PrimaryColumn } from 'typeorm';
import { TypeORM } from '../typeorm';

@Entity()
export class DBInstallationAdmin implements InstallationAdmin {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column('simple-json')
    settings: InstallationAdminSettings;
}
