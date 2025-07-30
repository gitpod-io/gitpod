/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TeamDB } from "@gitpod/gitpod-db/lib";
import { User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import express from "express";
import { inject, injectable, postConstruct } from "inversify";
import passport from "passport";
import { Config } from "../config";
import { reportLoginCompleted } from "../prometheus-metrics";
import { TokenProvider } from "../user/token-provider";
import { UserAuthentication } from "../user/user-authentication";
import { UserService } from "../user/user-service";
import { AuthFlow, AuthProvider } from "./auth-provider";
import { HostContextProvider } from "./host-context-provider";
import { SignInJWT } from "./jwt";
import { NonceService } from "./nonce-service";
import { ensureUrlHasFragment } from "./fragment-utils";

/**
 * Common validation logic for returnTo URLs.
 * @param returnTo The URL to validate
 * @param hostUrl The host URL configuration
 * @param allowedPatterns Array of regex patterns that are allowed for the pathname
 * @returns true if the URL is valid, false otherwise
 */
function validateReturnToUrlWithPatterns(returnTo: string, hostUrl: GitpodHostUrl, allowedPatterns: RegExp[]): boolean {
    try {
        const url = new URL(returnTo);
        const baseUrl = hostUrl.url;

        // Must be same origin OR www.gitpod.io exception
        const isSameOrigin = url.origin === baseUrl.origin;
        const isGitpodWebsite = url.protocol === "https:" && url.hostname === "www.gitpod.io";

        if (!isSameOrigin && !isGitpodWebsite) {
            return false;
        }

        // For www.gitpod.io, only allow root path
        if (isGitpodWebsite) {
            return url.pathname === "/";
        }

        // Check if pathname matches any allowed pattern
        const isAllowedPath = allowedPatterns.some((pattern) => pattern.test(url.pathname));
        if (!isAllowedPath) {
            return false;
        }

        // For complete-auth, require ONLY message parameter (used by OAuth flows)
        if (url.pathname === "/complete-auth") {
            const searchParams = new URLSearchParams(url.search);
            const paramKeys = Array.from(searchParams.keys());
            return paramKeys.length === 1 && paramKeys[0] === "message" && searchParams.has("message");
        }

        return true;
    } catch (error) {
        // Invalid URL
        return false;
    }
}

/**
 * Validates returnTo URLs for login API endpoints.
 * Login API allows broader navigation after authentication.
 */
export function validateLoginReturnToUrl(returnTo: string, hostUrl: GitpodHostUrl): boolean {
    const allowedPatterns = [
        // We have already verified the domain above, and we do not restrict the redirect location for loginReturnToUrl.
        /^\/.*$/,
    ];

    return validateReturnToUrlWithPatterns(returnTo, hostUrl, allowedPatterns);
}

/**
 * Validates returnTo URLs for authorize API endpoints.
 * Authorize API allows complete-auth callbacks and dashboard pages for scope elevation.
 */
export function validateAuthorizeReturnToUrl(returnTo: string, hostUrl: GitpodHostUrl): boolean {
    const allowedPatterns = [
        // 1. complete-auth callback for OAuth popup windows
        /^\/complete-auth$/,

        // 2. Dashboard pages (for scope elevation flows)
        /^\/$/, // Root
        /^\/new$/, // Create workspace page
        /^\/quickstart$/, // Quickstart page
    ];

    return validateReturnToUrlWithPatterns(returnTo, hostUrl, allowedPatterns);
}

@injectable()
export class Authenticator {
    protected passportInitialize: express.Handler;

    @inject(Config) protected readonly config: Config;
    @inject(UserService) protected userService: UserService;
    @inject(TeamDB) protected teamDb: TeamDB;
    @inject(HostContextProvider) protected hostContextProvider: HostContextProvider;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(UserAuthentication) protected readonly userAuthentication: UserAuthentication;
    @inject(SignInJWT) protected readonly signInJWT: SignInJWT;
    @inject(NonceService) protected readonly nonceService: NonceService;

    @postConstruct()
    protected setup() {
        // Setup passport
        this.passportInitialize = passport.initialize();
        passport.serializeUser<string>((user: User, done) => {
            if (user) {
                done(null, user.id);
            } else {
                log.error("(Authenticator) serializeUser called with undefined user.");
            }
        });
        passport.deserializeUser(async (id, done) => {
            try {
                const userId = id as string;
                const user = await this.userService.findUserById(userId, userId);
                done(null, user);
            } catch (err) {
                done(err);
            }
        });
    }

    get initHandlers(): express.Handler[] {
        return [
            this.passportInitialize, // adds `passport.user` to session
        ];
    }

    async init(app: express.Application) {
        this.initHandlers.forEach((handler) => app.use(handler));
        app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            await this.authCallbackHandler(req, res, next);
        });
    }
    protected async authCallbackHandler(req: express.Request, res: express.Response, next: express.NextFunction) {
        // Should match:
        // * /auth/callback
        // * /auth/<host_of_git_provider>/callback
        if (req.path.startsWith("/auth/") && req.path.endsWith("/callback")) {
            const stateParam = req.query.state;
            try {
                const flowState = await this.parseState(`${stateParam}`);
                const host = flowState.host;
                if (!host) {
                    throw new Error("Auth flow state is missing 'host' attribute.");
                }

                // Handle GitHub OAuth edge case: redirect from api.* subdomain to base domain
                // This allows nonce validation to work since cookies are accessible on base domain
                if (this.isApiSubdomainOfConfiguredHost(req.hostname)) {
                    log.info(`OAuth callback on api subdomain, redirecting to base domain for nonce validation`, {
                        hostname: req.hostname,
                        configuredHost: this.config.hostUrl.url.hostname,
                    });
                    const baseUrl = this.config.hostUrl.with({
                        pathname: req.path,
                        search: new URL(req.url, this.config.hostUrl.url).search,
                    });
                    res.redirect(baseUrl.toString());
                    return;
                }

                // Validate nonce for CSRF protection
                const stateNonce = flowState.nonce;
                const cookieNonce = this.nonceService.getNonceFromCookie(req);

                if (!this.nonceService.validateNonce(stateNonce, cookieNonce)) {
                    log.error(`CSRF protection: Nonce validation failed`, {
                        url: req.url,
                        hasStateNonce: !!stateNonce,
                        hasCookieNonce: !!cookieNonce,
                    });
                    res.status(403).send("Authentication failed");
                    return;
                }

                // Validate origin for additional CSRF protection
                if (!this.nonceService.validateOrigin(req)) {
                    log.error(`CSRF protection: Origin validation failed`, {
                        url: req.url,
                        origin: req.get("Origin"),
                        referer: req.get("Referer"),
                    });
                    res.status(403).send("Invalid request");
                    return;
                }

                // Clear the nonce cookie after successful validation
                this.nonceService.clearNonceCookie(res);

                const hostContext = this.hostContextProvider.get(host);
                if (!hostContext) {
                    throw new Error("No host context found.");
                }

                // remember parsed state to be availble in the auth provider implementation
                req.authFlow = flowState;

                log.info(`Auth Provider Callback. Host: ${host}`);
                await hostContext.authProvider.callback(req, res, next);
            } catch (error) {
                log.error(`Failed to handle callback.`, error, { url: req.url });
                // Clear nonce cookie on error as well
                this.nonceService.clearNonceCookie(res);
            }
        } else {
            // Otherwise proceed with other handlers
            return next();
        }
    }

    private async parseState(state: string): Promise<AuthFlow> {
        // In preview environments, we prepend the current development branch to the state, to allow
        // our preview proxy to route the Auth callback appropriately.
        // See https://github.com/gitpod-io/ops/pull/9398/files
        //
        // We need to strip the branch out of the state, if it's present
        if (state.indexOf(",") >= 0) {
            const [, actualState] = state.split(",", 2);
            state = actualState;
        }

        return await this.signInJWT.verify(state as string);
    }

    private deriveAuthState(state: string): string {
        // In preview environments, we prepend the current development branch to the state, to allow
        // our preview proxy to route the Auth callback appropriately.
        // See https://github.com/gitpod-io/ops/pull/9398/files
        if (this.config.devBranch) {
            return `${this.config.devBranch},${state}`;
        }

        return state;
    }

    /**
     * Checks if the current hostname is api.{configured-domain}.
     * This handles the GitHub OAuth edge case where callbacks may come to api.* subdomain.
     */
    private isApiSubdomainOfConfiguredHost(hostname: string): boolean {
        const configuredHost = this.config.hostUrl.url.hostname;
        return hostname === `api.${configuredHost}`;
    }

    protected async getAuthProviderForHost(host: string): Promise<AuthProvider | undefined> {
        const hostContext = this.hostContextProvider.get(host);
        return hostContext && hostContext.authProvider;
    }

    async authenticate(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        if (req.isAuthenticated()) {
            log.info(`User is already authenticated. Continue.`, { "login-flow": true });
            return next();
        }
        let returnToParam: string | undefined = req.query.returnTo?.toString();
        if (returnToParam) {
            log.info(`Stored returnTo URL: ${returnToParam}`, { "login-flow": true });

            // Validate returnTo URL against allowlist for login API
            if (!validateLoginReturnToUrl(returnToParam, this.config.hostUrl)) {
                log.warn(`Invalid returnTo URL rejected for login: ${returnToParam}`, { "login-flow": true });
                res.redirect(this.getSorryUrl(`Invalid return URL.`));
                return;
            }
        }
        // returnTo defaults to workspaces url
        const workspaceUrl = this.config.hostUrl.asDashboard().toString();
        returnToParam = returnToParam || workspaceUrl;
        // Ensure returnTo URL has a fragment to prevent OAuth token inheritance attacks
        const returnTo = ensureUrlHasFragment(returnToParam);

        const host: string = req.query.host?.toString() || "";
        const authProvider = host && (await this.getAuthProviderForHost(host));
        if (!host || !authProvider) {
            log.info(`Bad request: missing parameters.`, { "login-flow": true });
            res.redirect(this.getSorryUrl(`Bad request: missing parameters.`));
            return;
        }
        // Logins with organizational Git Auth is not permitted
        if (authProvider.info.organizationId) {
            log.info(`Login with "${host}" is not permitted.`, {
                "authorize-flow": true,
                ap: authProvider.info,
            });
            res.redirect(this.getSorryUrl(`Login with "${host}" is not permitted.`));
            return;
        }
        if (this.config.disableDynamicAuthProviderLogin && !authProvider.params.builtin) {
            log.info(`Auth Provider is not allowed.`, { ap: authProvider.info });
            res.redirect(this.getSorryUrl(`Login with ${authProvider.params.host} is not allowed.`));
            return;
        }

        if (!authProvider.info.verified) {
            reportLoginCompleted("failed_client", "git");
            log.warn(`Login with "${host}" is not permitted as the provider has not been verified.`, {
                "login-flow": true,
                ap: authProvider.info,
            });
            res.redirect(this.getSorryUrl(`Login with "${host}" is not permitted.`));
            return;
        }

        // Generate nonce for CSRF protection
        const nonce = this.nonceService.generateNonce();
        this.nonceService.setNonceCookie(res, nonce);

        const state = await this.signInJWT.sign({
            host,
            returnTo,
            nonce,
        });

        // authenticate user
        authProvider.authorize(req, res, next, this.deriveAuthState(state));
    }

    async deauthorize(req: express.Request, res: express.Response, next: express.NextFunction) {
        const user = req.user;
        if (!req.isAuthenticated() || !User.is(user)) {
            log.info(`User is not authenticated.`);
            res.redirect(this.getSorryUrl(`Not authenticated. Please login.`));
            return;
        }
        const returnTo: string = req.query.returnTo?.toString() || this.config.hostUrl.asDashboard().toString();
        const host: string | undefined = req.query.host?.toString();

        const authProvider = host && (await this.getAuthProviderForHost(host));

        if (!host || !authProvider) {
            log.warn(`Bad request: missing parameters.`);
            res.redirect(this.getSorryUrl(`Bad request: missing parameters.`));
            return;
        }

        try {
            await this.userAuthentication.deauthorize(user, authProvider.authProviderId);
            res.redirect(returnTo);
        } catch (error) {
            next(error);
            log.error(`Failed to disconnect a provider.`, error, {
                host,
                userId: user.id,
            });
            res.redirect(
                this.getSorryUrl(
                    `Failed to disconnect a provider: ${error && error.message ? error.message : "unknown reason"}`,
                ),
            );
        }
    }

    async authorize(req: express.Request, res: express.Response, next: express.NextFunction) {
        const user = req.user;
        if (!req.isAuthenticated() || !User.is(user)) {
            log.info(`User is not authenticated.`, { "authorize-flow": true });
            res.redirect(this.getSorryUrl(`Not authenticated. Please login.`));
            return;
        }
        if (user.id === BUILTIN_INSTLLATION_ADMIN_USER_ID) {
            log.info(`Authorization is not permitted for admin user.`);
            res.redirect(
                this.getSorryUrl(`Authorization is not permitted for admin user. Please login with a user account.`),
            );
            return;
        }
        const returnToParam: string | undefined = req.query.returnTo?.toString();
        const host: string | undefined = req.query.host?.toString();
        const scopes: string = req.query.scopes?.toString() || "";
        const override = req.query.override === "true";
        const authProvider = host && (await this.getAuthProviderForHost(host));

        if (!returnToParam || !host || !authProvider) {
            log.info(`Bad request: missing parameters.`, { "authorize-flow": true });
            res.redirect(this.getSorryUrl(`Bad request: missing parameters.`));
            return;
        }

        // Validate returnTo URL against allowlist for authorize API
        if (!validateAuthorizeReturnToUrl(returnToParam, this.config.hostUrl)) {
            log.warn(`Invalid returnTo URL rejected for authorize: ${returnToParam}`, { "authorize-flow": true });
            res.redirect(this.getSorryUrl(`Invalid return URL.`));
            return;
        }

        // Ensure returnTo URL has a fragment to prevent OAuth token inheritance attacks
        const returnTo = ensureUrlHasFragment(returnToParam);

        // For non-verified org auth provider, ensure user is an owner of the org
        if (!authProvider.info.verified && authProvider.info.organizationId) {
            const member = await this.teamDb.findTeamMembership(user.id, authProvider.info.organizationId);
            if (member?.role !== "owner") {
                log.info(`Authorization with "${host}" is not permitted.`, {
                    "authorize-flow": true,
                    ap: authProvider.info,
                });
                res.redirect(this.getSorryUrl(`Authorization with "${host}" is not permitted.`));
                return;
            }
        }

        // For non-verified, non-org auth provider, ensure user is the owner of the auth provider
        if (!authProvider.info.verified && !authProvider.info.organizationId && user.id !== authProvider.info.ownerId) {
            log.info(`Authorization with "${host}" is not permitted.`, {
                "authorize-flow": true,
                ap: authProvider.info,
            });
            res.redirect(this.getSorryUrl(`Authorization with "${host}" is not permitted.`));
            return;
        }

        // Ensure user is a member of the org
        if (authProvider.info.organizationId) {
            const member = await this.teamDb.findTeamMembership(user.id, authProvider.info.organizationId);
            if (!member) {
                log.info(`Authorization with "${host}" is not permitted.`, {
                    "authorize-flow": true,
                    ap: authProvider.info,
                });
                res.redirect(this.getSorryUrl(`Authorization with "${host}" is not permitted.`));
                return;
            }
        }

        // prepare session
        let wantedScopes = scopes
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
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
        log.info(`(doAuthorize) wanted scopes (${override ? "overriding" : "merging"}): ${wantedScopes.join(",")}`);

        // Generate nonce for CSRF protection
        const nonce = this.nonceService.generateNonce();
        this.nonceService.setNonceCookie(res, nonce);

        const state = await this.signInJWT.sign({ host, returnTo, overrideScopes: override, nonce });
        authProvider.authorize(req, res, next, this.deriveAuthState(state), wantedScopes);
    }
    private mergeScopes(a: string[], b: string[]) {
        const set = new Set(a);
        b.forEach((s) => set.add(s));
        return Array.from(set).sort();
    }
    private async getCurrentScopes(user: any, authProvider: AuthProvider) {
        if (User.is(user)) {
            try {
                const token = await this.tokenProvider.getTokenForHost(user, authProvider.params.host);
                if (token) {
                    return token.scopes;
                }
            } catch {
                // no token
            }
        }
        return [];
    }
    private getSorryUrl(message: string) {
        return this.config.hostUrl.asSorry(message).toString();
    }
}
