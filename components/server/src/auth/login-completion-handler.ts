/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import * as express from "express";
import { User } from "@gitpod/gitpod-protocol";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config } from "../config";
import { HostContextProvider } from "./host-context-provider";
import { AuthProviderService } from "./auth-provider-service";
import { reportJWTCookieIssued, reportLoginCompleted } from "../prometheus-metrics";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { trackLogin } from "../analytics";
import { SessionHandler } from "../session-handler";
import { AuthJWT } from "./jwt";

/**
 * The login completion handler pulls the strings between the OAuth2 flow, the ToS flow, and the session management.
 */
@injectable()
export class LoginCompletionHandler {
    @inject(Config) protected readonly config: Config;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;
    @inject(AuthJWT) protected readonly authJWT: AuthJWT;
    @inject(SessionHandler) protected readonly session: SessionHandler;

    async complete(
        request: express.Request,
        response: express.Response,
        { user, returnToUrl, authHost, elevateScopes }: LoginCompletionHandler.CompleteParams,
    ) {
        const logContext = LogContext.from({ user, request });

        try {
            await new Promise<void>((resolve, reject) => {
                request.login(user, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (err) {
            reportLoginCompleted("failed", "git");
            log.error(logContext, `Failed to login user. Redirecting to /sorry on login.`, err);
            response.redirect(this.config.hostUrl.asSorry("Oops! Something went wrong during login.").toString());
            return;
        }

        // Update session info
        let returnTo = returnToUrl || this.config.hostUrl.asDashboard().toString();
        if (elevateScopes) {
            const elevateScopesUrl = this.config.hostUrl
                .withApi({
                    pathname: "/authorize",
                    search: `returnTo=${encodeURIComponent(returnTo)}&host=${authHost}&scopes=${elevateScopes.join(
                        ",",
                    )}`,
                })
                .toString();
            returnTo = elevateScopesUrl;
        }

        // Don't forget to mark a dynamic provider as verified
        if (authHost) {
            await this.updateAuthProviderAsVerified(authHost, user);
        }

        if (authHost) {
            /** no await */ trackLogin(user, request, authHost, this.analytics).catch((err) =>
                log.error({ userId: user.id }, "Failed to track Login.", err),
            );
        }

        const cookie = await this.session.createJWTSessionCookie(user.id);
        response.cookie(cookie.name, cookie.value, cookie.opts);
        reportJWTCookieIssued();

        log.info(logContext, `User is logged in successfully. Redirect to: ${returnTo}`);
        reportLoginCompleted("succeeded", "git");
        response.redirect(returnTo);
    }

    public async updateAuthProviderAsVerified(hostname: string, user: User) {
        const hostCtx = this.hostContextProvider.get(hostname);
        log.info("Updating auth provider as verified", { hostname });
        if (hostCtx) {
            const { params: config } = hostCtx.authProvider;
            const { id, verified, builtin } = config;
            if (!builtin && !verified) {
                try {
                    await this.authProviderService.markAsVerified({ id, userId: user.id });
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
