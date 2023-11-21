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
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class TokenService implements TokenProvider {
    static readonly GITPOD_AUTH_PROVIDER_ID = "Gitpod";

    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(UserDB) protected readonly userDB: UserDB;

    protected getTokenForHostCache = new Map<string, Promise<Token>>();

    async getTokenForHost(user: User | string, host: string): Promise<Token> {
        const userId = User.is(user) ? user.id : user;
        // (AT) when it comes to token renewal, the awaited http requests may
        // cause "parallel" calls to repeat the renewal, which will fail.
        // Caching for pending operations should solve this issue.
        const key = `${host}-${userId}`;
        let promise = this.getTokenForHostCache.get(key);
        if (!promise) {
            promise = this.doGetTokenForHost(userId, host);
            this.getTokenForHostCache.set(key, promise);
            promise = promise.finally(() => this.getTokenForHostCache.delete(key));
        }
        return promise;
    }

    private async doGetTokenForHost(userId: string, host: string): Promise<Token> {
        const user = await this.userDB.findUserById(userId);
        if (!user) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `User (${userId}) not found.`);
        }
        const identity = this.getIdentityForHost(user, host);
        let token = await this.userDB.findTokenForIdentity(identity);
        if (!token) {
            throw new ApplicationError(
                ErrorCodes.NOT_FOUND,
                `SCM Token not found: (${userId}/${identity?.authId}/${identity?.authName}).`,
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

    private getIdentityForHost(user: User, host: string): Identity {
        const authProviderId = this.getAuthProviderId(host);
        const hostIdentity = authProviderId && User.getIdentity(user, authProviderId);
        if (!hostIdentity) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `User (${user.id}) has no identity for host: ${host}.`);
        }
        return hostIdentity;
    }

    private getAuthProviderId(host: string): string | undefined {
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            return undefined;
        }
        return hostContext.authProvider.authProviderId;
    }
}
