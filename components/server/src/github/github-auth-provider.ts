/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import * as express from "express";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { GitHubScope } from "./scopes";
import { AuthUserSetup } from "../auth/auth-provider";
import { Octokit } from "@octokit/rest";
import { GitHubApiError } from "./api";
import { GenericAuthProvider } from "../auth/generic-auth-provider";
import { oauthUrls } from "./github-urls";
import { HostContext } from "../auth/host-context";

@injectable()
export class GitHubAuthProvider extends GenericAuthProvider {
    get type(): string {
        return "GitHub";
    }

    get scopeRequirements() {
        return {
            default: GitHubScope.Requirements.DEFAULT,
            publicRepo: GitHubScope.Requirements.PUBLIC_REPO,
            privateRepo: GitHubScope.Requirements.PRIVATE_REPO,
        };
    }

    /**
     * Augmented OAuthConfig for GitHub
     */
    protected oauthConfig(hostContext: HostContext) {
        const oauth = hostContext.config.oauth;
        const defaultUrls = oauthUrls(hostContext.host);
        const scopeSeparator = ",";
        return <typeof oauth>{
            ...oauth!,
            authorizationUrl: oauth.authorizationUrl || defaultUrls.authorizationUrl,
            tokenUrl: oauth.tokenUrl || defaultUrls.tokenUrl,
            scope: GitHubScope.All.join(scopeSeparator),
            scopeSeparator,
        };
    }

    authorize(
        hostContext: HostContext,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        scope?: string[],
    ): void {
        super.authorize(hostContext, req, res, next, scope ? scope : GitHubScope.Requirements.DEFAULT);
    }

    /**
     * +----+------------------------------------------+--------------------------------+
     * |    |                Enterprise                |             GitHub             |
     * +----+------------------------------------------+--------------------------------+
     * | v3 | https://[YOUR_HOST]/api/v3               | https://api.github.com         |
     * | v4 | https://[YOUR_HOST]/api/graphql          | https://api.github.com/graphql |
     * +----+------------------------------------------+--------------------------------+
     */
    protected baseURL(host: string) {
        return host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;
    }

    protected async readAuthUserSetup(hostContext: HostContext, accessToken: string, _tokenResponse: object) {
        const oauthConfig = hostContext.config.oauth;
        const api = new Octokit({
            auth: accessToken,
            request: {
                timeout: 5000,
            },
            userAgent: this.USER_AGENT(oauthConfig.callBackUrl),
            baseUrl: this.baseURL(hostContext.host),
        });
        const fetchCurrentUser = async () => {
            const response = await api.users.getAuthenticated();
            if (response.status !== 200) {
                throw new GitHubApiError(response);
            }
            return response;
        };
        const fetchUserEmails = async () => {
            const response = await api.users.listEmailsForAuthenticated({});
            if (response.status !== 200) {
                throw new GitHubApiError(response);
            }
            return response.data;
        };
        const currentUserPromise = this.retry(() => fetchCurrentUser());
        const userEmailsPromise = this.retry(() => fetchUserEmails());

        try {
            const [currentUser, userEmails] = await Promise.all([currentUserPromise, userEmailsPromise]);
            const {
                data: { id, login, avatar_url, name, company, created_at },
                headers,
            } = currentUser;

            // https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/
            // e.g. X-OAuth-Scopes: repo, user
            const currentScopes = this.normalizeScopes(
                (headers as any)["x-oauth-scopes"].split(oauthConfig.scopeSeparator!).map((s: string) => s.trim()),
            );

            const filterPrimaryEmail = (emails: typeof userEmails) => {
                if (this.config.blockNewUsers) {
                    // if there is any verified email with a domain that is in the blockNewUsersPassList then use this email as primary email
                    const emailDomainInPasslist = (mail: string) =>
                        this.config.blockNewUsers.passlist.some((e) => mail.endsWith(`@${e}`));
                    const result = emails.filter((e) => e.verified).filter((e) => emailDomainInPasslist(e.email));
                    if (result.length > 0) {
                        return result[0].email;
                    }
                }
                // otherwise use GitHub's primary email as Gitpod's primary email
                return emails.filter((e) => e.primary)[0].email;
            };

            return <AuthUserSetup>{
                authUser: {
                    authId: String(id),
                    authName: login,
                    avatarUrl: avatar_url,
                    name,
                    primaryEmail: filterPrimaryEmail(userEmails),
                    company,
                    created_at: created_at ? new Date(created_at).toISOString() : undefined,
                },
                currentScopes,
            };
        } catch (error) {
            log.error(`(${this.strategyName}) Reading current user info failed`, error, { error });
            throw error;
        }
    }

    protected normalizeScopes(scopes: string[]) {
        const set = new Set(scopes);
        if (set.has("repo")) {
            set.add("public_repo");
        }
        if (set.has("user")) {
            set.add("user:email");
        }
        return Array.from(set).sort();
    }
}
