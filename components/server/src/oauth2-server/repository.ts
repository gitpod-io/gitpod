/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { DateInterval, GrantIdentifier, OAuthClient, OAuthClientRepository, OAuthScope, OAuthScopeRepository, OAuthToken, OAuthTokenRepository, OAuthUser } from "@jmondi/oauth2-server";
import { inMemoryDatabase } from "./db";

const oneHourInFuture = new DateInterval("1h").getEndDate();

export const inMemoryClientRepository: OAuthClientRepository = {
    async getByIdentifier(clientId: string): Promise<OAuthClient> {
        log.info(`getByIdentifier: ${JSON.stringify(inMemoryDatabase.clients)}`)
        return inMemoryDatabase.clients[clientId];
    },

    async isClientValid(grantType: GrantIdentifier, client: OAuthClient, clientSecret?: string): Promise<boolean> {
        if (client.secret !== clientSecret) {
            return false;
        }

        if (!client.allowedGrants.includes(grantType)) {
            return false;
        }

        return true;
    },
};

export const inMemoryScopeRepository: OAuthScopeRepository = {
    async getAllByIdentifiers(scopeNames: string[]): Promise<OAuthScope[]> {
        return Object.values(inMemoryDatabase.scopes).filter(scope => scopeNames.includes(scope.name));
    },
    async finalize(
        scopes: OAuthScope[],
        identifier: GrantIdentifier,
        client: OAuthClient,
        user_id?: string,
    ): Promise<OAuthScope[]> {
        return scopes;
    },
};

export const inMemoryAccessTokenRepository: OAuthTokenRepository = {
    async revoke(accessToken: OAuthToken): Promise<void> {
        const token = inMemoryDatabase.tokens[accessToken.accessToken];
        token.accessTokenExpiresAt = new Date(0);
        token.refreshTokenExpiresAt = new Date(0);
        inMemoryDatabase.tokens[accessToken.accessToken] = token;
    },
    async issueToken(client: OAuthClient, scopes: OAuthScope[], user: OAuthUser): Promise<OAuthToken> {
        log.info(`issueToken ${JSON.stringify(oneHourInFuture)}`)
        return <OAuthToken>{
            accessToken: "new token",
            accessTokenExpiresAt: oneHourInFuture,
            client,
            user,
            scopes: [],
        };
    },
    async persist(accessToken: OAuthToken): Promise<void> {
        inMemoryDatabase.tokens[accessToken.accessToken] = accessToken;
    },
    // @todo
    async getByRefreshToken(refreshTokenToken: string): Promise<OAuthToken> {
        const token = Object.values(inMemoryDatabase.tokens).find(token => token.refreshToken === refreshTokenToken);
        if (!token) throw new Error("token not found");
        return token;
    },
    async isRefreshTokenRevoked(token: OAuthToken): Promise<boolean> {
        return Date.now() > (token.refreshTokenExpiresAt?.getTime() ?? 0);
    },
    async issueRefreshToken(token): Promise<OAuthToken> {
        token.refreshToken = "refreshtokentoken";
        token.refreshTokenExpiresAt = new DateInterval("1h").getEndDate();
        inMemoryDatabase.tokens[token.accessToken] = token;
        return token;
    },
};

// export const inMemoryAuthCodeRepository: OAuthAuthCodeRepository = {
//     issueAuthCode(client: OAuthClient, user: OAuthUser | undefined, scopes: OAuthScope[]): OAuthAuthCode {
//         return {
//             code: "my-super-secret-auth-code",
//             user,
//             client,
//             redirectUri: "",
//             codeChallenge: undefined,
//             codeChallengeMethod: undefined,
//             expiresAt: oneHourInFuture,
//             scopes: [],
//         };
//     },
//     async persist(authCode: OAuthAuthCode): Promise<void> {
//         inMemoryDatabase.authCodes[authCode.code] = authCode;
//     },
//     async isRevoked(authCodeCode: string): Promise<boolean> {
//         const authCode = await this.getByIdentifier(authCodeCode);
//         return Date.now() > authCode.expiresAt.getTime();
//     },
//     async getByIdentifier(authCodeCode: string): Promise<OAuthAuthCode> {
//         return inMemoryDatabase.authCodes[authCodeCode];
//     },
//     async revoke(authCodeCode: string): Promise<void> {
//         inMemoryDatabase.authCodes[authCodeCode].expiresAt = new Date(0);
//     },
// };

// export const inMemoryUserRepository: OAuthUserRepository = {
//     async getUserByCredentials(
//         identifier: string,
//         password?: string,
//         grantType?: GrantIdentifier,
//         client?: OAuthClient,
//     ): Promise<OAuthUser | undefined> {
//         log.info(`getUserByCredentials: ${JSON.stringify(inMemoryDatabase.users)} && ${identifier}`)
//         const user = inMemoryDatabase.users[identifier];
//         if (user?.password !== password) return;
//         return user;
//     },
//     async extraAccessTokenFields(user: OAuthUser): Promise<ExtraAccessTokenFields | undefined> {
//         return {
//             email: user.email,
//         };
//     },
// };