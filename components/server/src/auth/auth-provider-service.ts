/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { AuthProviderEntry as AuthProviderEntry, User } from "@gitpod/gitpod-protocol";
import { AuthProviderParams } from "./auth-provider";
import { AuthProviderEntryDB } from "@gitpod/gitpod-db/lib/auth-provider-entry-db";
import { Env } from "../env";
import * as uuidv4 from 'uuid/v4';
import { oauthUrls as githubUrls } from "../github/github-urls";
import { oauthUrls as gitlabUrls } from "../gitlab/gitlab-urls";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class AuthProviderService {

    @inject(AuthProviderEntryDB)
    protected authProviderDB: AuthProviderEntryDB;

    @inject(Env)
    protected env: Env;

    /**
     * Returns all auth providers.
     */
    async getAllAuthProviders(): Promise<AuthProviderParams[]> {
        const all = await this.authProviderDB.findAll();
        return all.map(this.toAuthProviderParams.bind(this));
    }

    protected toAuthProviderParams = (oap: AuthProviderEntry) => <AuthProviderParams>{
        ...oap,
        verified: oap.status === "verified",
        builtin: false,
        // hiddenOnDashboard: true, // i.e. show only if it's used
        loginContextMatcher: `https://${oap.host}/`,
        oauth: {
            ...oap.oauth,
            clientId: oap.oauth.clientId || "no",
            clientSecret: oap.oauth.clientSecret || "no",
        }
    };

    async getAuthProvidersOfUser(user: User | string): Promise<AuthProviderEntry[]> {
        const result = await this.authProviderDB.findByUserId(User.is(user) ? user.id : user);
        return result;
    }

    async deleteAuthProvider(authProvider: AuthProviderEntry): Promise<void> {
        await this.authProviderDB.delete(authProvider);
    }

    async updateAuthProvider(entry: AuthProviderEntry.UpdateEntry | AuthProviderEntry.NewEntry): Promise<void> {
        let authProvider: AuthProviderEntry;
        if ("id" in entry) {
            const { id, ownerId } = entry;
            const existing = (await this.authProviderDB.findByUserId(ownerId)).find(p => p.id === id);
            if (!existing) {
                throw new Error("Provider does not exist.");
            }
            const changed = entry.clientId !== existing.oauth.clientId
                || (entry.clientSecret && entry.clientSecret !== existing.oauth.clientSecret);

            if (!changed) {
                return;
            }

            // update config on demand
            authProvider = {
                ...existing,
                oauth: {
                    ...existing.oauth,
                    clientId: entry.clientId,
                    clientSecret: entry.clientSecret || existing.oauth.clientSecret, // FE may send empty ("") if not changed
                },
                status: "pending",
            }
        } else {
            const existing = await this.authProviderDB.findByHost(entry.host);
            if (existing) {
                throw new Error("Provider for host has already been registered.");
            }
            authProvider = this.initializeNewProvider(entry);
        }
        await this.authProviderDB.storeAuthProvider(authProvider as AuthProviderEntry);
    }
    protected initializeNewProvider(newEntry: AuthProviderEntry.NewEntry): AuthProviderEntry {
        const { host, type } = newEntry;
        const urls = type === "GitHub" ? githubUrls(host) : (type === "GitLab" ? gitlabUrls(host) : undefined);
        if (!urls) {
            throw new Error("Unexpected service type.");
        }
        return <AuthProviderEntry>{
            ...newEntry,
            id: uuidv4(),
            type,
            oauth: {
                ...urls,
                callBackUrl: this.callbackUrl(host),
            },
            status: "pending",
        };
    }

    async markAsVerified(params: { newOwnerId?: string; ownerId: string; id: string }) {
        const { newOwnerId, ownerId, id } = params;
        let ap: AuthProviderEntry | undefined;
        try {
            ap = (await this.authProviderDB.findByUserId(ownerId)).find(p => p.id === id);
            if (ap) {
                ap = {
                    ...ap,
                    ownerId: newOwnerId || ownerId,
                    status: "verified"
                };
                await this.authProviderDB.storeAuthProvider(ap);
            }
        } catch (error) {
            log.error("Failed to activate AuthProviderEntry.", { params, id, ap })
        }
    }

    protected callbackUrl = (host: string) => {
        const pathname = `/auth/${host}/callback`;
        if (this.env.devBranch) {
            // for example: https://staging.gitpod-dev.com/auth/gitlab.com/callback
            return this.env.hostUrl.withoutDomainPrefix(1).with({ pathname }).toString();
        }
        return this.env.hostUrl.with({ pathname }).toString();
    };
}
