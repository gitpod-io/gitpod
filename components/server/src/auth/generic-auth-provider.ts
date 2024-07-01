/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import express from "express";
import passport from "passport";
import OAuth2Strategy from "passport-oauth2";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { AuthProviderInfo, Identity, Token, User } from "@gitpod/gitpod-protocol";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { oauth2tokenCallback, OAuth2 } from "oauth";
import { URL } from "url";
import { AuthProvider, AuthUser } from "../auth/auth-provider";
import { AuthProviderParams, AuthUserSetup } from "../auth/auth-provider";
import {
    AuthException,
    EmailAddressAlreadyTakenException,
    SelectAccountException,
    UnconfirmedUserException,
} from "../auth/errors";
import { Config } from "../config";
import { getRequestingClientInfo } from "../express-util";
import { TokenProvider } from "../user/token-provider";
import { UserAuthentication } from "../user/user-authentication";
import { AuthProviderService } from "./auth-provider-service";
import { LoginCompletionHandler } from "./login-completion-handler";
import { OutgoingHttpHeaders } from "http2";
import { trackSignup } from "../analytics";
import { daysBefore, isDateSmaller } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { VerificationService } from "../auth/verification-service";
import { SignInJWT } from "./jwt";
import { UserService } from "../user/user-service";
import { reportLoginCompleted } from "../prometheus-metrics";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

/**
 * This is a generic implementation of OAuth2-based AuthProvider.
 * --
 * The main entrypoints go along the phases of the OAuth2 Authorization Code Flow:
 *
 * 1. `authorize` – this is called by the `Authenticator` to handle login/authorization requests.
 *
 *   The OAuth2 library under the hood will redirect send a redirect response to initialize the OAuth2 flow with the
 *   authorization service.
 *
 *   The continuation of the flow is an expected incoming request on the callback path. Between those two phases the
 *   AuthProvider needs to persist an intermediate state in order to preserve the original parameters.
 *
 * 2. `callback` – the `Authenticator` handles requests matching the `/auth/*` paths and delegates to the responsible AuthProvider.
 *
 *   The complex operation combines the token exchanges (which happens under the hood) with unverified authentication of
 *   the user.
 *
 *   Once `access_token` is provided, the `readAuthUserSetup` is executed to query the specific auth server APIs and
 *   obtain the information needed to create new users or identify existing users.
 *
 * 3. `refreshToken` – the `TokenService` may call this if the token aquired by this AuthProvider.
 *
 *   The AuthProvider requests to renew an `access_token` if supported, i.e. a `refresh_token` is provided in the original
 *   token response.
 *
 */
@injectable()
export abstract class GenericAuthProvider implements AuthProvider {
    @inject(AuthProviderParams) params: AuthProviderParams;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(UserDB) protected userDb: UserDB;
    @inject(Config) protected config: Config;
    @inject(UserAuthentication) protected readonly userAuthentication: UserAuthentication;
    @inject(UserService) protected readonly userService: UserService;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;
    @inject(LoginCompletionHandler) protected readonly loginCompletionHandler: LoginCompletionHandler;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(VerificationService) protected readonly verificationService: VerificationService;
    @inject(SignInJWT) protected readonly signInJWT: SignInJWT;

    @postConstruct()
    init() {
        log.info(`(${this.strategyName}) Initialized.`, { sanitizedStrategyOptions: this.sanitizedStrategyOptions });
    }

    get info(): AuthProviderInfo {
        return this.defaultInfo();
    }

    protected defaultInfo(): AuthProviderInfo {
        const scopes = this.oauthScopes;
        const {
            id,
            type,
            icon,
            host,
            ownerId,
            organizationId,
            verified,
            hiddenOnDashboard,
            disallowLogin,
            description,
        } = this.params;
        return {
            authProviderId: id,
            authProviderType: type,
            ownerId,
            organizationId,
            verified,
            host,
            icon,
            hiddenOnDashboard,
            disallowLogin,
            description,
            scopes,
            settingsUrl: this.oauthConfig.settingsUrl, // unused
            requirements: {
                default: scopes,
                publicRepo: scopes,
                privateRepo: scopes,
            },
        };
    }

    protected get USER_AGENT() {
        return new URL(this.oauthConfig.callBackUrl).hostname;
    }

    protected get strategyName() {
        return `Auth-With-${this.host}`;
    }
    get host() {
        return this.params.host;
    }
    get authProviderId() {
        return this.params.id;
    }
    protected get oauthConfig() {
        return this.params.oauth!;
    }
    protected get oauthScopes() {
        if (!this.oauthConfig.scope) {
            return [];
        }
        const scopes = this.oauthConfig.scope
            .split(this.oauthConfig.scopeSeparator || " ")
            .map((s) => s.trim())
            .filter((s) => !!s);
        return scopes;
    }

    protected abstract readAuthUserSetup(accessToken: string, tokenResponse: object): Promise<AuthUserSetup>;

    authorize(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        state: string,
        scope?: string[],
    ) {
        const handler = passport.authenticate(this.getStrategy() as any, {
            ...this.defaultStrategyOptions,
            state,
            scope,
        });

        handler(req, res, next);
    }

    protected getStrategy() {
        return new GenericOAuth2Strategy(
            this.strategyName,
            { ...this.defaultStrategyOptions },
            async (req, accessToken, refreshToken, tokenResponse, _profile, done) =>
                await this.verify(req, accessToken, refreshToken, tokenResponse, _profile, done),
        );
    }

    async refreshToken(user: User, requestedLifetimeDate: Date): Promise<Token> {
        log.info(`(${this.strategyName}) Token to be refreshed.`, { userId: user.id });
        const { authProviderId } = this;
        const identity = User.getIdentity(user, authProviderId);
        if (!identity) {
            throw new Error(`Cannot find an identity for ${authProviderId}`);
        }
        const tokenEntry = await this.userDb.findTokenEntryForIdentity(identity);
        const token = tokenEntry?.token;
        if (!token) {
            throw new Error(`Cannot find any current token for ${authProviderId}`);
        }
        const { refreshToken, expiryDate } = token;
        if (!refreshToken || !expiryDate) {
            throw new Error(`Cannot refresh token for ${authProviderId}`);
        }
        try {
            const refreshResult = await new Promise<{ access_token: string; refresh_token: string; result: any }>(
                (resolve, reject) => {
                    this.getStrategy().requestNewAccessToken(
                        refreshToken,
                        {},
                        (error, access_token, refresh_token, result) => {
                            if (error) {
                                reject(error);
                                return;
                            }
                            resolve({ access_token, refresh_token, result });
                        },
                    );
                },
            );
            const { access_token, refresh_token, result } = refreshResult;

            // update token
            const now = new Date();
            const updateDate = now.toISOString();
            const tokenExpiresInSeconds = typeof result.expires_in === "number" ? result.expires_in : undefined;
            const expiryDate = tokenExpiresInSeconds
                ? new Date(now.getTime() + tokenExpiresInSeconds * 1000).toISOString()
                : undefined;
            const reservedUntilDate = requestedLifetimeDate.toISOString();
            const newToken: Token = {
                value: access_token,
                username: this.tokenUsername,
                scopes: token.scopes,
                updateDate,
                expiryDate,
                reservedUntilDate,
                refreshToken: refresh_token,
            };
            const newTokenEntry = await this.userDb.storeSingleToken(identity, newToken);
            log.info(`(${this.strategyName}) Token refreshed and updated.`, {
                userId: user.id,
                updateDate,
                expiryDate,
                reservedUntilDate,
            });
            return newTokenEntry.token;
        } catch (error) {
            log.error({ userId: user.id }, `(${this.strategyName}) Failed to refresh token!`, {
                error: new TrustedValue(error),
            });
            throw error;
        }
    }

    public requiresOpportunisticRefresh() {
        return this.params.type === "BitbucketServer";
    }

    protected cachedAuthCallbackPath: string | undefined = undefined;
    get authCallbackPath() {
        // This ends up being called quite often so we cache the URL constructor
        if (this.cachedAuthCallbackPath === undefined) {
            this.cachedAuthCallbackPath = new URL(this.oauthConfig.callBackUrl).pathname;
        }
        return this.cachedAuthCallbackPath;
    }

    /**
     * Once the auth service and the user agreed to continue with the OAuth2 flow, this callback function
     * initializes the continuation of the auth process:
     *
     * - (1) `passport.authenticate` is called to handle the token exchange; once done, the following happens...
     * - (2) the so called "verify" function is called by passport, which is expected to find/create/update
     *   user instances after requesting user information from the auth service.
     * - (3) the result of the "verify" function is first handled by passport internally and then passed to the
     *   callback from the `passport.authenticate` call (1)
     */
    async callback(request: express.Request, response: express.Response, next: express.NextFunction): Promise<void> {
        const authProviderId = this.authProviderId;
        const strategyName = this.strategyName;
        const clientInfo = getRequestingClientInfo(request);
        const cxt = LogContext.from({ user: request.user });
        if (response.headersSent) {
            log.warn(cxt, `(${strategyName}) Callback called repeatedly.`, { clientInfo });
            return;
        }
        log.info(cxt, `(${strategyName}) OAuth2 callback call. `, {
            clientInfo,
            authProviderId,
            requestUrl: request.originalUrl,
        });

        const isAlreadyLoggedIn = request.isAuthenticated() && User.is(request.user);

        const state = request.query.state;
        if (!state) {
            log.error(cxt, `(${strategyName}) No state present on callback request.`, { clientInfo });
            response.redirect(
                this.getSorryUrl(`No state was present on the authentication callback. Please try again.`),
            );
            return;
        }

        const authFlow = request.authFlow;
        if (!authFlow) {
            log.error(`(${strategyName}) Auth flow state is missing.`);

            reportLoginCompleted("failed", "git");
            response.redirect(this.getSorryUrl(`Auth flow state is missing.`));
            return;
        }

        if (!this.loginCompletionHandler.isBaseDomain(request)) {
            // For auth requests that are not targetting the base domain, we redirect to the base domain, so they come with our cookie.
            log.info(`(${strategyName}) Auth request on subdomain, redirecting to base domain`, { clientInfo });
            const target = new URL(request.url, this.config.hostUrl.url.toString()).toString();
            response.redirect(target);
            return;
        }

        if (isAlreadyLoggedIn) {
            if (!authFlow) {
                log.warn(
                    cxt,
                    `(${strategyName}) User is already logged in. No auth info provided. Redirecting to dashboard.`,
                    { clientInfo },
                );
                response.redirect(this.config.hostUrl.asDashboard().toString());
                return;
            }
        }

        // assert additional infomation is attached to current session
        if (!authFlow) {
            // The auth flow state info is missing in the session: count as client error
            reportLoginCompleted("failed_client", "git");

            log.error(cxt, `(${strategyName}) No session found during auth callback.`, { clientInfo });
            response.redirect(this.getSorryUrl(`Please allow Cookies in your browser and try to log in again.`));
            return;
        }

        if (authFlow.host !== this.host) {
            reportLoginCompleted("failed", "git");

            log.error(cxt, `(${strategyName}) Host does not match.`, { clientInfo });
            response.redirect(this.getSorryUrl(`Host does not match.`));
            return;
        }

        const defaultLogPayload = { authFlow, clientInfo, authProviderId };

        // check OAuth2 errors
        const callbackParams = new URL(`https://anyhost${request.originalUrl}`).searchParams;
        const callbackError = callbackParams.get("error");
        const callbackErrorDescription: string | null = callbackParams.get("error_description");

        if (callbackError) {
            // e.g. "access_denied"
            reportLoginCompleted("failed", "git");

            return this.sendCompletionRedirectWithError(response, {
                error: callbackError,
                description: callbackErrorDescription,
            });
        }

        let result: Parameters<VerifyCallback>;
        try {
            result = await new Promise((resolve) => {
                const authenticate = passport.authenticate(
                    this.getStrategy() as any,
                    (...params: Parameters<VerifyCallback>) => resolve(params),
                );
                authenticate(request, response, next);
            });
        } catch (error) {
            response.redirect(this.getSorryUrl(`OAuth2 error. (${error})`));
            return;
        }
        const [err, userOrIdentity, flowContext] = result;
        log.debug("Auth provider result", {
            err,
            userOrIdentity,
            flowContext,
        });
        /*
         * (3) this callback function is called after the "verify" function as the final step in the authentication process in passport.
         *
         * - the `err` parameter may include any error raised from the "verify" function call.
         * - the `user` parameter may include the accepted user instance.
         * - the `info` parameter may include additional info to the process.
         *
         * given that everything relevant to the state is already processed, this callback is supposed to finally handle the
         * incoming `/callback` request:
         *
         * - redirect to handle/display errors
         * - call `request.login` on new sessions
         * - redirect to `returnTo` (from request parameter)
         */

        const context = LogContext.from({
            userId: User.is(userOrIdentity) ? userOrIdentity.id : undefined,
            request,
        });

        if (err) {
            if (SelectAccountException.is(err)) {
                return this.sendCompletionRedirectWithError(response, err.payload);
            }
            if (EmailAddressAlreadyTakenException.is(err)) {
                return this.sendCompletionRedirectWithError(response, {
                    error: "email_taken",
                    host: err.payload?.host,
                });
            }

            let message = "Authorization failed. Please try again.";
            if (AuthException.is(err)) {
                return this.sendCompletionRedirectWithError(response, { error: err.message });
            }
            if (this.isOAuthError(err)) {
                message = "OAuth Error. Please try again."; // this is a 5xx response from authorization service
            }

            if (UnconfirmedUserException.is(err)) {
                return this.sendCompletionRedirectWithError(response, { error: err.message });
            }

            reportLoginCompleted("failed", "git");
            log.error(context, `(${strategyName}) Redirect to /sorry from verify callback`, err, {
                ...defaultLogPayload,
                err,
            });
            return this.sendCompletionRedirectWithError(response, { error: `${message} ${err.message}` });
        }

        if (flowContext) {
            const logPayload = {
                withIdentity: VerifyResult.WithIdentity.is(flowContext) ? flowContext.candidate : undefined,
                withUser: VerifyResult.WithUser.is(flowContext) ? flowContext.user.id : undefined,
                ...defaultLogPayload,
            };

            if (VerifyResult.WithIdentity.is(flowContext)) {
                log.info(context, `(${strategyName}) Creating new user and completing login.`, logPayload);
                // There is no current session, we need to create a new user because this
                // identity does not yet exist.
                const newUser = await this.createNewUser({
                    request,
                    candidate: flowContext.candidate,
                    token: flowContext.token,
                    authUser: flowContext.authUser,
                    isBlocked: flowContext.isBlocked,
                });

                // Set all cookies used on website for visitor preferences for .gitpod.io domain if no preference exists yet
                ["gp-analytical", "gp-necessary", "gp-targeting"].forEach((cookieName) => {
                    if (!request.cookies[cookieName]) {
                        response.cookie(cookieName, "true", {
                            maxAge: 365 * 24 * 60 * 60 * 1000, //set to a year
                            domain: "." + request.header("Host"),
                        });
                    }
                });

                await this.loginCompletionHandler.complete(request, response, {
                    user: newUser,
                    returnToUrl: authFlow.returnTo,
                    authHost: authFlow.host,
                });
            } else {
                const { user, elevateScopes } = flowContext as VerifyResult.WithUser;

                if (request.user) {
                    // Git authorization request, the User.identities entry is expected to be updated already.
                    // We're marking this AP as verified and redirect to the provided URL.

                    if (authFlow.host) {
                        await this.loginCompletionHandler.updateAuthProviderAsVerified(authFlow.host, user);
                    }

                    log.info(
                        context,
                        `(${strategyName}) Authorization callback for an existing user. Auth provider ${authFlow.host} marked as verified.`,
                        logPayload,
                    );

                    const { returnTo } = authFlow;
                    response.redirect(returnTo);
                    return;
                } else {
                    // Complete login into an existing account

                    log.info(context, `(${strategyName}) Directly log in and proceed.`, logPayload);

                    const { host, returnTo } = authFlow;
                    await this.loginCompletionHandler.complete(request, response, {
                        user,
                        returnToUrl: returnTo,
                        authHost: host,
                        elevateScopes,
                    });
                }
            }
        }
    }

    protected async createNewUser(params: {
        request: express.Request;
        candidate: Identity;
        token: Token;
        authUser: AuthUser;
        isBlocked?: boolean;
    }) {
        const { request, candidate, token, authUser, isBlocked } = params;
        const user = await this.userService.createUser({
            identity: candidate,
            token,
            userUpdate: (newUser) => {
                newUser.name = authUser.authName;
                newUser.fullName = authUser.name || undefined;
                newUser.avatarUrl = authUser.avatarUrl;
                newUser.blocked = newUser.blocked || isBlocked;
                if (
                    authUser.created_at &&
                    isDateSmaller(authUser.created_at, daysBefore(new Date().toISOString(), 30))
                ) {
                    // people with an account older than 30 days are treated as trusted
                    newUser.lastVerificationTime = new Date().toISOString();
                }
            },
        });

        if (user.blocked) {
            log.warn({ user: user.id }, "user blocked on signup");
        }

        /** no await */ trackSignup(user, request, this.analytics).catch((err) =>
            log.warn({ userId: user.id }, "trackSignup", err),
        );

        return user;
    }

    protected sendCompletionRedirectWithError(response: express.Response, error: object): void {
        log.info(`(${this.strategyName}) Send completion redirect with error`, { error });

        const url = this.config.hostUrl
            .with({
                pathname: "/complete-auth",
                search: "message=error:" + Buffer.from(JSON.stringify(error), "utf-8").toString("base64"),
            })
            .toString();
        response.redirect(url);
    }

    /**
     * cf. part (2) of `callback` function
     *
     * - `access_token` is provided
     * - it's expected to fetch the user info (see `fetchAuthUserSetup`)
     * - it's expected to handle the state persisted in the database in order to find/create/update the user instance
     * - finally, it's expected to call `done` and provide the computed result in order to finalize the auth process
     */
    protected async verify(
        req: express.Request,
        accessToken: string,
        refreshToken: string | undefined,
        tokenResponse: any,
        _profile: undefined,
        _done: VerifyCallbackInternal,
    ) {
        const done = _done as VerifyCallback;
        let flowContext: VerifyResult;
        const { strategyName } = this;
        const clientInfo = getRequestingClientInfo(req);
        const authProviderId = this.authProviderId;
        let currentGitpodUser: User | undefined = User.is(req.user) ? req.user : undefined;
        let candidate: Identity;

        const authFlow = req.authFlow;
        if (!authFlow) {
            log.error(`(${strategyName}) Auth flow state is missing.`);
            done(AuthException.create("authflow-missing", "Auth flow state is missing.", {}), undefined);
            return;
        }

        const defaultLogPayload = { authFlow, clientInfo, authProviderId };

        try {
            const tokenResponseObject = this.ensureIsObject(tokenResponse);
            const { authUser, currentScopes, envVars } = await this.readAuthUserSetup(accessToken, tokenResponseObject);
            const { authName, primaryEmail } = authUser;
            candidate = { authProviderId, ...authUser };

            log.info(`(${strategyName}) Verify function called for ${authName}`, { ...defaultLogPayload, authUser });

            if (currentGitpodUser) {
                // user is already logged in

                // check for matching auth ID
                const currentIdentity = currentGitpodUser.identities.find(
                    (i) => i.authProviderId === this.authProviderId,
                );
                if (currentIdentity && currentIdentity.authId !== candidate.authId) {
                    log.warn(`User is trying to connect with another provider identity.`, {
                        ...defaultLogPayload,
                        authUser,
                        candidate,
                        currentGitpodUser: currentGitpodUser.id,
                        clientInfo,
                    });
                    done(
                        AuthException.create(
                            "authId-mismatch",
                            "Auth ID does not match with existing provider identity.",
                            {},
                        ),
                        undefined,
                    );
                    return;
                }

                // we need to check current provider authorizations first...
                try {
                    await this.userAuthentication.assertNoTwinAccount(
                        currentGitpodUser,
                        this.host,
                        this.authProviderId,
                        candidate,
                    );
                } catch (error) {
                    log.warn(`User is trying to connect a provider identity twice.`, {
                        ...defaultLogPayload,
                        authUser,
                        candidate,
                        currentGitpodUser: currentGitpodUser.id,
                        clientInfo,
                    });
                    done(error, undefined);
                    return;
                }
            } else {
                // no user session present, let's initiate a login
                currentGitpodUser = await this.userAuthentication.findUserForLogin({ candidate });

                if (!currentGitpodUser) {
                    // signup new accounts with email adresses already taken is disallowed
                    try {
                        await this.userAuthentication.asserNoAccountWithEmail(primaryEmail);
                    } catch (error) {
                        log.warn(`Login attempt with matching email address.`, {
                            ...defaultLogPayload,
                            authUser,
                            candidate,
                            clientInfo,
                        });
                        done(error, undefined);
                        return;
                    }
                }
            }

            const token = this.createToken(
                this.tokenUsername,
                accessToken,
                refreshToken,
                currentScopes,
                tokenResponse.expires_in,
            );

            if (currentGitpodUser) {
                const elevateScopes = authFlow.overrideScopes
                    ? undefined
                    : await this.getMissingScopeForElevation(currentGitpodUser, currentScopes);
                const isBlocked = await this.userAuthentication.isBlocked({ user: currentGitpodUser });

                const user = await this.userAuthentication.updateUserOnLogin(
                    currentGitpodUser,
                    authUser,
                    candidate,
                    token,
                );
                currentGitpodUser = user;

                flowContext = <VerifyResult.WithUser>{
                    user: user,
                    isBlocked,
                    returnToUrl: authFlow.returnTo,
                    authHost: this.host,
                    elevateScopes,
                };
            } else {
                const isBlocked = await this.userAuthentication.isBlocked({ primaryEmail });
                flowContext = <VerifyResult.WithIdentity>{
                    candidate,
                    token,
                    authUser,
                    envVars,
                    authHost: this.host,
                    isBlocked,
                };
            }
            done(undefined, currentGitpodUser || candidate, flowContext);
        } catch (err) {
            log.error(`(${strategyName}) Exception in verify function`, err, { ...defaultLogPayload, err, authFlow });
            done(err, undefined);
        }
    }

    protected async getMissingScopeForElevation(user: User, currentScopes: string[]) {
        let shouldElevate = false;
        let prevScopes: string[] = [];
        try {
            const token = await this.getCurrentToken(user);
            prevScopes = token ? token.scopes : prevScopes;
            shouldElevate = this.prevScopesAreMissing(currentScopes, prevScopes);
        } catch {
            // no token
        }
        if (shouldElevate) {
            return prevScopes;
        }
    }

    protected createToken(
        username: string,
        value: string,
        refreshToken: string | undefined,
        scopes: string[],
        expires_in: any,
    ): Token {
        const now = new Date();
        const updateDate = now.toISOString();
        const tokenExpiresInSeconds = typeof expires_in === "number" ? expires_in : undefined;
        const expiryDate = tokenExpiresInSeconds
            ? new Date(now.getTime() + tokenExpiresInSeconds * 1000).toISOString()
            : undefined;
        return {
            value,
            username,
            scopes,
            updateDate,
            expiryDate,
            refreshToken,
        };
    }

    protected get tokenUsername(): string {
        return "oauth2";
    }

    protected ensureIsObject(value: any): object {
        if (typeof value === "object") {
            return value;
        }
        return {};
    }

    protected async getCurrentToken(user: User) {
        try {
            const token = await this.tokenProvider.getTokenForHost(user, this.host);
            return token;
        } catch {
            // no token
        }
    }

    protected prevScopesAreMissing(currentScopes: string[], prevScopes: string[]): boolean {
        const set = new Set(prevScopes);
        currentScopes.forEach((s) => set.delete(s));
        return set.size > 0;
    }

    protected isOAuthError(err: any): boolean {
        if (typeof err === "object" && (err.name == "InternalOAuthError" || err.name === "AuthorizationError")) {
            return true;
        }
        return false;
    }

    protected get sanitizedStrategyOptions(): Omit<StrategyOptionsWithRequest, "clientSecret"> {
        const { ...sanitizedOptions } = this.defaultStrategyOptions;
        return sanitizedOptions;
    }

    protected get defaultStrategyOptions(): StrategyOptionsWithRequest {
        const {
            authorizationUrl,
            tokenUrl,
            clientId,
            clientSecret,
            callBackUrl,
            scope,
            scopeSeparator,
            authorizationParams,
        } = this.oauthConfig;
        return {
            authorizationURL: authorizationUrl,
            tokenURL: tokenUrl,
            // skipUserProfile: true, // default!
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callBackUrl,
            scope,
            scopeSeparator: scopeSeparator || " ",
            userAgent: this.USER_AGENT,
            passReqToCallback: true,
            authorizationParams: authorizationParams,
        };
    }

    protected getSorryUrl(message: string) {
        return this.config.hostUrl.asSorry(message).toString();
    }

    protected retry = async <T>(fn: () => Promise<T>) => {
        let lastError;
        for (let i = 1; i <= 10; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        throw lastError;
    };
}

interface VerifyResult {
    isBlocked?: boolean;
    authHost?: string;
}
namespace VerifyResult {
    export function is(data?: any): data is VerifyResult {
        return WithUser.is(data) || WithIdentity.is(data);
    }
    export interface WithIdentity extends VerifyResult {
        candidate: Identity;
        authUser: AuthUser;
        token: Token;
    }
    export namespace WithIdentity {
        export function is(data?: any): data is WithIdentity {
            return typeof data === "object" && "candidate" in data && "authUser" in data;
        }
    }
    export interface WithUser extends VerifyResult {
        user: User;
        elevateScopes?: string[] | undefined;
        returnToUrl?: string;
    }
    export namespace WithUser {
        export function is(data?: VerifyResult): data is WithUser {
            return typeof data === "object" && "user" in data;
        }
    }
}

interface GenericOAuthStrategyOptions {
    scope?: string | string[];
    /**
     * This should be Gitpod's hostname.
     */
    userAgent: string;

    scopeSeparator?: string;
    customHeaders?: OutgoingHttpHeaders;
    skipUserProfile?: any;
    /**
     * Non-spec autorization params.
     */
    authorizationParams?: object;
}

/**
 * Refinement of OAuth2Strategy.VerifyCallback
 */
type VerifyCallbackInternal = (err?: Error | undefined, user?: User, info?: VerifyResult) => void;
type VerifyCallback = (err?: Error | undefined, user?: User | Identity, info?: VerifyResult) => void;

export interface StrategyOptionsWithRequest
    extends OAuth2Strategy.StrategyOptionsWithRequest,
        GenericOAuthStrategyOptions {}

export class GenericOAuth2Strategy extends OAuth2Strategy {
    protected refreshOAuth2: OAuth2;
    constructor(
        readonly name: string,
        options: StrategyOptionsWithRequest,
        verify: OAuth2Strategy.VerifyFunctionWithRequest,
    ) {
        super(GenericOAuth2Strategy.augmentOptions(options), verify);
        this._oauth2.useAuthorizationHeaderforGET(true);
        this.patch_getOAuthAccessToken();

        // init a second instance of OAuth2 handler for refresh
        const oa2 = this._oauth2 as any;
        this.refreshOAuth2 = new OAuth2(
            oa2._clientId,
            oa2._clientSecret,
            oa2._baseSite,
            oa2._authorizeUrl,
            oa2._accessTokenUrl,
            oa2._customHeaders,
        );
        this.refreshOAuth2.getOAuthAccessToken = oa2.getOAuthAccessToken;
    }

    requestNewAccessToken(refreshToken: string, params: any, callback: oauth2tokenCallback) {
        params = params || {};
        params.grant_type = "refresh_token";
        this.refreshOAuth2.getOAuthAccessToken(refreshToken, params, callback);
    }

    protected patch_getOAuthAccessToken() {
        const oauth2 = this._oauth2;
        const _oauth2_getOAuthAccessToken = oauth2.getOAuthAccessToken as (
            code: string,
            params: any,
            callback: oauth2tokenCallback,
        ) => void;
        (oauth2 as any).getOAuthAccessToken = (code: string, params: any, callback: oauth2tokenCallback) => {
            const patchedCallback: oauth2tokenCallback = (err, accessToken, refreshToken, params) => {
                if (err) {
                    return callback(err, null as any, null as any, null as any);
                }
                if (!accessToken) {
                    return callback(
                        {
                            statusCode: 400,
                            data: JSON.stringify(params),
                        },
                        null as any,
                        null as any,
                        null as any,
                    );
                }
                callback(null as any, accessToken, refreshToken, params);
            };
            _oauth2_getOAuthAccessToken.call(oauth2, code, params, patchedCallback);
        };
    }

    static augmentOptions(options: StrategyOptionsWithRequest): StrategyOptionsWithRequest {
        const result: StrategyOptionsWithRequest = { ...options };
        result.scopeSeparator = result.scopeSeparator || ",";
        result.customHeaders = result.customHeaders || {};
        if (!result.customHeaders["User-Agent"]) {
            result.customHeaders["User-Agent"] = result.userAgent;
        }
        result.skipUserProfile = true;
        return result;
    }

    authorizationParams(options: StrategyOptionsWithRequest): object {
        if (options.authorizationParams) {
            return { ...options.authorizationParams };
        }
        return {};
    }
}
