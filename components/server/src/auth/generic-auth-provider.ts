/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from 'inversify';
import * as express from "express"
import * as passport from "passport"
import * as OAuth2Strategy from "passport-oauth2";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { AuthProviderInfo, Identity, Token, User, UserEnvVarValue } from '@gitpod/gitpod-protocol';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import fetch from "node-fetch";
import { oauth2tokenCallback, OAuth2 } from 'oauth';
import { format as formatURL, URL } from 'url';
import * as uuidv4 from 'uuid/v4';
import { runInNewContext } from "vm";
import { AuthBag, AuthProvider } from "../auth/auth-provider";
import { AuthProviderParams, AuthUserSetup } from "../auth/auth-provider";
import { AuthException, EMailDomainFilterException } from "../auth/errors";
import { GitpodCookie } from "../auth/gitpod-cookie";
import { Env } from "../env";
import { getRequestingClientInfo } from "../express-util";
import { TokenProvider } from '../user/token-provider';
import { UserService } from "../user/user-service";
import { BlockedUserFilter } from "./blocked-user-filter";
import { AuthProviderService } from './auth-provider-service';
import { AuthErrorHandler } from './auth-error-handler';

@injectable()
export class GenericAuthProvider implements AuthProvider {

    @inject(AuthProviderParams) config: AuthProviderParams;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(UserDB) protected userDb: UserDB;
    @inject(Env) protected env: Env;
    @inject(GitpodCookie) protected gitpodCookie: GitpodCookie;
    @inject(BlockedUserFilter) protected readonly blockedUserFilter: BlockedUserFilter;
    @inject(UserService) protected readonly userService: UserService;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;
    @inject(AuthErrorHandler) protected readonly authErrorHandler: AuthErrorHandler;

    @postConstruct()
    init() {
        this.initPassportStrategy();
        this.initAuthUserSetup();
    }

    get info(): AuthProviderInfo {
        return this.defaultInfo();
    }

    protected defaultInfo(): AuthProviderInfo {
        const scopes = this.oauthScopes;
        const { id, type, icon, host, ownerId, verified, hiddenOnDashboard, disallowLogin, description, loginContextMatcher } = this.config;
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
        return this.config.host;
    }
    get authProviderId() {
        return this.config.id;
    }
    protected get oauthConfig() {
        return this.config.oauth!;
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
        const handler = passport.authenticate(this.strategy as any, { ...this.defaultStrategyOptions, ...{ scope } });
        handler(req, res, next);
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
                this.strategy.requestNewAccessToken(refreshToken, {}, (error, access_token, refresh_token, result) => {
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

    readonly callback: express.RequestHandler = (request, response, next) => {
        // Once the 3rd party Auth Service is done it will redirect user's browser to the callback URL which is handled here:

        const strategyName = this.strategyName;
        const clientInfo = getRequestingClientInfo(request);
        if (response.headersSent) {
            log.warn(`(${strategyName}) Callback called repeatedly.`, { request, clientInfo });
            return;
        }
        const authBag = AuthBag.get(request.session);
        if (!authBag) {
            log.error({}, `(${strategyName}) No session found during auth callback.`, { request, 'login-flow': true, clientInfo });
            response.redirect(this.getSorryUrl(`Please allow Cookies in your browser and try to log in again.`));
            return;
        }
        const authProviderId = this.authProviderId;
        const defaultLogPayload = { "authorize-flow": authBag.requestType === "authorize", "login-flow": authBag.requestType === "authenticate", clientInfo, authProviderId };
        const requestUrl = new URL(formatURL({ protocol: request.protocol, host: request.get('host'), pathname: request.originalUrl }));
        const error = requestUrl.searchParams.get("error");
        if (error) { // e.g. "access_denied"
            log.info(`(${strategyName}) Callback with error.`, { ...defaultLogPayload, requestUrl });
            response.redirect(this.getSorryUrl(`Authorization was cancelled. (${error})`));
            return;
        }

        if (authBag.requestType === 'authorize') {
            // Authorization branch
            passport.authenticate(this.strategy as any, (err, user: User | undefined) => {
                this.authorizeCallbackHandler(err, user, authBag, response, defaultLogPayload);
            })(request, response, next);
        } else {
            // Login branch
            passport.authenticate(this.strategy as any, async (err, user: User | undefined) => {
                await this.loginCallbackHandler(err, user, authBag, request, response, defaultLogPayload);
            })(request, response, next);
        }
    }
    protected authorizeCallbackHandler(err: any, user: User | undefined, authBag: AuthBag, response: express.Response, logPayload: object) {
        const { id, verified, ownerId } = this.config;
        const strategyName = this.strategyName;
        const context: LogContext = user ? { userId: user.id } : {};
        log.info(context, `(${strategyName}) Callback (authorize)`, { ...logPayload });
        if (err || !user) {
            const message = this.isOAuthError(err) ?
                'OAuth Error. Please try again.' : // this is a 5xx responsefrom
                'Authorization failed. Please try again.'; // this might be a race of our API calls
            log.error(context, `(${strategyName}) Redirect to /sorry (OAuth Error)`, err, { ...logPayload, err });
            response.redirect(this.getSorryUrl(message));
            return;
        }
        if (!verified && user.id === ownerId) {
            this.authProviderService.markAsVerified({ id, ownerId });
        }
        response.redirect(authBag.returnTo);
    }
    protected async loginCallbackHandler(err: any, user: User | undefined, authBag: AuthBag, request: express.Request, response: express.Response, logPayload: object) {
        const { id, verified, ownerId } = this.config;
        const strategyName = this.strategyName;
        const context: LogContext = user ? { userId: user.id } : {};
        log.info(context, `(${strategyName}) Callback (login)`, { ...logPayload });

        const handledError = await this.authErrorHandler.check(err);
        if (handledError) {
            const { redirectToUrl } = handledError;
            log.info(context, `(${strategyName}) Handled auth error. Redirecting to ${redirectToUrl}`, { ...logPayload, err });
            response.redirect(redirectToUrl);
        }
        if (err) {
            let message = 'Authorization failed. Please try again.';
            if (AuthException.is(err)) {
                message = `Login was interrupted: ${err.message}`;
            }
            if (this.isOAuthError(err)) {
                message = 'OAuth Error. Please try again.'; // this is a 5xx response from authorization service
            }
            log.error(context, `(${strategyName}) Redirect to /sorry (OAuth Error)`, err, { ...logPayload, err });
            response.redirect(this.getSorryUrl(message));
            return;
        }
        if (!user) {
            log.error(context, `(${strategyName}) Redirect to /sorry (NO user)`, { request, ...logPayload });
            response.redirect(this.getSorryUrl('Login with failed.'));
            return;
        }

        const userCount = await this.userDb.getUserCount();
        if (userCount === 1) {
            // assuming the single user was just created, we can mark the user as admin
            user.rolesOrPermissions = ['admin'];
            user = await this.userDb.storeUser(user);

            // we can now enable the first auth provider
            if (this.config.builtin === false && !verified) {
                this.authProviderService.markAsVerified({ id, ownerId, newOwnerId: user.id });
            }
        }

        // Finally login and redirect.
        request.login(user, err => {
            if (err) {
                throw err;
            }
            // re-read the session info, as it might have changed in the authenticator
            const authBag = AuthBag.get(request.session);
            if (!authBag || authBag.requestType !== 'authenticate') {
                response.redirect(this.getSorryUrl('Session not found.'));
                return;
            }
            let returnTo = authBag.returnTo;
            const context: LogContext = user ? { userId: user.id } : {};
            if (authBag.elevateScopes) {
                const elevateScopesUrl = this.env.hostUrl.withApi({
                    pathname: '/authorize',
                    search: `returnTo=${encodeURIComponent(returnTo)}&host=${authBag.host}&scopes=${authBag.elevateScopes.join(',')}`
                }).toString();
                returnTo = elevateScopesUrl;
            }
            log.info(context, `(${strategyName}) User is logged in successfully. Redirect to: ${returnTo}`, { ...logPayload });

            // Clean up the session
            AuthBag.clear(request.session);

            // Create Gitpod 🍪 before the redirect
            this.gitpodCookie.setCookie(response);
            response.redirect(returnTo);
        });
    }

    protected strategy: GenericOAuth2Strategy;
    protected initPassportStrategy(): void {
        const { defaultStrategyOptions, strategyName } = this;
        log.info(`Auth strategy initialized (${strategyName})`, { defaultStrategyOptions });
        this.strategy = new GenericOAuth2Strategy(strategyName, { ...defaultStrategyOptions },
            async (req: express.Request, accessToken: string, refreshToken: string | undefined, tokenResponse: any, _profile: undefined, done: OAuth2Strategy.VerifyCallback) => {
                await this.verify(req, accessToken, refreshToken, tokenResponse, _profile, done);
            }
        );
    }
    protected async verify(req: express.Request, accessToken: string, refreshToken: string | undefined, tokenResponse: any, _profile: undefined, done: OAuth2Strategy.VerifyCallback) {
        const { strategyName } = this;
        const clientInfo = getRequestingClientInfo(req);
        const authProviderId = this.authProviderId;
        const authBag = AuthBag.get(req.session);
        if (!authBag) {
            log.info(`(${strategyName}) Invalid Auth Session. No Auth Bag attached.`, { req, clientInfo, tokenResponse });
            done(new Error("Invalid Auth Session!"));
            return;
        }
        const defaultLogPayload = { "authorize-flow": authBag.requestType === "authorize", "login-flow": authBag.requestType === "authenticate", clientInfo, authProviderId };
        try {
            const tokenResponseObject = this.ensureIsObject(tokenResponse);
            const { authUser, blockUser, currentScopes, envVars } = await this.fetchAuthUserSetup(accessToken, tokenResponseObject);
            const { authId, authName, primaryEmail } = authUser;
            let identity: Identity = { authProviderId, authId, authName, primaryEmail };

            log.info(`(${strategyName}) Verify for authName: ${authName}`, { ...defaultLogPayload, authUser });

            let currentGitpodUser = req.user as User | undefined;

            if (!User.is(currentGitpodUser)) { // no user in sessino, thus login-flow

                // handle blacklisted users
                if (await this.blockedUserFilter.isBlocked(primaryEmail)) {
                    done(EMailDomainFilterException.create(primaryEmail));
                    return;
                }

                // first try to find a user by identity/email.
                currentGitpodUser = await this.userDb.findUserByIdentity(identity);
                if (!currentGitpodUser) {
                    // 1) findUsersByEmail is supposed to return users ordered descending by last login time
                    // 2) we pick the most recently used one and let the old onces "dry out"
                    const usersWithSamePrimaryEmail = await this.userDb.findUsersByEmail(primaryEmail);
                    if (usersWithSamePrimaryEmail.length > 0) {
                        currentGitpodUser = usersWithSamePrimaryEmail[0];
                        log.info(`(${strategyName}) Found user by email address. Log in...`, { ...defaultLogPayload, identity, usersWithSamePrimaryEmail, authUser });
                    }
                }

                if (!currentGitpodUser) {
                    // handle additional requirements
                    await this.userService.checkSignUp({ config: this.config, identity });

                    // We have never seen this user before, create new user and continue.
                    currentGitpodUser = await this.userService.createUserForIdentity(identity);
                }

                // block new users per request
                if (blockUser) {
                    currentGitpodUser.blocked = true;
                }
            } else { // current Gitpod user known from session
                let identity = currentGitpodUser.identities.find(i => i.authId === authId);

                if (!identity) {

                    // 1) there might be another Gitpod user linked with this identity, let's associate with current user
                    const userWithSameIdentity = await this.userDb.findUserByIdentity({ authProviderId, authId });
                    if (userWithSameIdentity) {
                        identity = userWithSameIdentity.identities.find(identity => Identity.equals(identity, { authId, authProviderId }));
                        log.info(`(${strategyName}) Moving identity to most recently used user.`, { ...defaultLogPayload, authUser, currentGitpodUser, userWithSameIdentity, identity, clientInfo });
                    }

                    // 2) this identity is linked for the first time
                    if (!identity) {
                        identity = { authProviderId, authId, authName, primaryEmail };
                    }

                }
            }


            /*
             * At this point we have found/created a Gitpod user and the user profile/setup is fetched, let's update the link!
             */

            const existingIdentity = currentGitpodUser.identities.find(i => Identity.equals(i, identity));
            if (existingIdentity) {
                let shouldElevate = false;
                let prevScopes: string[] = [];
                try {
                    const token = await this.getCurrentToken(currentGitpodUser);
                    prevScopes = token ? token.scopes : prevScopes;
                    shouldElevate = this.prevScopesAreMissing(currentScopes, prevScopes);
                } catch {
                    // no token
                }
                if (shouldElevate) {
                    log.info(`(${strategyName}) Existing user needs to elevate scopes.`, { ...defaultLogPayload, identity });
                    const authBag = AuthBag.get(req.session);
                    if (req.session && authBag && authBag.requestType === "authenticate") {
                        await AuthBag.attach(req.session, { ...authBag, elevateScopes: prevScopes });
                    }
                }
                identity = existingIdentity;
            }

            // ensure single identity per auth provider instance
            currentGitpodUser.identities = currentGitpodUser.identities.filter(i => i.authProviderId !== authProviderId);
            currentGitpodUser.identities.push(identity);

            // update user
            currentGitpodUser.name = authUser.authName || currentGitpodUser.name;
            currentGitpodUser.avatarUrl = authUser.avatarUrl || currentGitpodUser.avatarUrl;

            // update token, scopes, and email
            const now = new Date();
            const updateDate = now.toISOString();
            const tokenExpiresInSeconds = typeof tokenResponse.expires_in === "number" ? tokenResponse.expires_in : undefined;
            const expiryDate = tokenExpiresInSeconds ? new Date(now.getTime() + tokenExpiresInSeconds * 1000).toISOString() : undefined;
            const token: Token = {
                value: accessToken,
                username: this.tokenUsername,
                scopes: currentScopes,
                updateDate,
                expiryDate,
                refreshToken
            };
            identity.primaryEmail = authUser.primaryEmail; // case: changed email
            identity.authName = authUser.authName; // case: renamed account

            await this.userDb.storeUser(currentGitpodUser),
                await this.userDb.storeSingleToken(identity, token),
                await this.updateEnvVars(currentGitpodUser, envVars),
                await this.createGhProxyIdentityOnDemand(currentGitpodUser, identity)

            done(null, currentGitpodUser);
        } catch (err) {
            log.error(`(${strategyName}) Exception in verify function`, err, { ...defaultLogPayload, err });
            done(err);
        }
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

    protected async updateEnvVars(user: User, envVars?: UserEnvVarValue[]) {
        if (!envVars) {
            return;
        }
        const userId = user.id;
        const currentEnvVars = await this.userDb.getEnvVars(userId);
        const findEnvVar = (name: string, repositoryPattern: string) => currentEnvVars.find(env => env.repositoryPattern === repositoryPattern && env.name === name);
        for (const { name, value, repositoryPattern } of envVars) {
            try {
                const existingEnvVar = findEnvVar(name, repositoryPattern);
                await this.userDb.setEnvVar(existingEnvVar ? {
                    ...existingEnvVar,
                    value
                } : {
                        repositoryPattern,
                        name,
                        userId,
                        id: uuidv4(),
                        value
                    });
            } catch (error) {
                log.error(`(${this.strategyName}) Failed update Env Vars`, { error, user, envVars });
            }
        }
    }

    protected async createGhProxyIdentityOnDemand(user: User, ghIdentity: Identity) {
        const githubTokenValue = this.config.params && this.config.params.githubToken;
        if (!githubTokenValue) {
            return;
        }
        const publicGitHubAuthProviderId = "Public-GitHub";
        if (user.identities.some(i => i.authProviderId === publicGitHubAuthProviderId)) {
            return;
        }

        const githubIdentity: Identity = {
            authProviderId: publicGitHubAuthProviderId,
            authId: `proxy-${ghIdentity.authId}`,
            authName: `proxy-${ghIdentity.authName}`,
            primaryEmail: ghIdentity.primaryEmail,
            readonly: false // THIS ENABLES US TO UPGRADE FROM PROXY TO REAL GITHUB ACCOUNT
        }
        // create a proxy identity to allow access GitHub API
        user.identities.push(githubIdentity);
        const githubToken: Token = {
            value: githubTokenValue,
            username: "oauth2",
            scopes: ["user:email"],
            updateDate: new Date().toISOString()
        };
        await Promise.all([
            this.userDb.storeUser(user),
            this.userDb.storeSingleToken(githubIdentity, githubToken)
        ]);
    }

    protected isOAuthError(err: any): boolean {
        if (typeof err === "object" && (err.name == "InternalOAuthError" || err.name === "AuthorizationError")) {
            return true;
        }
        return false;
    }

    protected get defaultStrategyOptions(): StrategyOptionsWithRequest {
        const { authorizationUrl, tokenUrl, clientId, clientSecret, callBackUrl, scope, scopeSeparator, authorizationParams } = this.oauthConfig;
        const augmentedAuthParams = this.env.devBranch ? { ...authorizationParams, state: this.env.devBranch } : authorizationParams;
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
        return this.env.hostUrl.with({ pathname: `/sorry`, hash: message }).toString();
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
