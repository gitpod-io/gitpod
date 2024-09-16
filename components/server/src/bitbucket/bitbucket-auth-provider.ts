/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Bitbucket } from "bitbucket";
import express from "express";
import { injectable } from "inversify";
import { AuthUserSetup } from "../auth/auth-provider";
import { GenericAuthProvider } from "../auth/generic-auth-provider";
import { BitbucketOAuthScopes } from "@gitpod/public-api-common/lib/auth-providers";

@injectable()
export class BitbucketAuthProvider extends GenericAuthProvider {
    get info(): AuthProviderInfo {
        return {
            ...this.defaultInfo(),
            scopes: BitbucketOAuthScopes.ALL,
            requirements: {
                default: BitbucketOAuthScopes.Requirements.DEFAULT,
                publicRepo: BitbucketOAuthScopes.Requirements.DEFAULT,
                privateRepo: BitbucketOAuthScopes.Requirements.DEFAULT,
            },
        };
    }

    /**
     * Augmented OAuthConfig for Bitbucket
     */
    protected get oauthConfig() {
        const oauth = this.params.oauth!;
        const scopeSeparator = " ";
        return <typeof oauth>{
            ...oauth,
            authorizationUrl: oauth.authorizationUrl || `https://${this.params.host}/site/oauth2/authorize`,
            tokenUrl: oauth.tokenUrl || `https://${this.params.host}/site/oauth2/access_token`,
            settingsUrl: oauth.settingsUrl || `https://${this.params.host}/account/settings/app-authorizations/`,
            scope: BitbucketOAuthScopes.ALL.join(scopeSeparator),
            scopeSeparator,
        };
    }

    protected get tokenUsername(): string {
        return "x-token-auth";
    }

    authorize(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        state: string,
        scope?: string[],
    ) {
        super.authorize(req, res, next, state, scope ? scope : BitbucketOAuthScopes.Requirements.DEFAULT);
    }

    protected get baseURL() {
        return `https://${this.params.host}`;
    }

    protected async readAuthUserSetup(accessToken: string, _tokenResponse: object) {
        try {
            const options = {
                notice: false,
                auth: { token: accessToken },
                baseUrl: `https://api.${this.params.host}/2.0`,
            };
            const api = new Bitbucket(options);

            const { data, headers } = await api.user.get({});
            const user = data;

            const emails = (await api.user.listEmails({ pagelen: 100 })).data;
            const primaryEmail = emails.values.find((x: { is_primary: boolean; email: string }) => x.is_primary).email;

            const currentScopes = this.normalizeScopes(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                (headers as any)["x-oauth-scopes"].split(",").map((s: string) => s.trim()),
            );

            return <AuthUserSetup>{
                authUser: {
                    authId: user.account_id,
                    authName: user.username,
                    primaryEmail: primaryEmail,
                    name: user.display_name,
                    avatarUrl: user.links!.avatar!.href,
                    company: user.website,
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
        if (set.has(BitbucketOAuthScopes.REPOSITORY_WRITE)) {
            set.add(BitbucketOAuthScopes.REPOSITORY_READ);
        }
        if (set.has(BitbucketOAuthScopes.PULL_REQUEST_READ)) {
            // https://developer.atlassian.com/cloud/bitbucket/bitbucket-cloud-rest-api-scopes/#pullrequest
            set.add(BitbucketOAuthScopes.REPOSITORY_READ);
        }
        if (set.has(BitbucketOAuthScopes.PULL_REQUEST_WRITE)) {
            // https://developer.atlassian.com/cloud/bitbucket/bitbucket-cloud-rest-api-scopes/#pullrequest-write
            set.add(BitbucketOAuthScopes.REPOSITORY_WRITE);
            set.add(BitbucketOAuthScopes.REPOSITORY_READ);
            set.add(BitbucketOAuthScopes.PULL_REQUEST_READ);
        }
        for (const item of set.values()) {
            if (!BitbucketOAuthScopes.Requirements.DEFAULT.includes(item)) {
                set.delete(item);
            }
        }
        return Array.from(set).sort();
    }
}
