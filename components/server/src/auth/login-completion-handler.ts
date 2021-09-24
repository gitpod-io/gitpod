/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import * as express from 'express';
import { User } from '@gitpod/gitpod-protocol';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Config } from "../config";
import { AuthFlow } from './auth-provider';
import { HostContextProvider } from './host-context-provider';
import { AuthProviderService } from './auth-provider-service';
import { TosFlow } from '../terms/tos-flow';
import { increaseLoginCounter } from '../../src/prometheus-metrics';
import { IAnalyticsWriter } from '@gitpod/gitpod-protocol/lib/analytics';

/**
 * The login completion handler pulls the strings between the OAuth2 flow, the ToS flow, and the session management.
 */
@injectable()
export class LoginCompletionHandler {

    @inject(Config) protected readonly config: Config;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;

    async complete(request: express.Request, response: express.Response, { user, returnToUrl, authHost, elevateScopes }: LoginCompletionHandler.CompleteParams) {
        const logContext = LogContext.from({ user, request });

        try {
            await new Promise<void>((resolve, reject) => {
                request.login(user, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } catch(err) {
            // Clean up the session & avoid loops
            await TosFlow.clear(request.session);
            await AuthFlow.clear(request.session);

            if (authHost) {
                increaseLoginCounter("failed", authHost)
            }
            log.error(logContext, `Redirect to /sorry on login`, err, { err, session: request.session });
            response.redirect(this.config.hostUrl.asSorry("Oops! Something went wrong during login.").toString());
            return;
        }

        // Update session info
        let returnTo = returnToUrl || this.config.hostUrl.asDashboard().toString();
        if (elevateScopes) {
            const elevateScopesUrl = this.config.hostUrl.withApi({
                pathname: '/authorize',
                search: `returnTo=${encodeURIComponent(returnTo)}&host=${authHost}&scopes=${elevateScopes.join(',')}`
            }).toString();
            returnTo = elevateScopesUrl;
        }
        log.info(logContext, `User is logged in successfully. Redirect to: ${returnTo}`, { session: request.session });

        // Don't forget to mark a dynamic provider as verified
        if (authHost) {
            await this.updateAuthProviderAsVerified(authHost, user);
        }

        // Clean up the session & avoid loops
        await TosFlow.clear(request.session);
        await AuthFlow.clear(request.session);

        if (authHost) {

            increaseLoginCounter("succeeded", authHost);

            //fill identities from user
            let identities: { github_slug?: String, gitlab_slug?: String, bitbucket_slug?: String } = {};
            user.identities.forEach((value) => {
                switch(value.authProviderId) {
                    case "Public-GitHub": {
                        identities.github_slug = value.authName;
                        break;
                    }
                    case "Public-GitLab": {
                        identities.gitlab_slug = value.authName;
                        break;
                    }
                    case "Public-Bitbucket": {
                        identities.bitbucket_slug = value.authName;
                        break;
                    }
                }
            });
            const coords = request.get("x-glb-client-city-lat-long")?.split(", ");

            //make new complete identify call for each login
            this.analytics.identify({
                anonymousId: request.cookies.ajs_anonymous_id,
                userId:user.id,
                context: {
                    "ip": request.ips[0],
                    "userAgent": request.get("User-Agent"),
                    "location": {
                        "city": request.get("x-glb-client-city"),
                        "country": request.get("x-glb-client-region"),
                        "latitude": coords?.length == 2 ? coords[0] : undefined,
                        "longitude": coords?.length == 2 ? coords[1] : undefined
                    }
                },
                traits: {
                    ...identities,
                    "email": User.getPrimaryEmail(user),
                    "full_name": user.fullName,
                    "created_at": user.creationDate
                }
            });

            //track the login
            this.analytics.track({
                userId: user.id,
                event: "login",
                properties: {
                    "loginContext": authHost
                }
            });
        }
        response.redirect(returnTo);
    }

    protected async updateAuthProviderAsVerified(hostname: string, user: User) {
        const hostCtx = this.hostContextProvider.get(hostname);
        if (hostCtx) {
            const { params: config } = hostCtx.authProvider;
            const { id, verified, ownerId, builtin } = config;
            if (!builtin && !verified) {
                try {
                    await this.authProviderService.markAsVerified({ id, ownerId });
                } catch (error) {
                    log.error(LogContext.from({ user }), `Failed to mark AuthProvider as verified!`, { error });
                }
            }
        }
    }
}
export namespace LoginCompletionHandler {
    export interface CompleteParams {
        user: User;
        returnToUrl?: string;
        authHost?: string;
        elevateScopes?: string[];
    }
}