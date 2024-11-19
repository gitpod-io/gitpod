/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import express from "express";
import { inject, injectable } from "inversify";
import { AuthUserSetup } from "../auth/auth-provider";
import { GenericAuthProvider } from "../auth/generic-auth-provider";
import { BitbucketServerApi } from "./bitbucket-server-api";
import { BitbucketServerOAuthScopes } from "@gitpod/public-api-common/lib/auth-providers";

@injectable()
export class BitbucketServerAuthProvider extends GenericAuthProvider {
    @inject(BitbucketServerApi) protected readonly api: BitbucketServerApi;

    get info(): AuthProviderInfo {
        return {
            ...this.defaultInfo(),
            scopes: BitbucketServerOAuthScopes.ALL,
            requirements: {
                default: BitbucketServerOAuthScopes.Requirements.DEFAULT,
                publicRepo: BitbucketServerOAuthScopes.Requirements.DEFAULT,
                privateRepo: BitbucketServerOAuthScopes.Requirements.DEFAULT,
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
            authorizationUrl: oauth.authorizationUrl || `https://${this.params.host}/rest/oauth2/latest/authorize`,
            tokenUrl: oauth.tokenUrl || `https://${this.params.host}/rest/oauth2/latest/token`,
            settingsUrl: oauth.settingsUrl,
            scope: BitbucketServerOAuthScopes.ALL.join(scopeSeparator),
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
        super.authorize(req, res, next, state, scope ? scope : BitbucketServerOAuthScopes.Requirements.DEFAULT);
    }

    protected async readAuthUserSetup(accessToken: string, _tokenResponse: object) {
        try {
            const username = await this.api.currentUsername(accessToken);
            const userProfile = await this.api.getUserProfile(accessToken, username);
            const avatarUrl = this.api.getAvatarUrl(username);
            return <AuthUserSetup>{
                authUser: {
                    // e.g. 105
                    authId: `${userProfile.id!}`,
                    // HINT: userProfile.name is used to match permission in repo/webhook services
                    authName: userProfile.name,
                    primaryEmail: userProfile.emailAddress!,
                    name: userProfile.displayName!,
                    avatarUrl,
                },
                currentScopes: BitbucketServerOAuthScopes.Requirements.DEFAULT,
            };
        } catch (error) {
            log.error(`(${this.strategyName}) Reading current user info failed`, error, { error });
            throw error;
        }
    }
}
