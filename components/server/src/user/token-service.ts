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
import {
    OpportunisticRefresh,
    reportScmTokenRefreshRequest,
    scmTokenRefreshLatencyHistogram,
} from "../prometheus-metrics";

@injectable()
export class TokenService implements TokenProvider {
    static readonly GITPOD_AUTH_PROVIDER_ID = "Gitpod";
    /**
     * [mins]
     *
     * The default lifetime of a token if not specified otherwise.
     * Atm we only specify a different lifetime on workspace starts (for the token we pass to "git clone" during content init).
     * Also, this value is relevant for "opportunistic token refreshes" (enabled for Bitbucket only atm): It's the time we mark a token as "reserved" (= do not opportunistically refresh it).
     */
    static readonly DEFAULT_LIFETIME = 5;

    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(RedisMutex) private readonly redisMutex: RedisMutex;

    async getTokenForHost(
        user: User | string,
        host: string,
        requestedLifetimeMins?: number,
    ): Promise<Token | undefined> {
        const userId = User.is(user) ? user.id : user;

        return this.doGetTokenForHost(userId, host, requestedLifetimeMins);
    }

    private async doGetTokenForHost(
        userId: string,
        host: string,
        requestedLifetimeMins = TokenService.DEFAULT_LIFETIME,
    ): Promise<Token | undefined> {
        const user = await this.userDB.findUserById(userId);
        if (!user) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `User (${userId}) not found.`);
        }
        const identity = this.getIdentityForHost(user, host);

        function isValidUntil(t: Token, requestedLifetimeDate: Date): boolean {
            return !t.expiryDate || t.expiryDate >= requestedLifetimeDate.toISOString();
        }

        const updateReservation = async (uid: string, token: Token, requestedLifetimeDate: Date): Promise<void> => {
            if (
                !token.reservedUntilDate ||
                requestedLifetimeDate.getTime() > new Date(token.reservedUntilDate).getTime()
            ) {
                // If the requested lifetime is longer than the reserved lifetime, we extend the reservation
                const reservedUntilDate = requestedLifetimeDate.toISOString();
                await this.userDB.updateTokenEntry({
                    uid,
                    reservedUntilDate,
                });
                token.reservedUntilDate = reservedUntilDate;
            }
        };

        const requestedLifetimeDate = nowPlusMins(requestedLifetimeMins);
        let opportunisticRefresh: OpportunisticRefresh = "false";
        try {
            const refreshedToken = await this.redisMutex.using(
                [`token-refresh-${host}-${userId}`],
                3000, // After 3s without extension the lock is released
                async () => {
                    // Check: Current token so we can actually refresh?
                    const tokenEntry = await this.userDB.findTokenEntryForIdentity(identity);
                    const token = tokenEntry?.token;
                    if (!token) {
                        reportScmTokenRefreshRequest(host, opportunisticRefresh, "no_token");
                        return undefined;
                    }

                    const { authProvider } = this.hostContextProvider.get(host)!;
                    if (isValidUntil(token, requestedLifetimeDate)) {
                        const doOpportunisticRefresh =
                            !!authProvider.requiresOpportunisticRefresh && authProvider.requiresOpportunisticRefresh();
                        if (!doOpportunisticRefresh) {
                            // No opportunistic refresh? Update reservation and we are done.
                            await updateReservation(tokenEntry.uid, token, requestedLifetimeDate);
                            reportScmTokenRefreshRequest(host, opportunisticRefresh, "still_valid");
                            return token;
                        }

                        // Opportunistic, but token currently reserved? Done.
                        const currentlyReserved =
                            token.reservedUntilDate &&
                            new Date(token.reservedUntilDate).getTime() > new Date().getTime();
                        if (currentlyReserved) {
                            await updateReservation(tokenEntry.uid, token, requestedLifetimeDate);
                            reportScmTokenRefreshRequest(host, "reserved", "still_valid");
                            return token;
                        }
                        opportunisticRefresh = "true";
                    }
                    // Not valid, or we need to refresh anyway

                    if (!authProvider.refreshToken) {
                        reportScmTokenRefreshRequest(host, opportunisticRefresh, "not_refreshable");
                        return undefined;
                    }

                    // Perform actual refresh
                    const stopTimer = scmTokenRefreshLatencyHistogram.startTimer({ host });
                    try {
                        const result = await authProvider.refreshToken(user, requestedLifetimeDate);
                        reportScmTokenRefreshRequest(host, opportunisticRefresh, "success");
                        return result;
                    } finally {
                        stopTimer({ host });
                    }
                },
                { retryCount: 20, retryDelay: 500 }, // We wait at most 10s until we give up, and conclude that we can't refresh the token now.
            );
            return refreshedToken;
        } catch (err) {
            if (RedisMutex.isLockedError(err)) {
                // In this case we already timed-out. BUT there is a high chance we are waiting on somebody else, who might already done the work for us.
                // So just checking again here
                const tokenEntry = await this.userDB.findTokenEntryForIdentity(identity);
                const token = tokenEntry?.token;
                if (token && isValidUntil(token, requestedLifetimeDate)) {
                    log.debug({ userId }, `Token refresh timed out, but still successful`, { host });
                    reportScmTokenRefreshRequest(host, opportunisticRefresh, "success_after_timeout");
                    return token;
                }

                log.error({ userId }, `Failed to refresh token (timeout waiting on lock)`, err, { host });
                reportScmTokenRefreshRequest(host, opportunisticRefresh, "timeout");
                throw new Error(`Failed to refresh token (timeout waiting on lock)`);
            }
            reportScmTokenRefreshRequest(host, opportunisticRefresh, "error");
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

function nowPlusMins(mins: number): Date {
    const now = new Date();
    now.setTime(now.getTime() + mins * 60 * 1000);
    return now;
}
