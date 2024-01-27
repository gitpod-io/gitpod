/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    DateInterval,
    OAuthAuthCode,
    OAuthAuthCodeRepository,
    OAuthClient,
    OAuthScope,
    OAuthUser,
} from "@jmondi/oauth2-server";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { inject, injectable } from "inversify";
import { EntityManager, Repository } from "typeorm";
import { DBOAuthAuthCodeEntry } from "./entity/db-oauth-auth-code";
import { TypeORM } from "./typeorm";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

const expiryInFuture = new DateInterval("5m");

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

    public async getByIdentifier(authCodeCode: string): Promise<DBOAuthAuthCodeEntry> {
        const authCodeRepo = await this.getOauthAuthCodeRepo();
        const qBuilder = authCodeRepo.createQueryBuilder("authCode").leftJoinAndSelect("authCode.user", "user");
        qBuilder.where("authCode.code = :code", { code: authCodeCode });
        let authCodes = await qBuilder.getMany();
        authCodes = authCodes.filter((te) => new Date(te.expiresAt).getTime() > Date.now());
        const authCode = authCodes.length > 0 ? authCodes[0] : undefined;
        if (!authCode) {
            throw new Error(`authentication code not found`);
        }
        return authCode;
    }

    public issueAuthCode(client: OAuthClient, user: OAuthUser | undefined, scopes: OAuthScope[]): OAuthAuthCode {
        if (!user) {
            // this would otherwise break persisting of an DBOAuthAuthCodeEntry down below
            throw new Error("Cannot issue auth code for unknown user.");
        }
        const code = crypto.randomBytes(30).toString("hex");
        // NOTE: caller (@jmondi/oauth2-server) is responsible for adding the remaining items, PKCE params, redirect URL, etc
        return {
            code: code,
            user,
            client,
            expiresAt: expiryInFuture.getEndDate(),
            scopes: scopes,
        };
    }
    public async persist(authCode: DBOAuthAuthCodeEntry): Promise<void> {
        // authCode is created in issueAuthCode 👆
        try {
            const authCodeRepo = await this.getOauthAuthCodeRepo();
            authCode.id = uuidv4();
            await authCodeRepo.save(authCode);
        } catch (error) {
            log.error(
                { userId: authCode.user?.id || "<not-set>" },
                "Error while persisting an DBOAuthAuthCodeEntry.",
                error,
                { expiresAt: authCode.expiresAt, clientId: authCode.client.id },
            );
        }
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
