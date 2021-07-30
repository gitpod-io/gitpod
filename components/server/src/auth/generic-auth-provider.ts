/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from 'inversify';
import * as express from "express"
import * as passport from "passport"
import * as OAuth2Strategy from "passport-oauth2";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { AuthProviderInfo, Identity, Token, User } from '@gitpod/gitpod-protocol';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import fetch from "node-fetch";
import { oauth2tokenCallback, OAuth2 } from 'oauth';
import { URL } from 'url';
import { runInNewContext } from "vm";
import { AuthFlow, AuthProvider } from "../auth/auth-provider";
import { AuthProviderParams, AuthUserSetup } from "../auth/auth-provider";
import { AuthException, EmailAddressAlreadyTakenException, SelectAccountException, UnconfirmedUserException } from "../auth/errors";
import { GitpodCookie } from "./gitpod-cookie";
import { Config } from '../config';
import { getRequestingClientInfo } from "../express-util";
import { TokenProvider } from '../user/token-provider';
import { UserService } from "../user/user-service";
import { AuthProviderService } from './auth-provider-service';
import { LoginCompletionHandler } from './login-completion-handler';
import { TosFlow } from '../terms/tos-flow';
import { increaseLoginCounter } from '../../src/prometheus-metrics';
/**
 * This is a generic implementation of OAuth2-based AuthProvider.
 * --
 * The main entrypoints go along the phases of the OAuth2 Authorization Code Flow:
 *
 * 1. `authorize` – this is called by the `Authenticator` to handle login/authorization requests.
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
export class GenericAuthProvider implements AuthProvider {

    @inject(AuthProviderParams) params: AuthProviderParams;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(UserDB) protected userDb: UserDB;
    @inject(Config) protected config: Config;
    @inject(GitpodCookie) protected gitpodCookie: GitpodCookie;
    @inject(UserService) protected readonly userService: UserService;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;
    @inject(LoginCompletionHandler) protected readonly loginCompletionHandler: LoginCompletionHandler;

    @postConstruct()
    init() {
        this.initAuthUserSetup();
        log.info(`(${this.strategyName}) Initialized.`, { defaultStrategyOptions: this.defaultStrategyOptions });
    }

    get info(): AuthProviderInfo {
        return this.defaultInfo();
    }

    protected defaultInfo(): AuthProviderInfo {
        const scopes = this.oauthScopes;
        const { id, type, icon, host, ownerId, verified, hiddenOnDashboard, disallowLogin, description, loginContextMatcher } = this.params;
        return {
            authProviderId: id,
            authProviderType: type,
            ownerId,
            verified,
            host,
            icon,
            hiddenOnDashboard,
            loginContextMatcher,
            disallowLogin,
            description,
            scopes,
            settingsUrl: this.oauthConfig.settingsUrl,
            requirements: {
                default: scopes,
                publicRepo: scopes,
                privateRepo: scopes
            }
        }
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
        const scopes = this.oauthConfig.scope.split(this.oauthConfig.scopeSeparator || " ").map(s => s.trim()).filter(s => !!s);
        return scopes;
    }

    protected readAuthUserSetup?: (accessToken: string, tokenResponse: object) => Promise<AuthUserSetup>;

    authorize(req: express.Request, res: express.Response, next: express.NextFunction, scope?: string[]): void {
        const handler = passport.authenticate(this.getStrategy() as any, { ...this.defaultStrategyOptions, ...{ scope } });
        handler(req, res, next);
    }

    protected getStrategy() {
        return new GenericOAuth2Strategy(this.strategyName, { ...this.defaultStrategyOptions },
            async (req, accessToken, refreshToken, tokenResponse, _profile, done) => await this.verify(req, accessToken, refreshToken, tokenResponse, _profile, done));
    }

    async refreshToken(user: User) {
        log.info(`(${this.strategyName}) Token to be refreshed.`, { userId: user.id });
        const { authProviderId } = this;
        const identity = User.getIdentity(user, authProviderId);
        if (!identity) {
            throw new Error(`Cannot find an identity for ${authProviderId}`);
        }
        const token = await this.userDb.findTokenForIdentity(identity);
        if (!token) {
            throw new Error(`Cannot find any current token for ${authProviderId}`);
        }
        const { refreshToken, expiryDate } = token;
        if (!refreshToken || !expiryDate) {
            throw new Error(`Cannot refresh token for ${authProviderId}`);
        }
        try {
            const refreshResult = await new Promise<{ access_token: string, refresh_token: string, result: any }>((resolve, reject) => {
                this.getStrategy().requestNewAccessToken(refreshToken, {}, (error, access_token, refresh_token, result) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve({ access_token, refresh_token, result });
                });
            });
            const { access_token, refresh_token, result } = refreshResult;

            // update token
            const now = new Date();
            const updateDate = now.toISOString();
            const tokenExpiresInSeconds = typeof result.expires_in === "number" ? result.expires_in : undefined;
            const expiryDate = tokenExpiresInSeconds ? new Date(now.getTime() + tokenExpiresInSeconds * 1000).toISOString() : undefined;
            const newToken: Token = {
                value: access_token,
                username: this.tokenUsername,
                scopes: token.scopes,
                updateDate,
                expiryDate,
                refreshToken: refresh_token
            };
            await this.userDb.storeSingleToken(identity, newToken);
            log.info(`(${this.strategyName}) Token refreshed and updated.`, { userId: user.id, updateDate, expiryDate });
        } catch (error) {
            log.error(`(${this.strategyName}) Failed to refresh token!`, { error, token });
            throw error;
        }
    }

    protected initAuthUserSetup() {
        if (this.readAuthUserSetup) {
            // it's defined in subclass
            return;
        }
        const { configFn, configURL } = this.oauthConfig;
        if (configURL) {
            this.readAuthUserSetup = async (accessToken: string, tokenResponse: object) => {
                try {
                    const fetchResult = await fetch(configURL, {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            accessToken,
                            tokenResponse
                        })
                    });
                    if (fetchResult.ok) {
                        const jsonResult = await fetchResult.json();
                        return jsonResult as AuthUserSetup;
                    } else {
                        throw new Error(fetchResult.statusText);
                    }
                } catch (error) {
                    log.error(`(${this.strategyName}) Failed to fetch from "configURL"`, { error, configURL, accessToken });
                    throw new Error("Error while reading user profile.");
                }
            }
            return;
        }
        if (configFn) {
            this.readAuthUserSetup = async (accessToken: string, tokenResponse: object) => {
                let promise: Promise<AuthUserSetup>;
                try {
                    promise = runInNewContext(`tokenResponse = ${JSON.stringify(tokenResponse)} || {}; (${configFn})("${accessToken}", tokenResponse)`,
                        { fetch, console },
                        { filename: `${this.strategyName}-fetchAuthUser`, timeout: 5000 });
                } catch (error) {
                    log.error(`(${this.strategyName}) Failed to call "fetchAuthUserSetup"`, { error, configFn, accessToken });
                    throw new Error("Error with the Auth Provider Configuration.");
                }
                try {
                    return await promise;
                } catch (error) {
                    log.error(`(${this.strategyName}) Failed to run "configFn"`, { error, configFn, accessToken });
                    throw new Error("Error while reading user profile.");
                }
            }
        }
    }

    get authCallbackPath() {
        return new URL(this.oauthConfig.callBackUrl).pathname;
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
            log.warn(cxt, `(${strategyName}) Callback called repeatedly.`, { request, clientInfo });
            return;
        }
        log.info(cxt, `(${strategyName}) OAuth2 callback call. `, { clientInfo, authProviderId, requestUrl: request.originalUrl, request });

        const isAlreadyLoggedIn = request.isAuthenticated() && User.is(request.user);
        const authFlow = AuthFlow.get(request.session);
        if (isAlreadyLoggedIn) {
            if (!authFlow) {
                log.warn(cxt, `(${strategyName}) User is already logged in. No auth info provided. Redirecting to dashboard.`, { request, clientInfo });
                response.redirect(this.config.hostUrl.asDashboard().toString());
                return;
            }
        }

        // assert additional infomation is attached to current session
        if (!authFlow) {
            increaseLoginCounter("failed", this.host);

            log.error(cxt, `(${strategyName}) No session found during auth callback.`, { request, clientInfo });
            response.redirect(this.getSorryUrl(`Please allow Cookies in your browser and try to log in again.`));
            return;
        }

        if (authFlow.host !== this.host) {
            increaseLoginCounter("failed", this.host);

            log.error(cxt, `(${strategyName}) Host does not match.`, { request, clientInfo });
            response.redirect(this.getSorryUrl(`Host does not match.`));
            return;
        }

        const defaultLogPayload = { authFlow, clientInfo, authProviderId, request };

        // check OAuth2 errors
        const callbackParams = new URL(`https://anyhost${request.originalUrl}`).searchParams;
        const callbackError = callbackParams.get("error");
        const callbackErrorDescription: string | null = callbackParams.get("error_description");

        if (callbackError) { // e.g. "access_denied"
            // Clean up the session
            await AuthFlow.clear(request.session);
            await TosFlow.clear(request.session);

            increaseLoginCounter("failed", this.host);
            return this.sendCompletionRedirectWithError(response, { error: callbackError, description: callbackErrorDescription });
        }

        let result: Parameters<VerifyCallback>;
        try {
            result = await new Promise((resolve) => {
                const authenticate = passport.authenticate(this.getStrategy() as any, (...params: Parameters<VerifyCallback>) => resolve(params));
                authenticate(request, response, next);
            })
        } catch (error) {
            response.redirect(this.getSorryUrl(`OAuth2 error. (${error})`));
            return;
        }
        const [err, user, flowContext] = result;

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
         * - redirect to terms acceptance request page
         * - call `request.login` on new sessions
         * - redirect to `returnTo` (from request parameter)
         */

        const context = LogContext.from( { user: User.is(user) ? { userId: user.id } : undefined, request} );

        if (err) {
            await AuthFlow.clear(request.session);
            await TosFlow.clear(request.session);

            if (SelectAccountException.is(err)) {
                return this.sendCompletionRedirectWithError(response, err.payload);
            }
            if (EmailAddressAlreadyTakenException.is(err)) {
                return this.sendCompletionRedirectWithError(response, { error: "email_taken" });
            }

            let message = 'Authorization failed. Please try again.';
            if (AuthException.is(err)) {
                message = `Login was interrupted: ${err.message}`;
            }
            if (this.isOAuthError(err)) {
                message = 'OAuth Error. Please try again.'; // this is a 5xx response from authorization service
            }

            if (!UnconfirmedUserException.is(err)) {
                // user did not accept ToS. Don't count this towards the error burn rate.
                increaseLoginCounter("failed", this.host);
            }

            log.error(context, `(${strategyName}) Redirect to /sorry from verify callback`, err, { ...defaultLogPayload, err });
            response.redirect(this.getSorryUrl(message));
            return;
        }

        if (flowContext) {

            if (TosFlow.WithIdentity.is(flowContext) || (TosFlow.WithUser.is(flowContext) && flowContext.termsAcceptanceRequired)) {

                // This is the regular path on sign up. We just went through the OAuth2 flow but didn't create a Gitpod
                // account yet, as we require to accept the terms first.
                log.info(context, `(${strategyName}) Redirect to /api/tos`, { info: flowContext, ...defaultLogPayload });

                // attach the sign up info to the session, in order to proceed after acceptance of terms
                await TosFlow.attach(request.session!, flowContext);

                response.redirect(this.config.hostUrl.withApi({ pathname: '/tos', search: "mode=login" }).toString());
                return;
            } else  {
                const { user, elevateScopes } = flowContext as TosFlow.WithUser;
                log.info(context, `(${strategyName}) Directly log in and proceed.`, { info: flowContext, ...defaultLogPayload });

                // Complete login
                const { host, returnTo } = authFlow;
                await this.loginCompletionHandler.complete(request, response, { user, returnToUrl: returnTo, authHost: host, elevateScopes });
            }
        }
    }

    protected sendCompletionRedirectWithError(response: express.Response, error: object): void {
        log.info(`(${this.strategyName}) Send completion redirect with error`, { error });

        const url = this.config.hostUrl.with({ pathname: '/complete-auth', search: "message=error:" + Buffer.from(JSON.stringify(error), "utf-8").toString('base64') }).toString();
        response.redirect(url);
    }

    /**
     * cf. part (2) of `callback` function
     *
     * - `access_token` is provided
     * - it's expected to fetch the user info (see `fetchAuthUserSetup`)
     * - it's expected to handle the state persisted in the database in order to find/create/update the user instance
     * - it's expected to identify missing requirements, e.g. missing terms acceptance
     * - finally, it's expected to call `done` and provide the computed result in order to finalize the auth process
     */
    protected async verify(req: express.Request, accessToken: string, refreshToken: string | undefined, tokenResponse: any, _profile: undefined, done: VerifyCallback) {
        let flowContext: VerifyResult;
        const { strategyName, params: config } = this;
        const clientInfo = getRequestingClientInfo(req);
        const authProviderId = this.authProviderId;
        const authFlow = AuthFlow.get(req.session)!; // asserted in `callback` allready
        const defaultLogPayload = { authFlow, clientInfo, authProviderId };
        let currentGitpodUser: User | undefined = User.is(req.user) ? req.user : undefined;
        let candidate: Identity;

        try {
            const tokenResponseObject = this.ensureIsObject(tokenResponse);
            const { authUser, currentScopes, envVars } = await this.fetchAuthUserSetup(accessToken, tokenResponseObject);
            const { authName, primaryEmail } = authUser;
            candidate = { authProviderId, ...authUser };

            log.info(`(${strategyName}) Verify function called for ${authName}`, { ...defaultLogPayload, authUser });

            if (currentGitpodUser) {
                // user is already logged in

                // check for matching auth ID
                const currentIdentity = currentGitpodUser.identities.find(i => i.authProviderId === this.authProviderId);
                if (currentIdentity && currentIdentity.authId !== candidate.authId) {
                    log.warn(`User is trying to connect with another provider identity.`, { ...defaultLogPayload, authUser, candidate, currentGitpodUser: User.censor(currentGitpodUser), clientInfo });
                    done(AuthException.create("authId-mismatch", "Auth ID does not match with existing provider identity.", {}), undefined);
                    return;
                }

                // we need to check current provider authorizations first...
                try {
                    await this.userService.asserNoTwinAccount(currentGitpodUser, this.host, this.authProviderId, candidate);
                } catch (error) {
                    log.warn(`User is trying to connect a provider identity twice.`, { ...defaultLogPayload, authUser, candidate, currentGitpodUser: User.censor(currentGitpodUser), clientInfo });
                    done(error, undefined);
                    return;
                }
            } else {
                // no user session present, let's initiate a login
                currentGitpodUser = await this.userService.findUserForLogin({ candidate });

                if (!currentGitpodUser) {

                    // signup new accounts with email adresses already taken is disallowed
                    const existingUserWithSameEmail = (await this.userDb.findUsersByEmail(primaryEmail))[0];
                    if (existingUserWithSameEmail) {
                        try {
                            await this.userService.asserNoAccountWithEmail(primaryEmail);
                        } catch (error) {
                            log.warn(`Login attempt with matching email address.`, { ...defaultLogPayload, authUser, candidate, clientInfo });
                            done(error, undefined);
                            return;
                        }
                    }
                }
            }

            const token = this.createToken(this.tokenUsername, accessToken, refreshToken, currentScopes, tokenResponse.expires_in);

            if (currentGitpodUser) {
                const termsAcceptanceRequired = await this.userService.checkTermsAcceptanceRequired({ config, identity: candidate, user: currentGitpodUser });
                const elevateScopes = authFlow.overrideScopes ? undefined : await this.getMissingScopeForElevation(currentGitpodUser, currentScopes);
                const isBlocked = await this.userService.isBlocked({ user: currentGitpodUser });

                await this.userService.updateUserOnLogin(currentGitpodUser, authUser, candidate, token)
                await this.userService.updateUserEnvVarsOnLogin(currentGitpodUser, envVars); // derived from AuthProvider

                flowContext = <TosFlow.WithUser>{
                    user: User.censor(currentGitpodUser),
                    isBlocked,
                    termsAcceptanceRequired,
                    returnToUrl: authFlow.returnTo,
                    authHost: this.host,
                    elevateScopes
                }
            } else {
                const termsAcceptanceRequired = await this.userService.checkTermsAcceptanceRequired({ config, identity: candidate });

                // `checkSignUp` might throgh `AuthError`s with the intention to block the signup process.
                await this.userService.checkSignUp({ config, identity: candidate });

                const isBlocked = await this.userService.isBlocked({ primaryEmail });
                const { githubIdentity, githubToken } = this.createGhProxyIdentity(candidate);
                flowContext = <TosFlow.WithIdentity>{
                    candidate,
                    token,
                    authUser,
                    envVars,
                    additionalIdentity: githubIdentity,
                    additionalToken: githubToken,
                    authHost: this.host,
                    isBlocked,
                    termsAcceptanceRequired
                }
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

    protected createToken(username: string, value: string, refreshToken: string | undefined, scopes: string[], expires_in: any): Token {
        const now = new Date();
        const updateDate = now.toISOString();
        const tokenExpiresInSeconds = typeof expires_in === "number" ? expires_in : undefined;
        const expiryDate = tokenExpiresInSeconds ? new Date(now.getTime() + tokenExpiresInSeconds * 1000).toISOString() : undefined;
        return {
            value,
            username,
            scopes,
            updateDate,
            expiryDate,
            refreshToken
        };
    }

    protected get tokenUsername(): string {
        return "oauth2";
    }

    protected async fetchAuthUserSetup(accessToken: string, tokenResponse: object): Promise<AuthUserSetup> {
        if (!this.readAuthUserSetup) {
            throw new Error(`(${this.strategyName}) is missing configuration for reading of user information.`);
        }
        return this.readAuthUserSetup(accessToken, tokenResponse);
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
        currentScopes.forEach(s => set.delete(s));
        return set.size > 0;
    }

    protected createGhProxyIdentity(originalIdentity: Identity) {
        const githubTokenValue = this.params.params && this.params.params.githubToken;
        if (!githubTokenValue) {
            return {};
        }
        const publicGitHubAuthProviderId = "Public-GitHub";

        const githubIdentity: Identity = {
            authProviderId: publicGitHubAuthProviderId,
            authId: `proxy-${originalIdentity.authId}`,
            authName: `proxy-${originalIdentity.authName}`,
            primaryEmail: originalIdentity.primaryEmail,
            readonly: false // THIS ENABLES US TO UPGRADE FROM PROXY TO REAL GITHUB ACCOUNT
        }
        // this proxy identity should allow instant read access for GitHub API
        const githubToken: Token = {
            value: githubTokenValue,
            username: "oauth2",
            scopes: ["user:email"],
            updateDate: new Date().toISOString()
        };
        return { githubIdentity, githubToken };
    }

    protected isOAuthError(err: any): boolean {
        if (typeof err === "object" && (err.name == "InternalOAuthError" || err.name === "AuthorizationError")) {
            return true;
        }
        return false;
    }

    protected get defaultStrategyOptions(): StrategyOptionsWithRequest {
        const { authorizationUrl, tokenUrl, clientId, clientSecret, callBackUrl, scope, scopeSeparator, authorizationParams } = this.oauthConfig;
        const augmentedAuthParams = this.config.devBranch ? { ...authorizationParams, state: this.config.devBranch } : authorizationParams;
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
            authorizationParams: augmentedAuthParams
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
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        throw lastError;
    }

}

export type VerifyResult = TosFlow.WithIdentity | TosFlow.WithUser;

interface GenericOAuthStrategyOptions {
    scope?: string | string[];
    /**
     * This should be Gitpod's hostname.
     */
    userAgent: string;

    scopeSeparator?: string;
    customHeaders?: any;
    skipUserProfile?: true;
    /**
     * Non-spec autorization params.
     */
    authorizationParams?: object;
}

/**
 * Refinement of OAuth2Strategy.VerifyCallback
 */
type VerifyCallback = (err?: Error | undefined, user?: User | Identity, info?: VerifyResult) => void

export interface StrategyOptionsWithRequest extends OAuth2Strategy.StrategyOptionsWithRequest, GenericOAuthStrategyOptions { }

export class GenericOAuth2Strategy extends OAuth2Strategy {

    protected refreshOAuth2: OAuth2;
    constructor(readonly name: string, options: StrategyOptionsWithRequest, verify: OAuth2Strategy.VerifyFunctionWithRequest) {
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
            oa2._customHeaders);
        this.refreshOAuth2.getOAuthAccessToken = oa2.getOAuthAccessToken;
    }

    requestNewAccessToken(refreshToken: string, params: any, callback: oauth2tokenCallback) {
        params = params || {};
        params.grant_type = "refresh_token";
        this.refreshOAuth2.getOAuthAccessToken(refreshToken, params, callback);
    }

    protected patch_getOAuthAccessToken() {
        const oauth2 = this._oauth2;
        const _oauth2_getOAuthAccessToken = oauth2.getOAuthAccessToken as (code: string, params: any, callback: oauth2tokenCallback) => void;
        (oauth2 as any).getOAuthAccessToken = (code: string, params: any, callback: oauth2tokenCallback) => {
            const patchedCallback: oauth2tokenCallback = (err, accessToken, refreshToken, params) => {
                if (err) { return callback(err, null as any, null as any, null as any); }
                if (!accessToken) {
                    return callback({
                        statusCode: 400,
                        data: JSON.stringify(params)
                    }, null as any, null as any, null as any);
                }
                callback(null as any, accessToken, refreshToken, params);
            };
            _oauth2_getOAuthAccessToken.call(oauth2, code, params, patchedCallback);
        }
    }

    static augmentOptions(options: StrategyOptionsWithRequest): StrategyOptionsWithRequest {
        const result: StrategyOptionsWithRequest = { ...options };
        result.scopeSeparator = result.scopeSeparator || ',';
        result.customHeaders = result.customHeaders || {};
        if (!result.customHeaders['User-Agent']) {
            result.customHeaders['User-Agent'] = result.userAgent;
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
