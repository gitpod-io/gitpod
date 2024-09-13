/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { injectable, inject } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { AzureDevOpsScopes } from "./scopes";
import { AzureDevOpsApi } from "./azure-api";
import { GenericAuthProvider } from "../auth/generic-auth-provider";
import { AuthUserSetup } from "../auth/auth-provider";
import { oauthUrls } from "./azure-urls";

@injectable()
export class AzureDevOpsAuthProvider extends GenericAuthProvider {
    @inject(AzureDevOpsApi) protected readonly azureDevOpsApi: AzureDevOpsApi;

    get info(): AuthProviderInfo {
        return {
            ...this.defaultInfo(),
            scopes: AzureDevOpsScopes.All,
            requirements: {
                default: AzureDevOpsScopes.Requirements.DEFAULT,
                publicRepo: AzureDevOpsScopes.Requirements.REPO,
                privateRepo: AzureDevOpsScopes.Requirements.REPO,
            },
        };
    }

    /**
     * Augmented OAuthConfig for GitLab
     */
    protected get oauthConfig() {
        const oauth = this.params.oauth!;
        const defaultUrls = oauthUrls(oauth);
        const scopeSeparator = " ";
        return <typeof oauth>{
            ...oauth,
            authorizationUrl: oauth.authorizationUrl || defaultUrls.authorizationUrl,
            tokenUrl: oauth.tokenUrl || defaultUrls.tokenUrl,
            settingsUrl: oauth.settingsUrl || defaultUrls.settingsUrl,
            // offline_access is required but will not respond as scopes
            scope: [...AzureDevOpsScopes.All, ...AzureDevOpsScopes.Requirements.APPEND_WHEN_FETCHING].join(
                scopeSeparator,
            ),
            scopeSeparator,
        };
    }

    authorize(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        state: string,
        scope?: string[],
    ) {
        super.authorize(req, res, next, state, scope ? scope : AzureDevOpsScopes.Requirements.DEFAULT);
    }

    protected get baseURL() {
        return `https://${this.params.host}`;
    }

    protected async readAuthUserSetup(accessToken: string, tokenResponse: object) {
        try {
            const profile = await this.azureDevOpsApi.getAuthenticatedUser(accessToken);
            return <AuthUserSetup>{
                authUser: {
                    authId: profile.id,
                    authName: profile.displayName,
                    primaryEmail: profile.emailAddress,
                    name: profile.displayName,
                    avatarUrl: profile.avatar,
                },
                currentScopes: this.readScopesFromVerifyParams(tokenResponse),
            };
        } catch (error) {
            log.error(`Reading current user info failed`, error, { error });
            throw error;
        }
    }

    protected readScopesFromVerifyParams(params: any) {
        if (params && typeof params.scope === "string") {
            return this.normalizeScopes((params.scope as string).split(" "));
        }
        return [];
    }
    protected normalizeScopes(scopes: string[]) {
        const set = new Set(scopes);
        return Array.from(set).sort();
    }
}
