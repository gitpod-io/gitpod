/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TypeORM } from '@gitpod/gitpod-db';
import { DBOAuth2AuthCodeEntry } from '@gitpod/gitpod-db/lib/typeorm/entity/db-oauth2-auth-code';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { OAuthAuthCode, OAuthAuthCodeRepository, OAuthClient, OAuthScope, OAuthUser } from "@jmondi/oauth2-server";
import { inject, injectable } from "inversify";
import { EntityManager, Repository } from "typeorm";
import { expiryInFuture } from './repository';

@injectable()
class DBAuthCodeRepository implements OAuthAuthCodeRepository {

    @inject(TypeORM) protected readonly typeorm: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    async getOauth2AuthCodeRepo(): Promise<Repository<DBOAuth2AuthCodeEntry>> {
        return (await this.getEntityManager()).getRepository<DBOAuth2AuthCodeEntry>(DBOAuth2AuthCodeEntry);
    }

    public async getByIdentifier(authCodeCode: string): Promise<OAuthAuthCode> {
        log.info(`getByIdentifier ${authCodeCode}`);
        const authCodeRepo = await this.getOauth2AuthCodeRepo();
        const authCode = await authCodeRepo.findOne({ code: authCodeCode });
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
            authCode.expiresAt = new Date(0);
            return this.persist(authCode);
        }
    }
}

export const dbAuthCodeRepository = new DBAuthCodeRepository();