/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import * as express from "express"
import { AuthProviderInfo } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { GitHubScope } from "./scopes";
import { AuthUserSetup } from "../auth/auth-provider";
import * as GitHub from "@octokit/rest"
import { GitHubApiError } from "./api";
import { GenericAuthProvider } from "../auth/generic-auth-provider";
import { oauthUrls } from "./github-urls";

@injectable()
export class GitHubAuthProvider extends GenericAuthProvider {

    get info(): AuthProviderInfo {
        return {
            ...this.defaultInfo(),
            scopes: GitHubScope.All,
            requirements: {
                default: GitHubScope.Requirements.DEFAULT,
                publicRepo: GitHubScope.Requirements.PUBLIC_REPO,
                privateRepo: GitHubScope.Requirements.PRIVATE_REPO,
            },
        }
    }

    /**
     * Augmented OAuthConfig for GitHub
     */
    protected get oauthConfig() {
        const oauth = this.config.oauth!;
        const defaultUrls = oauthUrls(this.config.host);
        const scopeSeparator = ",";
        return <typeof oauth>{
            ...oauth!,
            authorizationUrl: oauth.authorizationUrl || defaultUrls.authorizationUrl,
            tokenUrl: oauth.tokenUrl || defaultUrls.tokenUrl,
            scope: GitHubScope.All.join(scopeSeparator),
            scopeSeparator
        };
    }

    authorize(req: express.Request, res: express.Response, next: express.NextFunction, scope?: string[]): void {
        super.authorize(req, res, next, scope ? scope : GitHubScope.Requirements.DEFAULT);
    }

    /**
     * +----+------------------------------------------+--------------------------------+
     * |    |                Enterprise                |             GitHub             |
     * +----+------------------------------------------+--------------------------------+
     * | v3 | https://[YOUR_HOST]/api/v3               | https://api.github.com         |
     * | v4 | https://[YOUR_HOST]/api/graphql          | https://api.github.com/graphql |
     * +----+------------------------------------------+--------------------------------+
     */
    protected get baseURL() {
        return (this.config.host === 'github.com') ? 'https://api.github.com' : `https://${this.config.host}/api/v3`;
    }

    protected readAuthUserSetup = async (accessToken: string, _tokenResponse: object) => {
        const api = new GitHub({
            auth: accessToken,
            request: {
                timeout: 5000,
            },
            userAgent: this.USER_AGENT,
            baseUrl: this.baseURL
        });
        const fetchCurrentUser = async () => {
            const response = await api.users.getAuthenticated();
            if (response.status !== 200) {
                throw new GitHubApiError(response);
            }
            return response;
        }
        const fetchPrimaryEmail = async () => {
            const response = await api.users.listEmails({});
            if (response.status !== 200) {
                throw new GitHubApiError(response);
            }
            return response.data;
        }
        const currentUserPromise = this.retry(() => fetchCurrentUser());
        const userEmailsPromise = this.retry(() => fetchPrimaryEmail());

        try {
            const [ { data: { id, login, avatar_url, name }, headers }, userEmails ] = await Promise.all([ currentUserPromise, userEmailsPromise ]);

            // https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/
            // e.g. X-OAuth-Scopes: repo, user
            const currentScopes = this.normalizeScopes((headers as any)["x-oauth-scopes"]
                .split(this.oauthConfig.scopeSeparator!)
                .map((s: string) => s.trim())
            );

            return <AuthUserSetup>{
                authUser: {
                    authId: String(id),
                    authName: login,
                    avatarUrl: avatar_url,
                    name,
                    primaryEmail: userEmails.filter(e => e.primary)[0].email
                },
                currentScopes
            }

        } catch (error) {
            log.error(`(${this.strategyName}) Reading current user info failed`, error, { accessToken, error });
            throw error;
        }
    }

    protected normalizeScopes(scopes: string[]) {
        const set = new Set(scopes);
        if (set.has('repo')) {
            set.add('public_repo');
        }
        if (set.has('user')) {
            set.add('user:email');
        }
        return Array.from(set).sort();
    }

}
