/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { AuthProviderEntry as AuthProviderEntry, AuthProviderInfo, OAuth2Config, User } from "@gitpod/gitpod-protocol";
import { AuthProviderParams } from "./auth-provider";
import { AuthProviderEntryDB, TeamDB } from "@gitpod/gitpod-db/lib";
import { Config } from "../config";
import { v4 as uuidv4 } from "uuid";
import { oauthUrls as githubUrls } from "../github/github-urls";
import { oauthUrls as gitlabUrls } from "../gitlab/gitlab-urls";
import { oauthUrls as bbsUrls } from "../bitbucket-server/bitbucket-server-urls";
import { oauthUrls as bbUrls } from "../bitbucket/bitbucket-urls";
import { oauthUrls as azureUrls } from "../azure-devops/azure-urls";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import fetch from "node-fetch";
import { Authorizer } from "../authorization/authorizer";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { getRequiredScopes, getScopesForAuthProviderType } from "@gitpod/public-api-common/lib/auth-providers";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

@injectable()
export class AuthProviderService {
    constructor(
        @inject(AuthProviderEntryDB) private readonly authProviderDB: AuthProviderEntryDB,
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(Config) protected readonly config: Config,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter,
    ) {}

    /**
     * Returns all **unredacted** auth provider params to be used in the internal
     * authenticator parts.
     *
     * Known internal client `HostContextProviderImpl`
     */
    async getAllAuthProviderParams(exceptOAuthRevisions: string[] = []): Promise<AuthProviderParams[]> {
        const all = await this.authProviderDB.findAll(exceptOAuthRevisions);
        return all.map((provider) => this.toAuthProviderParams(provider));
    }

    async getAllAuthProviderHosts(): Promise<string[]> {
        return this.authProviderDB.findAllHosts();
    }

    private toAuthProviderParams = (oap: AuthProviderEntry) =>
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

    private isBuiltIn = (info: AuthProviderInfo | AuthProviderParams) => !info.ownerId;
    private isNotHidden = (info: AuthProviderInfo | AuthProviderParams) => !info.hiddenOnDashboard;
    private isVerified = (info: AuthProviderInfo | AuthProviderParams) => info.verified;
    private isNotOrgProvider = (info: AuthProviderInfo | AuthProviderParams) => !info.organizationId;

    async getAuthProviderDescriptionsUnauthenticated(): Promise<AuthProviderInfo[]> {
        const { builtinAuthProvidersConfigured } = this.config;

        const authProviders = [...(await this.getAllAuthProviderParams()), ...this.config.authProviderConfigs];

        const toPublic = (ap: AuthProviderParams) =>
            <AuthProviderInfo>{
                authProviderId: ap.id,
                authProviderType: ap.type,
                disallowLogin: ap.disallowLogin,
                host: ap.host,
                icon: ap.icon,
                description: ap.description,
            };
        let result = authProviders.filter(this.isNotHidden).filter(this.isVerified).filter(this.isNotOrgProvider);
        if (builtinAuthProvidersConfigured) {
            result = result.filter(this.isBuiltIn);
        }
        return result.map(toPublic);
    }

    async findAuthProviderDescription(user: User, host: string): Promise<AuthProviderInfo | undefined> {
        const provider =
            this.config.authProviderConfigs.find((p) => p.host.toLowerCase() === host?.toLowerCase()) ||
            (await this.getAllAuthProviderParams()).find((p) => p.host.toLowerCase() === host?.toLowerCase());
        return provider ? this.toInfo(provider) : undefined;
    }

    // explicitly copy to avoid bleeding sensitive details
    private toInfo(ap: AuthProviderParams): AuthProviderInfo {
        return {
            authProviderId: ap.id,
            authProviderType: ap.type,
            ownerId: ap.ownerId,
            organizationId: ap.organizationId,
            verified: ap.verified,
            host: ap.host,
            icon: ap.icon,
            hiddenOnDashboard: ap.hiddenOnDashboard,
            disallowLogin: ap.disallowLogin,
            description: ap.description,
            scopes: getScopesForAuthProviderType(ap.type),
            requirements: getRequiredScopes(ap.type),
        };
    }

    async getAuthProviderDescriptions(user: User): Promise<AuthProviderInfo[]> {
        const { builtinAuthProvidersConfigured } = this.config;

        const authProviders = [...(await this.getAllAuthProviderParams()), ...this.config.authProviderConfigs];

        const result: AuthProviderInfo[] = [];
        for (const p of authProviders) {
            const identity = user.identities.find((i) => i.authProviderId === p.id);
            if (identity) {
                result.push(this.toInfo(p));
                continue;
            }
            if (p.ownerId === user.id) {
                result.push(this.toInfo(p));
                continue;
            }
            if (builtinAuthProvidersConfigured && !this.isBuiltIn(p)) {
                continue;
            }
            if (this.isNotHidden(p) && this.isVerified(p)) {
                result.push(this.toInfo(p));
            }
        }
        return result;
    }

    async getAuthProvidersOfUser(user: User | string): Promise<AuthProviderEntry[]> {
        const userId = User.is(user) ? user.id : user;
        await this.auth.checkPermissionOnUser(userId, "read_info", userId);

        const result = await this.authProviderDB.findByUserId(userId);
        return result.map((ap) => AuthProviderEntry.redact(ap));
    }

    async getAuthProvidersOfOrg(userId: string, organizationId: string): Promise<AuthProviderEntry[]> {
        await this.auth.checkPermissionOnOrganization(userId, "read_git_provider", organizationId);
        const result = await this.authProviderDB.findByOrgId(organizationId);
        return result.map((ap) => AuthProviderEntry.redact(ap));
    }

    async deleteAuthProviderOfUser(userId: string, authProviderId: string): Promise<void> {
        await this.auth.checkPermissionOnUser(userId, "write_info", userId);

        const ownProviders = await this.getAuthProvidersOfUser(userId);
        const authProvider = ownProviders.find((p) => p.id === authProviderId);
        if (!authProvider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "User resource not found.");
        }

        await this.authProviderDB.delete(authProvider);
    }

    async deleteAuthProviderOfOrg(userId: string, organizationId: string, authProviderId: string): Promise<void> {
        await this.auth.checkPermissionOnOrganization(userId, "write_git_provider", organizationId);

        // Find the matching auth provider we're attempting to delete
        const orgProviders = await this.getAuthProvidersOfOrg(userId, organizationId);
        const authProvider = orgProviders.find((p) => p.id === authProviderId && p.organizationId === organizationId);
        if (!authProvider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider resource not found.");
        }

        await this.authProviderDB.delete(authProvider);
    }

    /**
     * Returns the provider identified by the specified `id`. Throws `NOT_FOUND` error if the resource
     * is not found.
     */
    async getAuthProvider(userId: string, id: string): Promise<AuthProviderEntry> {
        const result = await this.authProviderDB.findById(id);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider resource not found.");
        }

        if (result.organizationId) {
            await this.auth.checkPermissionOnOrganization(userId, "read_git_provider", result.organizationId);
        } else {
            await this.auth.checkPermissionOnUser(userId, "read_info", userId);
        }

        return AuthProviderEntry.redact(result);
    }

    async createAuthProviderOfUser(userId: string, entry: AuthProviderEntry.NewEntry): Promise<AuthProviderEntry> {
        await this.auth.checkPermissionOnUser(userId, "write_info", userId);

        const host = entry.host && entry.host.toLowerCase();

        // reachability test
        if (!(await this.isHostReachable(host))) {
            log.info(`Host could not be reached.`, { entry });
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Host could not be reached.`);
        }

        // checking for already existing runtime providers
        const isBuiltInProvider = this.isBuiltInProvider(host);
        if (isBuiltInProvider) {
            log.info(`Attempt to override an existing provider.`, { entry });
            throw new ApplicationError(ErrorCodes.CONFLICT, `Attempt to override an existing provider.`);
        }
        const existing = await this.authProviderDB.findByHost(entry.host);
        if (existing) {
            log.info(`Provider for this host already exists.`, { entry });
            throw new ApplicationError(ErrorCodes.CONFLICT, `Provider for this host already exists.`);
        }

        const authProvider = this.initializeNewProvider(entry);
        const result = await this.authProviderDB.storeAuthProvider(authProvider, true);
        return AuthProviderEntry.redact(result);
    }

    private isBuiltInProvider(host: string) {
        return this.config.authProviderConfigs.some((config) => config.host.toLowerCase() === host.toLocaleLowerCase());
    }

    async updateAuthProviderOfUser(userId: string, entry: AuthProviderEntry.UpdateEntry): Promise<AuthProviderEntry> {
        await this.auth.checkPermissionOnUser(userId, "write_info", userId);

        const { id, ownerId } = entry;
        const existing = (await this.authProviderDB.findByUserId(ownerId)).find((p) => p.id === id);
        if (!existing) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider resource not found.");
        }

        const isAzure = this.apiConverter.toAuthProviderType(existing.type) === AuthProviderType.AZURE_DEVOPS;
        if (!isAzure) {
            entry.authorizationUrl = undefined;
            entry.tokenUrl = undefined;
        }

        // Explicitly check if any update needs to be performed
        const changedId = entry.clientId && entry.clientId !== existing.oauth.clientId;
        const changedSecret = entry.clientSecret && entry.clientSecret !== existing.oauth.clientSecret;
        const azureChanged =
            isAzure &&
            (existing.oauth.authorizationUrl !== entry.authorizationUrl || existing.oauth.tokenUrl !== entry.tokenUrl);
        const changed = changedId || changedSecret || azureChanged;

        if (!changed) {
            return existing;
        }

        // update config on demand
        const oauth: OAuth2Config = {
            ...existing.oauth,
            clientId: entry.clientId || existing.oauth?.clientId,
            clientSecret: entry.clientSecret || existing.oauth?.clientSecret, // FE may send empty ("") if not changed
            authorizationUrl: entry.authorizationUrl || existing.oauth?.authorizationUrl,
            tokenUrl: entry.tokenUrl || existing.oauth?.tokenUrl,
        };
        const authProvider: AuthProviderEntry = {
            ...existing,
            oauth,
            status: "pending",
        };
        const result = await this.authProviderDB.storeAuthProvider(authProvider, true);
        return AuthProviderEntry.redact(result);
    }

    async createOrgAuthProvider(userId: string, newEntry: AuthProviderEntry.NewOrgEntry): Promise<AuthProviderEntry> {
        await this.auth.checkPermissionOnOrganization(userId, "write_git_provider", newEntry.organizationId);

        // on creating we're are checking for already existing runtime providers
        const host = newEntry.host && newEntry.host.toLowerCase();

        if (!(await this.isHostReachable(host))) {
            log.info(`Host could not be reached.`, { newEntry });
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Host could not be reached.`);
        }

        const isBuiltInProvider = this.isBuiltInProvider(host);
        if (isBuiltInProvider) {
            log.info(`Attempt to override an existing provider.`, { newEntry });
            throw new ApplicationError(ErrorCodes.CONFLICT, `Attempt to override an existing provider.`);
        }

        const orgProviders = await this.authProviderDB.findByOrgId(newEntry.organizationId);
        const existing = orgProviders.find((p) => p.host === host);
        if (existing) {
            log.info(`Provider for this host already exists.`, { newEntry });
            throw new ApplicationError(ErrorCodes.CONFLICT, `Provider for this host already exists.`);
        }

        const authProvider = this.initializeNewProvider(newEntry);
        const result = await this.authProviderDB.storeAuthProvider(authProvider, true);
        return AuthProviderEntry.redact(result);
    }

    async updateOrgAuthProvider(userId: string, entry: AuthProviderEntry.UpdateOrgEntry): Promise<AuthProviderEntry> {
        const { id, organizationId } = entry;
        await this.auth.checkPermissionOnOrganization(userId, "write_git_provider", organizationId);

        // TODO can we change this to query for the provider by id and org instead of loading all from org?
        const existing = (await this.authProviderDB.findByOrgId(organizationId)).find((p) => p.id === id);
        if (!existing) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider resource not found.");
        }

        const isAzure = this.apiConverter.toAuthProviderType(existing.type) === AuthProviderType.AZURE_DEVOPS;
        if (!isAzure) {
            entry.authorizationUrl = undefined;
            entry.tokenUrl = undefined;
        }

        const azureChanged =
            isAzure &&
            (existing.oauth.authorizationUrl !== entry.authorizationUrl || existing.oauth.tokenUrl !== entry.tokenUrl);
        const changed =
            entry.clientId !== existing.oauth.clientId ||
            (entry.clientSecret && entry.clientSecret !== existing.oauth.clientSecret) ||
            azureChanged;

        if (!changed) {
            return existing;
        }

        // update config on demand
        const oauth: OAuth2Config = {
            ...existing.oauth,
            clientId: entry.clientId || existing.oauth?.clientId,
            clientSecret: entry.clientSecret || existing.oauth?.clientSecret, // FE may send empty ("") if not changed
            authorizationUrl: entry.authorizationUrl || existing.oauth.authorizationUrl,
            tokenUrl: entry.tokenUrl || existing.oauth.tokenUrl,
        };
        const authProvider: AuthProviderEntry = {
            ...existing,
            oauth,
            status: "pending",
        };

        const result = await this.authProviderDB.storeAuthProvider(authProvider, true);
        return AuthProviderEntry.redact(result);
    }

    private initializeNewProvider(newEntry: AuthProviderEntry.NewEntry): AuthProviderEntry {
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
            case "AzureDevOps":
                // We don't support Azure DevOps for PAYG users yet because our auth flow is based on provider's host
                if (this.config.hostUrl.url.host === "gitpod.io") {
                    throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unexpected service type.");
                }
                const { authorizationUrl, tokenUrl } = newEntry;
                if (!authorizationUrl || !tokenUrl) {
                    throw new ApplicationError(ErrorCodes.BAD_REQUEST, "authorizationUrl and tokenUrl are required.");
                }
                urls = azureUrls({ authorizationUrl, tokenUrl });
                break;
        }
        if (!urls) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unexpected service type.");
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

    private callbackUrl = () => {
        const pathname = `/auth/callback`;
        return this.config.hostUrl.with({ pathname }).toString();
    };

    async isHostReachable(host: string): Promise<boolean> {
        try {
            // Don't attempt to follow redirects, and manually check response status code
            // set the timeout to a rather high number, because we're seeing Bitbuckets in the wild that have a response time of 10 seconds for unauthenticated users.
            const resp = await fetch(`https://${host}`, { timeout: 15000, redirect: "manual" });
            return resp.status <= 399;
        } catch (error) {
            console.log(`Host is not reachable: ${host}`);
        }
        return false;
    }
}
