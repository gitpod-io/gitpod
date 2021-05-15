/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { DateInterval, GrantIdentifier, OAuthClient, OAuthClientRepository, OAuthScope, OAuthScopeRepository, OAuthToken, OAuthTokenRepository, OAuthUser } from "@jmondi/oauth2-server";
import { inMemoryDatabase } from "./db";

const expiryInFuture = new DateInterval("1h");

export const inMemoryClientRepository: OAuthClientRepository = {
    async getByIdentifier(clientId: string): Promise<OAuthClient> {
        log.info(`getByIdentifier: ${clientId}:${JSON.stringify(inMemoryDatabase.clients)}`)
        return inMemoryDatabase.clients[clientId];
    },

    async isClientValid(grantType: GrantIdentifier, client: OAuthClient, clientSecret?: string): Promise<boolean> {
        log.info(`isClientValid: ${JSON.stringify(client)}:${clientSecret}`)
        if (client.secret !== clientSecret) {
            log.info(`isClientValid: bad secret`)
            return false;
        }

        if (!client.allowedGrants.includes(grantType)) {
            log.info(`isClientValid: bad grant`)
            return false;
        }

        log.info(`isClientValid: yes`)
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
        const expiry = expiryInFuture.getEndDate();
        log.info(`issueToken ${JSON.stringify(expiry)}`)
        return <OAuthToken>{
            accessToken: "new token",
            accessTokenExpiresAt: expiry,
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