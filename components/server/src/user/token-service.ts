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
import { GarbageCollectedCache } from "@gitpod/gitpod-protocol/lib/util/garbage-collected-cache";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { RedisMutex } from "../redis/mutex";

@injectable()
export class TokenService implements TokenProvider {
    static readonly GITPOD_AUTH_PROVIDER_ID = "Gitpod";

    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(RedisMutex) private readonly redisMutex: RedisMutex;

    // Introducing GC to token cache to guard from potentialy stale fetch requests. This is setting
    // a hard limit at 10s (+5s) after which after which compteting request will trigger a new request,
    // if applicable.
    private readonly getTokenForHostCache = new GarbageCollectedCache<Promise<Token | undefined>>(10, 5);

    async getTokenForHost(user: User | string, host: string): Promise<Token | undefined> {
        const userId = User.is(user) ? user.id : user;

        // EXPERIMENT(sync_refresh_token_exchange)
        const syncRefreshTokenExchange = await getExperimentsClientForBackend().getValueAsync(
            "sync_refresh_token_exchange",
            false,
            {},
        );
        if (syncRefreshTokenExchange) {
            return this.doGetTokenForHostSync(userId, host);
        }

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

    // EXPERIMENT(sync_refresh_token_exchange)
    private async doGetTokenForHostSync(userId: string, host: string): Promise<Token | undefined> {
        const user = await this.userDB.findUserById(userId);
        if (!user) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `User (${userId}) not found.`);
        }
        const identity = this.getIdentityForHost(user, host);

        function isValid(t: Token): boolean {
            if (!t.expiryDate) {
                return true;
            }

            const aboutToExpireTime = new Date();
            aboutToExpireTime.setTime(aboutToExpireTime.getTime() + 5 * 60 * 1000);
            if (t.expiryDate >= aboutToExpireTime.toISOString()) {
                return true;
            }
            return false;
        }

        const doRefreshToken = async () => {
            // Check: Current token so we can actually refresh?
            const token = await this.userDB.findTokenForIdentity(identity);
            if (!token) {
                return undefined;
            }

            if (isValid(token)) {
                return token;
            }

            // Can we refresh these kind of tokens?
            const { authProvider } = this.hostContextProvider.get(host)!;
            if (!authProvider.refreshToken) {
                return undefined;
            }

            await authProvider.refreshToken(user);
            return await this.userDB.findTokenForIdentity(identity);
        };

        try {
            const refreshedToken = await this.redisMutex.using(
                [`token-refresh-${host}-${userId}`],
                3000, // After 3s without extension the lock is released
                doRefreshToken,
                { retryCount: 20, retryDelay: 500 }, // We wait at most 10s until we give up, and conclude that we can't refresh the token now.
            );
            return refreshedToken;
        } catch (err) {
            if (RedisMutex.isLockedError(err)) {
                // In this case we already timed-out. BUT there is a high chance we are waiting on somebody else, who might already done the work for us.
                // So just checking again here
                const token = await this.userDB.findTokenForIdentity(identity);
                if (token && isValid(token)) {
                    log.debug({ userId }, `Token refresh timed out, but still successful`, { host });
                    return token;
                }

                log.error({ userId }, `Failed to refresh token (timeout waiting on lock)`, err, { host });
                throw new Error(`Failed to refresh token (timeout waiting on lock)`);
            }
            throw err;
        }
    }

    private async doGetTokenForHost(userId: string, host: string): Promise<Token | undefined> {
        const user = await this.userDB.findUserById(userId);
        if (!user) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `User (${userId}) not found.`);
        }
        const identity = this.getIdentityForHost(user, host);
        let token = await this.userDB.findTokenForIdentity(identity);
        if (!token) {
            return undefined;
        }

        const aboutToExpireTime = new Date();
        aboutToExpireTime.setTime(aboutToExpireTime.getTime() + 5 * 60 * 1000);
        if (token.expiryDate && token.expiryDate < aboutToExpireTime.toISOString()) {
            // We attempt to get a token three times
            const { authProvider } = this.hostContextProvider.get(host)!;

            if (authProvider.refreshToken) {
                const shouldRetryRefreshTokenExchange = await getExperimentsClientForBackend().getValueAsync(
                    "retry_refresh_token_exchange",
                    false,
                    {},
                );
                if (shouldRetryRefreshTokenExchange) {
                    const errors: Error[] = [];

                    // There is a race condition where multiple requests may each need to use the refresh_token to get a new access token.
                    // When the `authProvider.refreshToken` is called, it will refresh the token and store it in the database.
                    // However, the token may have already been refreshed by another request, so we need to check the database again.
                    for (let i = 0; i < 3; i++) {
                        try {
                            await authProvider.refreshToken(user);
                            token = (await this.userDB.findTokenForIdentity(identity))!;
                            if (token) {
                                return token;
                            }
                        } catch (e) {
                            errors.push(e as Error);
                            log.error(`Failed to refresh token on attempt ${i + 1}/3.`, e, { userId: user.id });
                        }

                        const backoff = 250 + 250 * Math.random(); // 250ms + 0-250ms
                        await new Promise((f) => setTimeout(f, backoff));
                    }
                    log.error(`Failed to refresh token after 3 attempts.`, errors, { userId: user.id });
                    throw new Error(`Failed to refresh token after 3 attempts: ${errors.join(", ")}`);
                } else {
                    await authProvider.refreshToken(user);
                    token = (await this.userDB.findTokenForIdentity(identity))!;
                }
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
