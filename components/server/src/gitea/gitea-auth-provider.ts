/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 import * as express from "express";
 import { injectable } from 'inversify';
 import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
 import { AuthProviderInfo } from '@gitpod/gitpod-protocol';
 import { GiteaScope } from "./scopes";
 import { UnconfirmedUserException } from "../auth/errors";
 import { Gitea } from "./api";
 import { GenericAuthProvider } from "../auth/generic-auth-provider";
 import { AuthUserSetup } from "../auth/auth-provider";
 import { oauthUrls } from "./gitea-urls";

 @injectable()
 export class GiteaAuthProvider extends GenericAuthProvider {


     get info(): AuthProviderInfo {
         return {
             ...this.defaultInfo(),
             scopes: GiteaScope.All,
             requirements: {
                 default: GiteaScope.Requirements.DEFAULT,
                 publicRepo: GiteaScope.Requirements.PUBLIC_REPO,
                 privateRepo: GiteaScope.Requirements.PRIVATE_REPO,
             },
         }
     }

     /**
      * Augmented OAuthConfig for Gitea
      */
     protected get oauthConfig() {
         const oauth = this.params.oauth!;
         const defaultUrls = oauthUrls(this.params.host);
         const scopeSeparator = " ";
         return <typeof oauth>{
             ...oauth,
             authorizationUrl: oauth.authorizationUrl || defaultUrls.authorizationUrl,
             tokenUrl: oauth.tokenUrl || defaultUrls.tokenUrl,
            //  settingsUrl: oauth.settingsUrl || defaultUrls.settingsUrl,
             scope: GiteaScope.All.join(scopeSeparator),
             scopeSeparator
         };
     }

     authorize(req: express.Request, res: express.Response, next: express.NextFunction, scope?: string[]): void {
         super.authorize(req, res, next, scope ? scope : GiteaScope.Requirements.DEFAULT);
     }

     protected get baseURL() {
         return `https://${this.params.host}`;
     }

     protected readAuthUserSetup = async (accessToken: string, tokenResponse: object) => {
         const api = Gitea.create(this.baseURL, accessToken);
         const getCurrentUser = async () => {
             const response = await api.user.userGetCurrent();
             return response.data as unknown as Gitea.User;
         }
         try {
             const result = await getCurrentUser();
             if (result) {
                 if (!result.active || !result.created || !result.prohibit_login) {
                    throw UnconfirmedUserException.create("Please confirm and activate your Gitea account and try again.", result);
                 }
             }

             return <AuthUserSetup>{
                 authUser: {
                     authId: String(result.id),
                     authName: result.login,
                     avatarUrl: result.avatar_url || undefined,
                     name: result.full_name,
                     primaryEmail: result.email
                 },
                 currentScopes: this.readScopesFromVerifyParams(tokenResponse)
             }
         } catch (error) {
            // TODO: cleanup & check for Gitea instead of Gitlab
            //  if (error && typeof error.description === "string" && error.description.includes("403 Forbidden")) {
            //      // If Gitlab is configured to disallow OAuth-token based API access for unconfirmed users, we need to reject this attempt
            //      // 403 Forbidden  - You (@...) must accept the Terms of Service in order to perform this action. Please access GitLab from a web browser to accept these terms.
            //      throw UnconfirmedUserException.create(error.description, error);
            //  } else {
                 log.error(`(${this.strategyName}) Reading current user info failed`, error, { accessToken, error });
                 throw error;
            //  }
         }

     }

     protected readScopesFromVerifyParams(params: any) {
         if (params && typeof params.scope === 'string') {
             return this.normalizeScopes(params.scope.split(' '));
         }
         return [];
     }

     protected normalizeScopes(scopes: string[]) {
         const set = new Set(scopes);
         return Array.from(set).sort();
     }

 }
