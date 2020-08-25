/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import * as express from 'express';
import { Authenticator } from "../auth/authenticator";
import { Env } from "../env";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { GitpodCookie } from "../auth/gitpod-cookie";
import { AuthorizationService } from "./authorization-service";
import { Permission } from "@gitpod/gitpod-protocol/lib/permission";
import { UserService } from "./user-service";
import { WorkspacePortAuthorizationService } from "./workspace-port-auth-service";
import { parseWorkspaceIdFromHostname } from "@gitpod/gitpod-protocol/lib/util/parse-workspace-id";
import { SessionHandlerProvider } from "../session-handler";
import { URL } from 'url';
import { saveSession, getRequestingClientInfo } from "../express-util";
import { User } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";

@injectable()
export class UserController {
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(Authenticator) protected readonly authenticator: Authenticator;
    @inject(Env) protected readonly env: Env;
    @inject(GitpodCookie) protected readonly gitpodCookie: GitpodCookie;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(UserService) protected readonly userService: UserService;
    @inject(WorkspacePortAuthorizationService) protected readonly workspacePortAuthService: WorkspacePortAuthorizationService;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(SessionHandlerProvider) protected readonly sessionHandlerProvider: SessionHandlerProvider;

    get apiRouter(): express.Router {
        const router = express.Router();

        router.get("/login", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (req.isAuthenticated()) {
                log.info({ sessionId: req.sessionID }, "(Auth) User is already authenticated.", { 'login-flow': true });
                // redirect immediately
                const redirectTo = this.getSafeReturnToParam(req) || this.env.hostUrl.asDashboard().toString();
                res.redirect(redirectTo);
                return;
            }
            const clientInfo = getRequestingClientInfo(req);
            log.info({ sessionId: req.sessionID }, "(Auth) User started the login process", { 'login-flow': true, clientInfo });

            // Try to guess auth host from request
            await this.augmentLoginRequest(req);

            // If there is no known auth host, we need to ask the user
            const redirectToLoginPage = !req.query.host;
            if (redirectToLoginPage) {
                const returnTo = this.getSafeReturnToParam(req);
                const search = returnTo ? `returnTo=${returnTo}` : '';
                const loginPageUrl = this.env.hostUrl.asLogin().with({ search }).toString();
                res.redirect(loginPageUrl);
                return;
            }

            // Make sure, the session is stored before we eagerly redirect to GitHub/GitLab/...
            try {
                await retryAsync(3, saveSession(req));
            } catch (error) {
                log.error(`Login failed due to session save error; redirecting to /sorry`, { req, error, clientInfo });
                res.redirect(this.getSorryUrl("Login failed 🦄 Please try again"));
            }

            // Proceed with login
            this.authenticator.authenticate(req, res, next);
        });
        router.get("/authorize", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (!req.user) {
                res.sendStatus(401);
                return;
            }
            this.authenticator.authorize(req, res, next);
        });
        const branding = this.env.brandingConfig;
        router.get("/logout", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            let redirectToUrl = req.query.redirect || req.query.redirect;
            redirectToUrl = redirectToUrl || branding.redirectUrlAfterLogout;
            redirectToUrl = redirectToUrl || this.env.hostUrl.toString();

            const redirect = () => {
                this.gitpodCookie.unsetCookie(res);
                this.sessionHandlerProvider.clearSessionCookie(res, this.env);
                res.redirect(redirectToUrl);
            }
            if (req.isAuthenticated()) {
                req.logout();
            }
            if (req.session) {
                req.session.destroy(error => {
                    if (error) {
                        log.warn({ sessionId: req.sessionID }, "(Auth) Error on Logout.", { error, req });
                    }
                    redirect();
                });
            } else {
                redirect();
            }
        });
        router.get("/refresh-login", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            // This endpoint is necessary as calls over ws (our way of communicating with /api) do not update the browsers cookie
            req.session!.touch(console.error);  // Update session explicitly, just to be sure
            // Update `gitpod-user=loggedIn` as well
            this.gitpodCookie.setCookie(res);
            res.sendStatus(200);                // Carries up-to-date cookie in 'Set-Cookie' header
        });
        router.get("/auth/workspace-cookie/:instanceID", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                log.warn("unauthenticated workspace cookie fetch", { instanceId: req.params.instanceID });
                return;
            }

            const user = req.user as User;
            if (user.blocked) {
                res.sendStatus(403);
                log.warn("blocked user attempted to fetch workspace cookie", { instanceId: req.params.instanceID, userId: user.id });
                return;
            }

            const instanceID = req.params.instanceID;
            if (!instanceID) {
                res.sendStatus(400);
                log.warn("attempted to fetch workspace cookie without instance ID", { instanceId: req.params.instanceID, userId: user.id });
                return;
            }

            const [workspace, instance] = await Promise.all([
                this.workspaceDB.findByInstanceId(instanceID),
                this.workspaceDB.findInstanceById(instanceID)
            ]);
            if (!workspace || !instance) {
                res.sendStatus(404);
                log.warn("attempted to fetch workspace cookie for non-existent workspace instance", { instanceId: req.params.instanceID, userId: user.id });
                return;
            }
            if (workspace && user.id != workspace.ownerId) {
                // [cw] The user is not the workspace owner, which means they don't get the owner cookie.
                // [cw] In the future, when we introduce per-user tokens we can set the user-specific token here.

                if (workspace.shareable) {
                    // workspace is shared and hence can be accessed without the cookie.
                    res.sendStatus(200);
                    return;
                }

                res.sendStatus(403);
                log.warn("unauthorized attempted to fetch workspace cookie", { instanceId: req.params.instanceID, userId: user.id });
                return;
            }


            const token = instance.status.ownerToken;
            if (!token) {
                // no token, no problem. The dashboard will try again later.
                res.sendStatus(200);
                log.debug("attempted to fetch workspace cookie, but instance has no owner token", { instanceId: req.params.instanceID, userId: user.id });
                return;
            }

            if (res.headersSent) {
                return;
            }

            let cookiePrefix: string = this.env.hostUrl.url.host;
            cookiePrefix = cookiePrefix.replace(/^https?/, '');
            [" ", "-", "."].forEach(c => cookiePrefix = cookiePrefix.split(c).join("_"));

            const name = `_${cookiePrefix}_ws_${instanceID}_owner_`;
            res.cookie(name, token, {
                path: "/",
                httpOnly: false,
                secure: false,
                maxAge: 1000 * 60 * 60 * 24 * 1,    // 1 day
                sameSite: "lax",                    // default: true. "Lax" needed for cookie to work in the workspace domain.
                domain: `.${this.env.hostUrl.url.host}`
            });
            res.sendStatus(200);
        });
        router.get("/auth/workspace", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                return;
            }

            const user = req.user as User;
            if (user.blocked) {
                res.sendStatus(403);
                return;
            }

            const workspaceId = parseWorkspaceIdFromHostname(req.hostname);
            if (workspaceId) {
                const workspace = await this.workspaceDB.findById(workspaceId);
                if (workspace && user.id != workspace.ownerId && !workspace.shareable) {
                    log.info({ userId: user.id, workspaceId }, 'User does not own private workspace. Denied');
                    res.sendStatus(403);
                    return;
                }
            }

            res.sendStatus(200);
        });
        router.get("/auth/workspace-port/:port", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const authenticatedUser = req.isAuthenticated() && User.is(req.user) && req.user || undefined;
            const access = await this.workspacePortAuthService.authorizeWorkspacePortAccess(req.params.port, req.hostname, authenticatedUser, req.header("x-gitpod-port-auth"));
            res.sendStatus(access ? 200 : 403);
        });
        router.get("/auth/monitor", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                // Pretend there's nothing to see
                res.sendStatus(403);
                return;
            }

            const user = req.user as User;
            if (this.authService.hasPermission(user, Permission.MONITOR)) {
                res.sendStatus(200);
                return;
            }

            res.sendStatus(403);
        });

        return router;
    }

    protected getSorryUrl(message: string) {
        return this.env.hostUrl.with({ pathname: '/sorry', hash: message }).toString();
    }

    getUser(req: express.Request, res: express.Response, next: express.NextFunction): any {
        res.send(req.user);
        next();
    }

    protected async augmentLoginRequest(req: express.Request) {
        const returnToURL = this.getSafeReturnToParam(req);
        if (req.query.host) {
            // This login request points already to an auth host
            return;
        }

        // read current auth provider configs
        const authProviderConfigs = this.hostContextProvider.getAll().map(hc => hc.authProvider.config);

        // Special Context exception
        if (returnToURL) {
            const authProviderForSpecialContext = authProviderConfigs.find(c => {
                if (c.loginContextMatcher) {
                    try {
                        const matcher = new RegExp(c.loginContextMatcher);
                        return matcher.test(returnToURL)
                    } catch { /* */ }
                }
                return false;
            });
            if (authProviderForSpecialContext) {
                // the `host` param will be used by the authenticator to delegate to the auth provider
                req.query.host = authProviderForSpecialContext.host;

                log.debug({ sessionId: req.sessionID }, `Using "${authProviderForSpecialContext.type}" for login ...`, { 'login-flow': true, query: req.query, authProviderForSpecialContext });
                return;
            }
        }

        // Use the single available auth provider
        const authProvidersOnDashboard = authProviderConfigs.filter(c => !c.hiddenOnDashboard && !c.disallowLogin).map(a => a.host);
        if (authProvidersOnDashboard.length === 1) {
            req.query.host = authProvidersOnDashboard[0];
            return;
        }

        // If the context URL contains a known auth host, just use this
        if (returnToURL) {
            // returnToURL –> https://gitpod.io/#https://github.com/theia-ide/theia"
            const hash = decodeURIComponent(new URL(decodeURIComponent(returnToURL)).hash);
            const value = hash.substr(1); // to remove the leading #
            let contextUrlHost: string | undefined;
            try {
                const contextURL = new URL(value);
                contextUrlHost = contextURL.hostname;
            } catch {
                // ignore parse errors
            }

            if (!!contextUrlHost && authProvidersOnDashboard.find(a => a === contextUrlHost)) {
                req.query.host = contextUrlHost;
                log.debug({ sessionId: req.sessionID }, "Guessed auth provider from returnTo URL: " + contextUrlHost, { 'login-flow': true, query: req.query});
                return;
            }
        }
    }

    protected getSafeReturnToParam(req: express.Request) {
        const returnToURL: string | undefined = req.query.returnTo;
        if (returnToURL) {
            const hostUrl = this.env.hostUrl.url as URL;
            if (returnToURL.toLowerCase().startsWith(`${hostUrl.protocol}//${hostUrl.host}`.toLowerCase())) {
                return returnToURL;
            }
        }
    }
}

async function retryAsync(count: number, promise: Promise<any>) {
    let lastError;
    for (let i = 0; i < count; i++) {
        try {
            return await promise;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}
