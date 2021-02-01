/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import * as passport from "passport"
import { injectable, postConstruct, inject } from 'inversify';
import { User } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { Env } from '../env';
import { HostContextProvider } from './host-context-provider';
import { AuthProvider, AuthFlow } from './auth-provider';
import { TokenProvider } from '../user/token-provider';
import { AuthProviderService } from './auth-provider-service';
import { UserService } from '../user/user-service';
import { increaseLoginCounter } from '../../src/prometheusMetrics';

@injectable()
export class Authenticator {

    protected passportInitialize: express.Handler;
    protected passportSession: express.Handler;

    @inject(Env) protected env: Env;
    @inject(UserDB) protected userDb: UserDB;
    @inject(HostContextProvider) protected hostContextProvider: HostContextProvider;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;
    @inject(UserService) protected readonly userService: UserService;

    @postConstruct()
    protected setup() {
        // Setup passport
        this.passportInitialize = passport.initialize();
        this.passportSession = passport.session();
        passport.serializeUser((user: User, done) => {
            if (user) {
                done(null, user.id);
            } else {
                log.error('(Authenticator) serializeUser called with undefined user.');
            }
        });
        passport.deserializeUser(async (id, done) => {
            try {
                const user = await this.userDb.findUserById(id as string);
                if (user) {
                    done(null, user);
                } else {
                    done(new Error("User not found."));
                }
            } catch (err) {
                done(err);
            }
        });
    }

    get initHandlers(): express.Handler[] {
        return [
            this.passportInitialize,    // adds `passport.user` to session
            this.passportSession        // deserializes session user into  `req.user`
        ];
    }

    async init(app: express.Application) {
        this.initHandlers.forEach(handler => app.use(handler));
        app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            await this.authCallbackHandler(req, res, next);
        });
    }
    protected async authCallbackHandler(req: express.Request, res: express.Response, next: express.NextFunction) {
        if (req.url.startsWith("/auth/")) {
            const hostContexts = this.hostContextProvider.getAll();
            for (const { authProvider } of hostContexts) {
                const authCallbackPath = authProvider.authCallbackPath;
                if (req.url.startsWith(authCallbackPath)) {
                    log.info(`Auth Provider Callback. Path: ${authCallbackPath}`, { req });
                    await authProvider.callback(req, res, next);
                    return;
                }
            }
        }
        return next();
    }

    protected async getAuthProviderForHost(host: string): Promise<AuthProvider | undefined> {
        const hostContext = this.hostContextProvider.get(host);
        return hostContext && hostContext.authProvider;
    }

    async authenticate(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        if (req.isAuthenticated()) {
            log.info({ sessionId: req.sessionID }, `User is already authenticated. Continue.`, { 'login-flow': true });
            return next();
        }
        let returnTo: string | undefined = req.query.returnTo;
        if (returnTo) {
            log.info({ sessionId: req.sessionID }, `Stored returnTo URL: ${returnTo}`, { 'login-flow': true });
        }
        // returnTo defaults to workspaces url
        const workspaceUrl = this.env.hostUrl.asDashboard().toString();
        returnTo = returnTo || workspaceUrl;

        const host: string = req.query.host;
        const authProvider = host && await this.getAuthProviderForHost(host);
        if (!host || !authProvider) {
            log.info({ sessionId: req.sessionID }, `Bad request: missing parameters.`, { req, 'login-flow': true });
            res.redirect(this.getSorryUrl(`Bad request: missing parameters.`));
            return;
        }
        if (!req.session) {
            increaseLoginCounter("failed", authProvider.info.host)
            log.info({ }, `No session.`, { req, 'login-flow': true });
            res.redirect(this.getSorryUrl(`No session found. Please refresh the browser.`));
            return;
        }

        if (!authProvider.info.verified && !(await this.isInSetupMode())) {
            increaseLoginCounter("failed", authProvider.info.host)
            log.info({ sessionId: req.sessionID }, `Login with "${host}" is not permitted.`, { req, 'login-flow': true, ap: authProvider.info });
            res.redirect(this.getSorryUrl(`Login with "${host}" is not permitted.`));
            return;
        }

        // prepare session
        await AuthFlow.attach(req.session, {
            host,
            returnTo
        });
        // authenticate user
        authProvider.authorize(req, res, next);
    }
    protected async isInSetupMode() {
        const hasAnyStaticProviders = this.hostContextProvider.getAll().some(hc => hc.authProvider.config.builtin === true);
        if (hasAnyStaticProviders) {
            return false;
        }
        const noUser = (await this.userDb.getUserCount()) === 0;
        return noUser;
    }

    async deauthorize(req: express.Request, res: express.Response, next: express.NextFunction) {
        const user = req.user;
        if (!req.isAuthenticated() || !User.is(user)) {
            log.info({ sessionId: req.sessionID }, `User is not authenticated.`, { req });
            res.redirect(this.getSorryUrl(`Not authenticated. Please login.`));
            return;
        }
        const returnTo: string = req.query.returnTo || this.env.hostUrl.asDashboard().toString();
        const host: string | undefined = req.query.host;

        const authProvider = host && await this.getAuthProviderForHost(host);

        if (!host || !authProvider) {
            log.warn({ sessionId: req.sessionID }, `Bad request: missing parameters.`, { req });
            res.redirect(this.getSorryUrl(`Bad request: missing parameters.`));
            return;
        }

        try {
            await this.userService.deauthorize(user, authProvider.authProviderId);
            res.redirect(returnTo);
        } catch (error) {
            log.error({ sessionId: req.sessionID }, `Failed to disconnect a provider.`, error, { req, host, userId: user.id });
            res.redirect(this.getSorryUrl(`Failed to disconnect a provider: ${ error && error.message ? error.message : "unknown reason"}`));
        }
    }

    async authorize(req: express.Request, res: express.Response, next: express.NextFunction) {
        if (!req.session) {
            log.info({ }, `No session.`, { req, 'authorize-flow': true });
            res.redirect(this.getSorryUrl(`No session found. Please refresh the browser.`));
            return;
        }
        const user = req.user;
        if (!req.isAuthenticated() || !User.is(user)) {
            log.info({ sessionId: req.sessionID }, `User is not authenticated.`, { req, 'authorize-flow': true });
            res.redirect(this.getSorryUrl(`Not authenticated. Please login.`));
            return;
        }
        const returnTo: string | undefined = req.query.returnTo;
        const host: string | undefined = req.query.host;
        const scopes: string = req.query.scopes || "";
        const override = req.query.override === 'true';
        const authProvider = host && await this.getAuthProviderForHost(host);
        if (!returnTo || !host || !authProvider) {
            log.info({ sessionId: req.sessionID }, `Bad request: missing parameters.`, { req, 'authorize-flow': true });
            res.redirect(this.getSorryUrl(`Bad request: missing parameters.`));
            return;
        }

        if (!authProvider.info.verified && user.id !== authProvider.info.ownerId) {
            log.info({ sessionId: req.sessionID }, `Authorization with "${host}" is not permitted.`, { req, 'authorize-flow': true, ap: authProvider.info });
            res.redirect(this.getSorryUrl(`Authorization with "${host}" is not permitted.`));
            return;
        }

        // prepare session
        await AuthFlow.attach(req.session, { host, returnTo, overrideScopes: override });
        let wantedScopes = scopes.split(',');
        if (wantedScopes.length === 0) {
            if (authProvider.info.requirements) {
                wantedScopes = authProvider.info.requirements.default;
            }
        }
        // compute merged scopes
        if (!override) {
            const currentScopes = await this.getCurrentScopes(req.user, authProvider);
            wantedScopes = this.mergeScopes(currentScopes, wantedScopes);
            // in case user signed in with another identity, we need to ensure the merged scopes contain
            // all default needed to for proper authentication
            if (currentScopes.length === 0 && authProvider.info.requirements) {
                wantedScopes = this.mergeScopes(authProvider.info.requirements.default, wantedScopes);
            }
        }
        // authorize Gitpod
        log.info({ sessionId: req.sessionID }, `(doAuthorize) wanted scopes (${override ? 'overriding' : 'merging'}): ${ wantedScopes.join(',') }`);
        authProvider.authorize(req, res, next, wantedScopes);
    }
    protected mergeScopes(a: string[], b: string[]) {
        const set = new Set(a);
        b.forEach(s => set.add(s));
        return Array.from(set).sort();
    }
    protected async getCurrentScopes(user: any, authProvider: AuthProvider){
        if (User.is(user)) {
            try {
                const token = await this.tokenProvider.getTokenForHost(user, authProvider.config.host);
                return token.scopes;
            } catch {
                // no token
            }
        }
        return [];
    }
    protected getSorryUrl(message: string) {
        return this.env.hostUrl.asSorry(message).toString();
    }
}