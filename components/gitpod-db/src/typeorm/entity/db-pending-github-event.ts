/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Column, Entity, PrimaryColumn } from 'typeorm';
import { PendingGithubEvent } from '@gitpod/gitpod-protocol';
import { TypeORM } from '../typeorm';

@Entity()
export class DBPendingGithubEvent implements PendingGithubEvent {
    @PrimaryColumn(TypeORM.UUID_COLUMN_TYPE)
    id: string;

    @Column()
    githubUserId: string;

    @Column({ type: 'timestamp', precision: 6 })
    creationDate: Date;

    @Column()
    type: string;

    @Column()
    event: string;
}
