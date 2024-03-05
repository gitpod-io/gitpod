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
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { RedisMutex } from "../redis/mutex";
import { reportScmTokenRefreshRequest, scmTokenRefreshLatencyHistogram } from "../prometheus-metrics";

@injectable()
export class TokenService implements TokenProvider {
    static readonly GITPOD_AUTH_PROVIDER_ID = "Gitpod";

    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(RedisMutex) private readonly redisMutex: RedisMutex;

    async getTokenForHost(user: User | string, host: string): Promise<Token | undefined> {
        const userId = User.is(user) ? user.id : user;

        return this.doGetTokenForHost(userId, host);
    }

    private async doGetTokenForHost(userId: string, host: string): Promise<Token | undefined> {
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
                reportScmTokenRefreshRequest(host, "no_token");
                return undefined;
            }

            if (isValid(token)) {
                reportScmTokenRefreshRequest(host, "still_valid");
                return token;
            }

            // Can we refresh these kind of tokens?
            const { authProvider } = this.hostContextProvider.get(host)!;
            if (!authProvider.refreshToken) {
                reportScmTokenRefreshRequest(host, "not_refreshable");
                return undefined;
            }

            // Perform actual refresh
            const stopTimer = scmTokenRefreshLatencyHistogram.startTimer({ host });
            try {
                await authProvider.refreshToken(user);
            } finally {
                stopTimer({ host });
            }

            const freshToken = await this.userDB.findTokenForIdentity(identity);
            reportScmTokenRefreshRequest(host, "success");
            return freshToken;
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
                    reportScmTokenRefreshRequest(host, "success_after_timeout");
                    return token;
                }

                log.error({ userId }, `Failed to refresh token (timeout waiting on lock)`, err, { host });
                reportScmTokenRefreshRequest(host, "timeout");
                throw new Error(`Failed to refresh token (timeout waiting on lock)`);
            }
            reportScmTokenRefreshRequest(host, "error");
            throw err;
        }
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
