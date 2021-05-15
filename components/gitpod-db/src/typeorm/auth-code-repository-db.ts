/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { DateInterval, OAuthAuthCode, OAuthAuthCodeRepository, OAuthClient, OAuthScope, OAuthUser } from "@jmondi/oauth2-server";
// import * as crypto from 'crypto';
import { inject, injectable } from "inversify";
import { EntityManager, Repository } from "typeorm";
import { DBOAuth2AuthCodeEntry } from './entity/db-oauth2-auth-code';
import { TypeORM } from './typeorm';

const expiryInFuture = new DateInterval("1h");

@injectable()
export class AuthCodeRepositoryDB implements OAuthAuthCodeRepository {

    @inject(TypeORM)
    private readonly typeORM: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeORM.getConnection()).manager;
    }

    async getOauth2AuthCodeRepo(): Promise<Repository<DBOAuth2AuthCodeEntry>> {
        return (await this.getEntityManager()).getRepository<DBOAuth2AuthCodeEntry>(DBOAuth2AuthCodeEntry);
    }

    public async getByIdentifier(authCodeCode: string): Promise<OAuthAuthCode> {
        log.info(`getByIdentifier ${authCodeCode}`);
        const authCodeRepo = await this.getOauth2AuthCodeRepo();
        const authCodes = await authCodeRepo.find({ code: authCodeCode });
        log.info(`getByIdentifier pre: ${JSON.stringify(authCodes)}`);
        authCodes.filter(te => (new Date(te.expiresAt)).getTime() > Date.now());
        log.info(`getByIdentifier post: ${JSON.stringify(authCodes)}`);
        const authCode = authCodes.length > 0 ? authCodes[0] : undefined;
        return new Promise<OAuthAuthCode>((resolve, reject) => {
            if (authCode) {
                log.info(`getByIdentifier found ${authCodeCode} ${JSON.stringify(authCode)}`);
                resolve(authCode);
            } else {
                log.info(`getByIdentifier failed to find ${authCodeCode}`);
                reject(`authentication code not found`);
            }
        });
    }
    public issueAuthCode(client: OAuthClient, user: OAuthUser | undefined, scopes: OAuthScope[]): OAuthAuthCode {
        const code = 'some secret code'; // crypto.randomBytes(30).toString('hex');
        log.info(`issueAuthCode: ${JSON.stringify(client)}, ${JSON.stringify(user)}, ${JSON.stringify(scopes)}, ${code}`);
        return {
            code: code,
            user,
            client,
            redirectUri: "",
            codeChallenge: undefined,
            codeChallengeMethod: undefined,
            expiresAt: expiryInFuture.getEndDate(),
            scopes: [],
        };
    }
    public async persist(authCode: OAuthAuthCode): Promise<void> {
        log.info(`persist auth ${JSON.stringify(authCode)}`);
        const authCodeRepo = await this.getOauth2AuthCodeRepo();
        authCodeRepo.save(authCode);
    }
    public async isRevoked(authCodeCode: string): Promise<boolean> {
        log.info(`isRevoked auth ${authCodeCode}`);
        const authCode = await this.getByIdentifier(authCodeCode);
        log.info(`isRevoked authCode ${authCodeCode} ${JSON.stringify(authCode)}`);
        return Date.now() > authCode.expiresAt.getTime();
    }
    public async revoke(authCodeCode: string): Promise<void> {
        log.info(`revoke auth ${authCodeCode}`);
        const authCode = await this.getByIdentifier(authCodeCode);
        if (authCode) {
            log.info(`revoke auth ${authCodeCode} ${JSON.stringify(authCode)}`);
            // Set date to earliest timestamp that MySQL allows
            authCode.expiresAt = new Date(1000);
            return this.persist(authCode);
        }
    }
}
