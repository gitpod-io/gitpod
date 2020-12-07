/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import * as express from 'express';
import { User } from '@gitpod/gitpod-protocol';
import { GitpodCookie } from './gitpod-cookie';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Env } from "../env";
import { AuthFlow } from './auth-provider';
import { HostContextProvider } from './host-context-provider';
import { AuthProviderService } from './auth-provider-service';

/**
 * The login completion handler pulls the strings between the OAuth2 flow, the ToS flow, and the session management.
 */
@injectable()
export class LoginCompletionHandler {

    @inject(GitpodCookie) protected gitpodCookie: GitpodCookie;
    @inject(Env) protected env: Env;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;

    complete(request: express.Request, response: express.Response, { user, returnToUrl, authHost, elevateScopes }: LoginCompletionHandler.CompleteParams) {
        let resolveFn = () => {};
        let rejectFn = (err: any) => {};
        const resultPromise = new Promise((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });

        request.login(user, async err => {
            const logContext = LogContext.from({ user, request });

            if (err) {
                log.error(logContext, `Redirect to /sorry on login`, err, { err });
                response.redirect(this.env.hostUrl.asSorry("Oops! Something went wrong during login.").toString());
                rejectFn(err);
                return;
            }
            // Update session info
            let returnTo = returnToUrl || this.env.hostUrl.asDashboard().toString();
            if (elevateScopes) {
                const elevateScopesUrl = this.env.hostUrl.withApi({
                    pathname: '/authorize',
                    search: `returnTo=${encodeURIComponent(returnTo)}&host=${authHost}&scopes=${elevateScopes.join(',')}`
                }).toString();
                returnTo = elevateScopesUrl;
            }
            log.info(logContext, `User is logged in successfully. Redirect to: ${returnTo}`, { });

            // Clean up the session & avoid loops
            request.session!['tosFlowInfo'] = undefined;
            await AuthFlow.clear(request.session);

            // Create Gitpod 🍪 before the redirect
            this.gitpodCookie.setCookie(response);
            response.redirect(returnTo);
            resolveFn();
        });

        const markAsVerified = async () => {
            if (authHost) {
                await this.updateAuthProviderAsVerified(authHost, user);
            }
        }

        return resultPromise.then(() => markAsVerified());
    }

    protected async updateAuthProviderAsVerified(hostname: string, user: User) {
        const hostCtx = this.hostContextProvider.get(hostname);
        if (hostCtx) {
            const { config } = hostCtx.authProvider;
            const { id, verified, ownerId, builtin } = config;
            if (!builtin && !verified && user.id === ownerId) {
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