/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { OAuthAuthCode, OAuthClient, OAuthScope } from '@jmondi/oauth2-server';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Transformer } from '../transformer';
import { DBUser } from './db-user';

@Entity({ name: 'd_b_oauth_auth_code_entry' })
export class DBOAuthAuthCodeEntry implements OAuthAuthCode {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: 'varchar',
        length: 1024,
    })
    code: string;

    @Column({
        type: 'varchar',
        length: 1024,
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED,
    })
    redirectURI?: string;

    @Column({
        type: 'varchar',
        length: 128,
    })
    codeChallenge: string;

    @Column({
        type: 'varchar',
        length: 10,
    })
    codeChallengeMethod: string;

    @Column({
        type: 'timestamp',
        precision: 6,
    })
    expiresAt: Date;

    @ManyToOne((type) => DBUser)
    @JoinColumn()
    user: DBUser;

    @Column({
        type: 'simple-json',
        nullable: false,
    })
    client: OAuthClient;

    @Column({
        type: 'simple-json',
        nullable: false,
    })
    scopes: OAuthScope[];
}
