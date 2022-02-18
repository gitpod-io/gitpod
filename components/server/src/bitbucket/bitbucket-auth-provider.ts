/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Bitbucket } from "bitbucket";
import * as express from "express";
import { injectable } from "inversify";
import { AuthUserSetup } from "../auth/auth-provider";
import { GenericAuthProvider } from "../auth/generic-auth-provider";
import { BitbucketOAuthScopes } from "./bitbucket-oauth-scopes";

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
        }
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
            scopeSeparator
        };
    }

    protected get tokenUsername(): string {
        return "x-token-auth";
    }

    authorize(req: express.Request, res: express.Response, next: express.NextFunction, scope?: string[]): void {
        super.authorize(req, res, next, scope ? scope : BitbucketOAuthScopes.Requirements.DEFAULT);
    }

    protected get baseURL() {
        return `https://${this.params.host}`;
    }

    protected readAuthUserSetup = async (accessToken: string, _tokenResponse: object) => {
        try {

            const options = {
                notice: false,
                auth: { token: accessToken },
                baseUrl: `https://api.${this.params.host}/2.0`,
            };
            const api = new Bitbucket(options);

            const { data, headers } = (await api.user.get({}));
            const user = data;

            const emails = (await api.user.listEmails({ pagelen: 100 })).data;
            const primaryEmail = emails.values.find((x: { is_primary: boolean, email: string }) => x.is_primary).email;

            const currentScopes = this.normalizeScopes((headers as any)["x-oauth-scopes"]
                .split(",")
                .map((s: string) => s.trim())
            );

            return <AuthUserSetup>{
                authUser: {
                    authId: user.account_id,
                    authName: user.username,
                    primaryEmail: primaryEmail,
                    name: user.display_name,
                    avatarUrl: user.links!.avatar!.href
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
        if (set.has("issue:write")) {
            set.add("repository:write")
        }
        if (set.has('repository:write')) {
            set.add('repository');
        }
        if (set.has('pullrequest:write')) {
            set.add('pullrequest');
        }
        for (const item of set.values()) {
            if (!(BitbucketOAuthScopes.Requirements.DEFAULT.includes(item))) {
                set.delete(item);
            }
        }
        return Array.from(set).sort();
    }

}