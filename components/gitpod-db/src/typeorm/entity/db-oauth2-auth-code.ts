/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { OAuthAuthCode, OAuthScope, OAuthClient } from "@jmondi/oauth2-server";
import { DBUser } from "./db-user";

@Entity({name: 'd_b_oauth2_auth_code_entry'})
export class DBOAuth2AuthCodeEntry implements OAuthAuthCode {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: "varchar",
        length: 1024,
    })
    code: string;

    @Column({
        type: "varchar",
        length: 1024,
    })
    redirectURI: string;

    @Column({
        type: "varchar",
        length: 128,
    })
    codeChallenge: string
    
    @Column({
        type: "varchar",
        length: 10,
    })
    codeChallengeMethod: string

    @Column({
        type: 'timestamp', 
        precision: 6
    })
    expiresAt: Date;

    @ManyToOne(type => DBUser)
    @JoinColumn()
    user: DBUser

    @Column({
        type: 'simple-json',
        nullable: false,
    })
    client: OAuthClient

    @Column("varchar")
    scopes: OAuthScope[]
}