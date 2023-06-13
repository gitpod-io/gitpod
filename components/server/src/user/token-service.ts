/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { Token, Identity, User, TokenEntry } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { v4 as uuidv4 } from "uuid";
import { TokenProvider } from "./token-provider";

@injectable()
export class TokenService implements TokenProvider {
    static readonly GITPOD_AUTH_PROVIDER_ID = "Gitpod";
    static readonly GITPOD_PORT_AUTH_TOKEN_EXPIRY_MILLIS = 30 * 60 * 1000;

    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(UserDB) protected readonly userDB: UserDB;

    protected getTokenForHostCache = new Map<string, Promise<Token>>();

    async getTokenForHost(user: User, host: string): Promise<Token> {
        // (AT) when it comes to token renewal, the awaited http requests may
        // cause "parallel" calls to repeat the renewal, which will fail.
        // Caching for pending operations should solve this issue.
        const key = `${host}-${user.id}`;
        let promise = this.getTokenForHostCache.get(key);
        if (!promise) {
            promise = this.doGetTokenForHost(user, host);
            this.getTokenForHostCache.set(key, promise);
            promise = promise.finally(() => this.getTokenForHostCache.delete(key));
        }
        return promise;
    }

    async doGetTokenForHost(user: User, host: string): Promise<Token> {
        const identity = this.getIdentityForHost(user, host);
        let token = await this.userDB.findTokenForIdentity(identity);
        if (!token) {
            throw new Error(
                `No token found for user ${identity.authProviderId}/${identity.authId}/${identity.authName}!`,
            );
        }
        const aboutToExpireTime = new Date();
        aboutToExpireTime.setTime(aboutToExpireTime.getTime() + 5 * 60 * 1000);
        if (token.expiryDate && token.expiryDate < aboutToExpireTime.toISOString()) {
            const { authProvider } = this.hostContextProvider.get(host)!;
            if (authProvider.refreshToken) {
                await authProvider.refreshToken(user);
                token = (await this.userDB.findTokenForIdentity(identity))!;
            }
        }
        return token;
    }

    async getOrCreateGitpodIdentity(user: User): Promise<Identity> {
        let identity = User.getIdentity(user, TokenService.GITPOD_AUTH_PROVIDER_ID);
        if (!identity) {
            identity = {
                authProviderId: TokenService.GITPOD_AUTH_PROVIDER_ID,
                authId: user.id,
                authName: user.name || user.id,
            };
            user.identities.push(identity);
            await this.userDB.storeUser(user);
        }
        return identity;
    }

    async createGitpodToken(user: User, ...scopes: string[]): Promise<TokenEntry> {
        const identity = await this.getOrCreateGitpodIdentity(user);
        await this.userDB.deleteTokens(
            identity,
            // delete any tokens with the same scopes
            (tokenEntry) => tokenEntry.token.scopes.every((s) => scopes.indexOf(s) !== -1),
        );
        const token: Token = {
            value: uuidv4(),
            scopes: scopes || [],
            updateDate: new Date().toISOString(),
        };
        return await this.userDB.addToken(identity, token);
    }

    protected getIdentityForHost(user: User, host: string): Identity {
        const authProviderId = this.getAuthProviderId(host);
        const hostIdentity = authProviderId && User.getIdentity(user, authProviderId);
        if (!hostIdentity) {
            throw new Error(`User ${user.name} has no identity for host: ${host}!`);
        }
        return hostIdentity;
    }

    protected getAuthProviderId(host: string): string | undefined {
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            return undefined;
        }
        return hostContext.authProvider.authProviderId;
    }
}
