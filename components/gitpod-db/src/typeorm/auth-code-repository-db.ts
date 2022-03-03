/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    DateInterval,
    OAuthAuthCode,
    OAuthAuthCodeRepository,
    OAuthClient,
    OAuthScope,
    OAuthUser,
} from '@jmondi/oauth2-server';
import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { EntityManager, Repository } from 'typeorm';
import { DBOAuthAuthCodeEntry } from './entity/db-oauth-auth-code';
import { TypeORM } from './typeorm';

const expiryInFuture = new DateInterval('5m');

@injectable()
export class AuthCodeRepositoryDB implements OAuthAuthCodeRepository {
    @inject(TypeORM)
    private readonly typeORM: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeORM.getConnection()).manager;
    }

    async getOauthAuthCodeRepo(): Promise<Repository<DBOAuthAuthCodeEntry>> {
        return (await this.getEntityManager()).getRepository<DBOAuthAuthCodeEntry>(DBOAuthAuthCodeEntry);
    }

    public async getByIdentifier(authCodeCode: string): Promise<OAuthAuthCode> {
        const authCodeRepo = await this.getOauthAuthCodeRepo();
        let authCodes = await authCodeRepo.find({ code: authCodeCode });
        authCodes = authCodes.filter((te) => new Date(te.expiresAt).getTime() > Date.now());
        const authCode = authCodes.length > 0 ? authCodes[0] : undefined;
        if (!authCode) {
            throw new Error(`authentication code not found`);
        }
        return authCode;
    }
    public issueAuthCode(client: OAuthClient, user: OAuthUser | undefined, scopes: OAuthScope[]): OAuthAuthCode {
        const code = crypto.randomBytes(30).toString('hex');
        // NOTE: caller (@jmondi/oauth2-server) is responsible for adding the remaining items, PKCE params, redirect URL, etc
        return {
            code: code,
            user,
            client,
            expiresAt: expiryInFuture.getEndDate(),
            scopes: scopes,
        };
    }
    public async persist(authCode: OAuthAuthCode): Promise<void> {
        const authCodeRepo = await this.getOauthAuthCodeRepo();
        authCodeRepo.save(authCode);
    }
    public async isRevoked(authCodeCode: string): Promise<boolean> {
        const authCode = await this.getByIdentifier(authCodeCode);
        return Date.now() > authCode.expiresAt.getTime();
    }
    public async revoke(authCodeCode: string): Promise<void> {
        const authCode = await this.getByIdentifier(authCodeCode);
        if (authCode) {
            // Set date to earliest timestamp that MySQL allows
            authCode.expiresAt = new Date(1000);
            return this.persist(authCode);
        }
    }
}
