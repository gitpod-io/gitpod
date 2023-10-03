/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { AuthProviderEntry as AuthProviderEntry, User } from "@gitpod/gitpod-protocol";
import { AuthProviderParams } from "./auth-provider";
import { AuthProviderEntryDB, TeamDB } from "@gitpod/gitpod-db/lib";
import { Config } from "../config";
import { v4 as uuidv4 } from "uuid";
import { oauthUrls as githubUrls } from "../github/github-urls";
import { oauthUrls as gitlabUrls } from "../gitlab/gitlab-urls";
import { oauthUrls as bbsUrls } from "../bitbucket-server/bitbucket-server-urls";
import { oauthUrls as bbUrls } from "../bitbucket/bitbucket-urls";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import fetch from "node-fetch";

@injectable()
export class AuthProviderService {
    @inject(AuthProviderEntryDB)
    protected authProviderDB: AuthProviderEntryDB;

    @inject(TeamDB)
    protected teamDB: TeamDB;

    @inject(Config)
    protected readonly config: Config;

    /**
     * Returns all auth providers.
     */
    async getAllAuthProviders(exceptOAuthRevisions: string[] = []): Promise<AuthProviderParams[]> {
        const all = await this.authProviderDB.findAll(exceptOAuthRevisions);
        return all.map((provider) => this.toAuthProviderParams(provider));
    }

    async getAllAuthProviderHosts(): Promise<string[]> {
        return this.authProviderDB.findAllHosts();
    }

    protected toAuthProviderParams = (oap: AuthProviderEntry) =>
        <AuthProviderParams>{
            ...oap,
            // HINT: host is expected to be lower case
            host: oap.host.toLowerCase(),
            verified: oap.status === "verified",
            builtin: false,
            disallowLogin: !!oap.organizationId,
            // hiddenOnDashboard: true, // i.e. show only if it's used
            oauth: {
                ...oap.oauth,
                clientId: oap.oauth.clientId || "no",
                clientSecret: oap.oauth.clientSecret || "no",
            },
        };

    async getAuthProvidersOfUser(user: User | string): Promise<AuthProviderEntry[]> {
        const result = await this.authProviderDB.findByUserId(User.is(user) ? user.id : user);
        return result;
    }

    async getAuthProvidersOfOrg(organizationId: string): Promise<AuthProviderEntry[]> {
        const result = await this.authProviderDB.findByOrgId(organizationId);
        return result;
    }

    async deleteAuthProvider(authProvider: AuthProviderEntry): Promise<void> {
        await this.authProviderDB.delete(authProvider);
    }

    async updateAuthProvider(
        entry: AuthProviderEntry.UpdateEntry | AuthProviderEntry.NewEntry,
    ): Promise<AuthProviderEntry> {
        let authProvider: AuthProviderEntry;
        if ("id" in entry) {
            const { id, ownerId } = entry;
            const existing = (await this.authProviderDB.findByUserId(ownerId)).find((p) => p.id === id);
            if (!existing) {
                throw new Error("Provider does not exist.");
            }
            const changed =
                entry.clientId !== existing.oauth.clientId ||
                (entry.clientSecret && entry.clientSecret !== existing.oauth.clientSecret);

            if (!changed) {
                return existing;
            }

            // update config on demand
            const oauth = {
                ...existing.oauth,
                clientId: entry.clientId,
                clientSecret: entry.clientSecret || existing.oauth.clientSecret, // FE may send empty ("") if not changed
            };
            authProvider = {
                ...existing,
                oauth,
                status: "pending",
            };
        } else {
            const existing = await this.authProviderDB.findByHost(entry.host);
            if (existing) {
                throw new Error("Provider for this host already exists.");
            }
            authProvider = this.initializeNewProvider(entry);
        }
        return await this.authProviderDB.storeAuthProvider(authProvider as AuthProviderEntry, true);
    }

    async createOrgAuthProvider(entry: AuthProviderEntry.NewOrgEntry): Promise<AuthProviderEntry> {
        const orgProviders = await this.authProviderDB.findByOrgId(entry.organizationId);
        const existing = orgProviders.find((p) => p.host === entry.host);
        if (existing) {
            throw new Error("Provider for this host already exists.");
        }

        const authProvider = this.initializeNewProvider(entry);

        return await this.authProviderDB.storeAuthProvider(authProvider as AuthProviderEntry, true);
    }

    async updateOrgAuthProvider(entry: AuthProviderEntry.UpdateOrgEntry): Promise<AuthProviderEntry> {
        const { id, organizationId } = entry;
        // TODO can we change this to query for the provider by id and org instead of loading all from org?
        const existing = (await this.authProviderDB.findByOrgId(organizationId)).find((p) => p.id === id);
        if (!existing) {
            throw new Error("Provider does not exist.");
        }
        const changed =
            entry.clientId !== existing.oauth.clientId ||
            (entry.clientSecret && entry.clientSecret !== existing.oauth.clientSecret);

        if (!changed) {
            return existing;
        }

        // update config on demand
        const oauth = {
            ...existing.oauth,
            clientId: entry.clientId,
            clientSecret: entry.clientSecret || existing.oauth.clientSecret, // FE may send empty ("") if not changed
        };
        const authProvider: AuthProviderEntry = {
            ...existing,
            oauth,
            status: "pending",
        };

        return await this.authProviderDB.storeAuthProvider(authProvider as AuthProviderEntry, true);
    }

    protected initializeNewProvider(newEntry: AuthProviderEntry.NewEntry): AuthProviderEntry {
        const { host, type, clientId, clientSecret } = newEntry;
        let urls;
        switch (type) {
            case "GitHub":
                urls = githubUrls(host);
                break;
            case "GitLab":
                urls = gitlabUrls(host);
                break;
            case "BitbucketServer":
                urls = bbsUrls(host);
                break;
            case "Bitbucket":
                urls = bbUrls(host);
                break;
        }
        if (!urls) {
            throw new Error("Unexpected service type.");
        }
        const oauth: AuthProviderEntry["oauth"] = {
            ...urls,
            callBackUrl: this.callbackUrl(),
            clientId: clientId!,
            clientSecret: clientSecret!,
        };
        return {
            ...newEntry,
            id: uuidv4(),
            type,
            oauth,
            status: "pending",
        };
    }

    async markAsVerified(params: { userId: string; id: string }) {
        const { userId, id } = params;
        let ap: AuthProviderEntry | undefined;
        try {
            const ap = await this.authProviderDB.findById(id);
            if (!ap) {
                log.warn("Failed to find the AuthProviderEntry to be activated.", { params, id });
                return;
            }

            // Check that user is allowed to verify the AuthProviderEntry
            if (ap.organizationId) {
                const membership = await this.teamDB.findTeamMembership(userId, ap.organizationId);
                if (!membership) {
                    log.warn("Failed to find the TeamMembership for Org AuthProviderEntry to be activated.", {
                        params,
                        id,
                        ap,
                    });
                    return;
                }

                // As long as user is an owner of the org the ap belongs too, they can verify it
                if (membership.role !== "owner") {
                    log.warn("User must be an owner of org for AuthProviderEntry to be activated.", {
                        params,
                        id,
                        ap,
                    });
                    return;
                }
            } else {
                // For a non-org AuthProviderEntry, user must be the owner, or it must be the special "no-user" entry
                // "no-user" is the magic user id assigned during the initial setup
                if (userId !== ap.ownerId && ap.ownerId !== "no-user") {
                    log.warn("User cannot active the AuthProviderEntry.", { params, id, ap });
                    return;
                }
            }

            const updatedAP: AuthProviderEntry = {
                ...ap,
                ownerId: userId,
                status: "verified",
            };
            await this.authProviderDB.storeAuthProvider(updatedAP, true);
        } catch (error) {
            log.error("Failed to activate AuthProviderEntry.", { params, id, ap });
        }
    }

    protected callbackUrl = () => {
        const pathname = `/auth/callback`;
        return this.config.hostUrl.with({ pathname }).toString();
    };

    async isHostReachable(host: string): Promise<boolean> {
        try {
            const resp = await fetch(`https://${host}`, { timeout: 2000 });
            return resp.ok;
        } catch (error) {
            console.log(`Host is not reachable: ${host}`);
        }
        return false;
    }
}
