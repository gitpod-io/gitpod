/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PrimaryColumn, Entity, Column } from 'typeorm';

@Entity()
export class DBRepositoryWhiteList {
    static readonly MIN_FEATURED_REPOSITORY_PRIO = 0;

    @PrimaryColumn({
        type: 'char',
        length: 128,
    })
    url: string;

    @Column({
        type: 'text',
    })
    description?: string;

    @Column({
        default: 10,
    })
    priority?: number;
}
