/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import { inject, injectable } from "inversify";
import { UserDB, DBUser, WorkspaceDB, OneTimeSecretDB } from "@gitpod/gitpod-db/lib";
import * as express from "express";
import { Authenticator } from "../auth/authenticator";
import { Config } from "../config";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthorizationService } from "./authorization-service";
import { Permission } from "@gitpod/gitpod-protocol/lib/permission";
import { UserService } from "./user-service";
import { parseWorkspaceIdFromHostname } from "@gitpod/gitpod-protocol/lib/util/parse-workspace-id";
import { SessionHandlerProvider } from "../session-handler";
import { URL } from "url";
import { saveSession, getRequestingClientInfo, destroySession } from "../express-util";
import { GitpodToken, GitpodTokenType, User } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { AuthFlow } from "../auth/auth-provider";
import { LoginCompletionHandler } from "../auth/login-completion-handler";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { TosCookie } from "./tos-cookie";
import { TosFlow } from "../terms/tos-flow";
import { increaseLoginCounter } from "../../src/prometheus-metrics";
import { v4 as uuidv4 } from "uuid";
import { OwnerResourceGuard, ResourceAccessGuard, ScopedResourceGuard } from "../auth/resource-access";
import { OneTimeSecretServer } from "../one-time-secret-server";
import { trackSignup } from "../analytics";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { EnforcementControllerServerFactory } from "./enforcement-endpoint";
import { ClientMetadata } from "../websocket/websocket-connection-manager";
import { ResponseError } from "vscode-jsonrpc";
import { VerificationService } from "../auth/verification-service";
import { daysBefore, isDateSmaller } from "@gitpod/gitpod-protocol/lib/util/timeutil";

@injectable()
export class UserController {
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(Authenticator) protected readonly authenticator: Authenticator;
    @inject(Config) protected readonly config: Config;
    @inject(TosCookie) protected readonly tosCookie: TosCookie;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(UserService) protected readonly userService: UserService;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(SessionHandlerProvider) protected readonly sessionHandlerProvider: SessionHandlerProvider;
    @inject(LoginCompletionHandler) protected readonly loginCompletionHandler: LoginCompletionHandler;
    @inject(OneTimeSecretServer) protected readonly otsServer: OneTimeSecretServer;
    @inject(OneTimeSecretDB) protected readonly otsDb: OneTimeSecretDB;
    @inject(WorkspaceManagerClientProvider)
    protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;
    @inject(EnforcementControllerServerFactory) private readonly serverFactory: EnforcementControllerServerFactory;
    @inject(VerificationService) protected readonly verificationService: VerificationService;

    get apiRouter(): express.Router {
        const router = express.Router();

        router.get("/login", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            // Clean up
            this.tosCookie.unset(res);

            if (req.isAuthenticated()) {
                log.info({ sessionId: req.sessionID }, "(Auth) User is already authenticated.", { "login-flow": true });
                // redirect immediately
                const redirectTo = this.getSafeReturnToParam(req) || this.config.hostUrl.asDashboard().toString();
                res.redirect(redirectTo);
                return;
            }
            const clientInfo = getRequestingClientInfo(req);
            log.info({ sessionId: req.sessionID }, "(Auth) User started the login process", {
                "login-flow": true,
                clientInfo,
            });

            // Try to guess auth host from request
            await this.augmentLoginRequest(req);

            // If there is no known auth host, we need to ask the user
            const redirectToLoginPage = !req.query.host;
            if (redirectToLoginPage) {
                const returnTo = this.getSafeReturnToParam(req);
                const search = returnTo ? `returnTo=${returnTo}` : "";
                const loginPageUrl = this.config.hostUrl.asLogin().with({ search }).toString();
                log.info(`Redirecting to login ${loginPageUrl}`);
                res.redirect(loginPageUrl);
                return;
            }

            // Make sure, the session is stored before we initialize the OAuth flow
            try {
                await saveSession(req.session);
            } catch (error) {
                increaseLoginCounter("failed", "unknown");
                log.error(`Login failed due to session save error; redirecting to /sorry`, { req, error, clientInfo });
                res.redirect(this.getSorryUrl("Login failed 🦄 Please try again"));
            }

            // Proceed with login
            this.ensureSafeReturnToParam(req);
            await this.authenticator.authenticate(req, res, next);
        });

        router.get(
            "/login/ots/:userId/:key",
            async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                try {
                    const secret = await this.otsDb.get(req.params.key);
                    if (!secret) {
                        res.sendStatus(401);
                        return;
                    }

                    const user = await this.userDb.findUserById(req.params.userId);
                    if (!user) {
                        res.sendStatus(404);
                        return;
                    }

                    const secretHash = crypto
                        .createHash("sha256")
                        .update(user.id + this.config.session.secret)
                        .digest("hex");
                    if (secretHash !== secret) {
                        res.sendStatus(401);
                        return;
                    }

                    // mimick the shape of a successful login
                    (req.session! as any).passport = { user: user.id };

                    // Save session to DB
                    await new Promise<void>((resolve, reject) =>
                        req.session!.save((err) => (err ? reject(err) : resolve())),
                    );

                    res.sendStatus(200);
                } catch (error) {
                    res.sendStatus(500);
                }
            },
        );

        router.get("/authorize", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (!User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            if (req.user.blocked) {
                res.sendStatus(403);
                return;
            }
            this.ensureSafeReturnToParam(req);
            this.authenticator.authorize(req, res, next).catch((err) => log.error("authenticator.authorize", err));
        });
        router.get("/deauthorize", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (!User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            if (req.user.blocked) {
                res.sendStatus(403);
                return;
            }
            this.ensureSafeReturnToParam(req);
            this.authenticator.deauthorize(req, res, next).catch((err) => log.error("authenticator.deauthorize", err));
        });
        router.get("/logout", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const logContext = LogContext.from({ user: req.user, request: req });
            const clientInfo = getRequestingClientInfo(req);
            const logPayload = { session: req.session, clientInfo };

            let redirectToUrl = this.getSafeReturnToParam(req) || this.config.hostUrl.toString();

            if (req.isAuthenticated()) {
                req.logout();
            }
            try {
                if (req.session) {
                    await destroySession(req.session);
                }
            } catch (error) {
                log.warn(logContext, "(Logout) Error on Logout.", { error, req, ...logPayload });
            }

            // clear cookies
            this.sessionHandlerProvider.clearSessionCookie(res, this.config);

            // then redirect
            log.info(logContext, "(Logout) Redirecting...", { redirectToUrl, ...logPayload });
            res.redirect(redirectToUrl);
        });
        router.get(
            "/auth/workspace-cookie/:instanceID",
            async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                if (!req.isAuthenticated() || !User.is(req.user)) {
                    res.sendStatus(401);
                    log.warn("unauthenticated workspace cookie fetch", { instanceId: req.params.instanceID });
                    return;
                }

                const user = req.user as User;
                if (user.blocked) {
                    res.sendStatus(403);
                    log.warn("blocked user attempted to fetch workspace cookie", {
                        instanceId: req.params.instanceID,
                        userId: user.id,
                    });
                    return;
                }

                const instanceID = req.params.instanceID;
                if (!instanceID) {
                    res.sendStatus(400);
                    log.warn("attempted to fetch workspace cookie without instance ID", {
                        instanceId: req.params.instanceID,
                        userId: user.id,
                    });
                    return;
                }

                let cookiePrefix: string = this.config.hostUrl.url.host;
                cookiePrefix = cookiePrefix.replace(/^https?/, "");
                [" ", "-", "."].forEach((c) => (cookiePrefix = cookiePrefix.split(c).join("_")));
                const name = `_${cookiePrefix}_ws_${instanceID}_owner_`;

                if (!!req.cookies[name]) {
                    // cookie is already set - do nothing. This prevents server from drowning in load
                    // if the dashboard is ill-behaved.
                    res.sendStatus(200);
                    return;
                }

                const [workspace, instance] = await Promise.all([
                    this.workspaceDB.findByInstanceId(instanceID),
                    this.workspaceDB.findInstanceById(instanceID),
                ]);
                if (!workspace || !instance) {
                    res.sendStatus(404);
                    log.warn("attempted to fetch workspace cookie for non-existent workspace instance", {
                        instanceId: req.params.instanceID,
                        userId: user.id,
                    });
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
                    log.warn("unauthorized attempted to fetch workspace cookie", {
                        instanceId: req.params.instanceID,
                        userId: user.id,
                    });
                    return;
                }

                const token = instance.status.ownerToken;
                if (!token) {
                    // no token, no problem. The dashboard will try again later.
                    res.sendStatus(200);
                    log.debug("attempted to fetch workspace cookie, but instance has no owner token", {
                        instanceId: req.params.instanceID,
                        userId: user.id,
                    });
                    return;
                }

                if (res.headersSent) {
                    return;
                }

                res.cookie(name, token, {
                    path: "/",
                    httpOnly: true,
                    secure: true,
                    maxAge: 1000 * 60 * 60 * 24 * 1, // 1 day
                    sameSite: "lax", // default: true. "Lax" needed for cookie to work in the workspace domain.
                    domain: `.${this.config.hostUrl.url.host}`,
                });
                res.sendStatus(200);
            },
        );

        router.post(
            "/auth/workspacePageClose/:instanceID",
            async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                const logCtx: LogContext = { instanceId: req.params.instanceID };
                if (!req.isAuthenticated() || !User.is(req.user)) {
                    res.sendStatus(401);
                    log.warn(logCtx, "unauthenticated workspacePageClose");
                    return;
                }

                const user = req.user as User;
                logCtx.userId = user.id;
                if (user.blocked) {
                    res.sendStatus(403);
                    log.warn(logCtx, "blocked user attempted to workspacePageClose");
                    return;
                }

                const instanceID = req.params.instanceID;
                if (!instanceID) {
                    res.sendStatus(400);
                    log.warn(logCtx, "attempted to workspacePageClose without instance ID");
                    return;
                }
                const sessionId = req.body.sessionId;
                const server = this.createGitpodServer(user, new OwnerResourceGuard(user.id));
                try {
                    await server.sendHeartBeat({}, { wasClosed: true, instanceId: instanceID });
                    /** no await */ server
                        .trackEvent(
                            {},
                            {
                                event: "ide_close_signal",
                                properties: {
                                    sessionId,
                                    instanceId: instanceID,
                                    clientKind: "supervisor-frontend",
                                },
                            },
                        )
                        .catch((err) => log.warn(logCtx, "workspacePageClose: failed to track ide close signal", err));
                    res.sendStatus(200);
                } catch (e) {
                    if (e instanceof ResponseError) {
                        res.status(e.code).send(e.message);
                        log.warn(
                            logCtx,
                            `workspacePageClose: server sendHeartBeat respond with code: ${e.code}, message: ${e.message}`,
                        );
                        return;
                    }
                    log.error(logCtx, "workspacePageClose failed", e);
                    res.sendStatus(500);
                    return;
                } finally {
                    server.dispose();
                }
            },
        );
        if (this.config.enableLocalApp) {
            router.get(
                "/auth/local-app",
                async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                    if (!req.isAuthenticated() || !User.is(req.user)) {
                        res.sendStatus(401);
                        return;
                    }

                    const user = req.user as User;
                    if (user.blocked) {
                        res.sendStatus(403);
                        return;
                    }

                    const rt = req.query.returnTo;
                    // @ts-ignore Type 'ParsedQs' is not assignable
                    if (!rt || !rt.startsWith("localhost:")) {
                        log.error(`auth/local-app: invalid returnTo URL: "${rt}"`);
                        res.sendStatus(400);
                        return;
                    }

                    const token = crypto.randomBytes(30).toString("hex");
                    const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
                    const dbToken: GitpodToken & { user: DBUser } = {
                        tokenHash,
                        name: `local-app`,
                        type: GitpodTokenType.MACHINE_AUTH_TOKEN,
                        user: req.user as DBUser,
                        scopes: [
                            "function:getWorkspaces",
                            "function:listenForWorkspaceInstanceUpdates",
                            "resource:" +
                                ScopedResourceGuard.marshalResourceScope({
                                    kind: "workspace",
                                    subjectID: "*",
                                    operations: ["get"],
                                }),
                            "resource:" +
                                ScopedResourceGuard.marshalResourceScope({
                                    kind: "workspaceInstance",
                                    subjectID: "*",
                                    operations: ["get"],
                                }),
                        ],
                        created: new Date().toISOString(),
                    };
                    await this.userDb.storeGitpodToken(dbToken);

                    const otsExpirationTime = new Date();
                    otsExpirationTime.setMinutes(otsExpirationTime.getMinutes() + 2);
                    const ots = await this.otsServer.serve({}, token, otsExpirationTime);

                    res.redirect(`http://${rt}/?ots=${encodeURI(ots.token)}`);
                },
            );
        }
        router.get(
            "/auth/workspace",
            async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
                        log.info({ userId: user.id, workspaceId }, "User does not own private workspace. Denied");
                        res.sendStatus(403);
                        return;
                    }
                }

                res.sendStatus(200);
            },
        );
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
        router.get("/tos", async (req: express.Request, res: express.Response) => {
            const mode = req.query["mode"] as "login" | "update" | unknown;
            const clientInfo = getRequestingClientInfo(req);
            let tosFlowInfo = TosFlow.get(req.session);
            const authFlow = AuthFlow.get(req.session);

            const logContext = LogContext.from({ user: req.user, request: req });
            const logPayload = { session: req.session, clientInfo, tosFlowInfo, authFlow, mode };

            const redirectOnInvalidRequest = async () => {
                // just don't forget
                this.tosCookie.unset(res);
                await AuthFlow.clear(req.session);
                await TosFlow.clear(req.session);

                log.info(logContext, "(TOS) Invalid request. (/tos)", logPayload);
                res.redirect(this.getSorryUrl("Oops! Something went wrong. (invalid request)"));
            };

            if (mode !== "login" && mode !== "update") {
                await redirectOnInvalidRequest();
                return;
            }

            if (mode === "login") {
                if (!authFlow || !TosFlow.is(tosFlowInfo)) {
                    await redirectOnInvalidRequest();
                    return;
                }

                // in a special case of the signup process, we're redirecting to /tos even if not required.
                if (TosFlow.WithIdentity.is(tosFlowInfo) && tosFlowInfo.termsAcceptanceRequired === false) {
                    log.info(logContext, "(TOS) Not required.", logPayload);
                    await this.handleTosProceedForNewUser(req, res, authFlow, tosFlowInfo);
                    return;
                }
            } else {
                // we are in tos update process

                const user = User.is(req.user) ? req.user : undefined;
                if (!user) {
                    await redirectOnInvalidRequest();
                    return;
                }

                // initializing flow here!
                tosFlowInfo = <TosFlow.WithUser>{
                    user: User.censor(user),
                    returnToUrl: req.query.returnTo,
                };
            }

            // attaching a random identifier for this web flow to test if it's present in `/tos/proceed` handler
            const flowId = uuidv4();
            tosFlowInfo.flowId = flowId;
            await TosFlow.attach(req.session!, tosFlowInfo);

            const isUpdate = !TosFlow.WithIdentity.is(tosFlowInfo);
            const userInfo = tosFlowUserInfo(tosFlowInfo);
            const tosHints = {
                flowId,
                isUpdate, // indicate whether to show the "we've updated ..." message
                userInfo, // let us render the avatar on the dashboard page
            };
            this.tosCookie.set(res, tosHints);

            log.info(logContext, "(TOS) Redirecting to /tos.", { tosHints, ...logPayload });
            res.redirect(this.config.hostUrl.with(() => ({ pathname: "/tos/" })).toString());
        });
        const tosFlowUserInfo = (tosFlowInfo: TosFlow) => {
            if (TosFlow.WithIdentity.is(tosFlowInfo)) {
                tosFlowInfo.authUser.authName;
                return {
                    name: tosFlowInfo.authUser.name || tosFlowInfo.authUser.authName,
                    avatarUrl: tosFlowInfo.authUser.avatarUrl,
                    authHost: tosFlowInfo.authHost,
                    authName: tosFlowInfo.authUser.authName,
                };
            }
            if (TosFlow.WithUser.is(tosFlowInfo)) {
                return {
                    name: tosFlowInfo.user.name,
                    avatarUrl: tosFlowInfo.user.avatarUrl,
                };
            }
        };
        router.post("/tos/proceed", async (req: express.Request, res: express.Response) => {
            // just don't forget
            this.tosCookie.unset(res);

            const clientInfo = getRequestingClientInfo(req);
            const tosFlowInfo = TosFlow.get(req.session);
            const authFlow = AuthFlow.get(req.session);
            const isInLoginProcess = !!authFlow;

            const logContext = LogContext.from({ user: req.user, request: req });
            const logPayload = { session: req.session, clientInfo, tosFlowInfo, authFlow };

            const redirectOnInvalidSession = async () => {
                await AuthFlow.clear(req.session);
                await TosFlow.clear(req.session);

                log.info(logContext, "(TOS) Invalid session. (/tos/proceed)", logPayload);
                res.redirect(this.getSorryUrl("Oops! Something went wrong. (invalid session)"));
            };

            if (!TosFlow.is(tosFlowInfo)) {
                await redirectOnInvalidSession();
                return;
            }

            // detaching the (random) identifier of this webflow
            const flowId = tosFlowInfo.flowId;
            delete tosFlowInfo.flowId;
            await TosFlow.attach(req.session!, tosFlowInfo);

            // let's assume if the form is re-submitted a second time, we need to abort the process, because
            // otherwise we potentially create accounts for the same provider identity twice.
            //
            // todo@alex: check if it's viable to test the flow ids for a single submission, instead of detaching
            // from the session.
            if (typeof flowId !== "string") {
                await redirectOnInvalidSession();
                return;
            }

            const agreeTOS = req.body.agreeTOS;
            if (!agreeTOS) {
                // The user did not accept the terms.
                // A redirect to /logout will wipe the session, which in case of a signup will ensure
                // that no user data remains in the system.
                log.info(logContext, "(TOS) User did NOT agree. Redirecting to /logout.", logPayload);

                res.redirect(this.config.hostUrl.withApi({ pathname: "/logout" }).toString());
                // todo@alex: consider redirecting to a info page (returnTo param)

                return;
            }

            // The user has approved the terms.
            log.info(logContext, "(TOS) User did agree.", logPayload);

            if (TosFlow.WithIdentity.is(tosFlowInfo)) {
                if (!authFlow) {
                    await redirectOnInvalidSession();
                    return;
                }

                // there is a possibility, that a competing browser session already created a new user account
                // for this provider identity, thus we need to check again, in order to avoid created unreachable accounts
                const user = await this.userService.findUserForLogin({ candidate: tosFlowInfo.candidate });
                if (user) {
                    log.info(`(TOS) User was created in a parallel browser session, let's login...`, { logPayload });
                    await this.loginCompletionHandler.complete(req, res, {
                        user,
                        authHost: tosFlowInfo.authHost,
                        returnToUrl: authFlow.returnTo,
                    });
                } else {
                    await this.handleTosProceedForNewUser(req, res, authFlow, tosFlowInfo, req.body);
                }

                return;
            }

            if (TosFlow.WithUser.is(tosFlowInfo)) {
                const { user, returnToUrl } = tosFlowInfo;

                await this.userService.acceptCurrentTerms(user);

                if (isInLoginProcess) {
                    await this.loginCompletionHandler.complete(req, res, { ...tosFlowInfo });
                } else {
                    let returnTo = returnToUrl || this.config.hostUrl.asDashboard().toString();
                    res.redirect(returnTo);
                }
            }
        });

        return router;
    }

    protected async handleTosProceedForNewUser(
        req: express.Request,
        res: express.Response,
        authFlow: AuthFlow,
        tosFlowInfo: TosFlow.WithIdentity,
        tosProceedParams?: any,
    ) {
        const { candidate, token } = tosFlowInfo;
        const { returnTo, host } = authFlow;
        const user = await this.userService.createUser({
            identity: candidate,
            token,
            userUpdate: (user) => this.updateNewUserAfterTos(user, tosFlowInfo, tosProceedParams),
        });

        const { additionalIdentity, additionalToken, envVars } = tosFlowInfo;
        if (additionalIdentity && additionalToken) {
            await this.userService.updateUserIdentity(user, additionalIdentity, additionalToken);
        }

        if (user.blocked) {
            log.warn({ user: user.id }, "user blocked on signup");
        }

        await this.userService.updateUserEnvVarsOnLogin(user, envVars);
        await this.userService.acceptCurrentTerms(user);

        /** no await */ trackSignup(user, req, this.analytics).catch((err) =>
            log.warn({ userId: user.id }, "trackSignup", err),
        );

        await this.loginCompletionHandler.complete(req, res, { user, returnToUrl: returnTo, authHost: host });
    }

    protected updateNewUserAfterTos(newUser: User, tosFlowInfo: TosFlow.WithIdentity, tosProceedParams?: any) {
        const { authUser } = tosFlowInfo;
        newUser.name = authUser.authName;
        newUser.fullName = authUser.name || undefined;
        newUser.avatarUrl = authUser.avatarUrl;
        newUser.blocked = newUser.blocked || tosFlowInfo.isBlocked;
        if (authUser.created_at && isDateSmaller(authUser.created_at, daysBefore(new Date().toISOString(), 30))) {
            // people with an account older than 30 days are treated as trusted
            this.verificationService.markVerified(newUser);
        }
    }

    protected getSorryUrl(message: string) {
        return this.config.hostUrl.asSorry(message).toString();
    }

    protected async augmentLoginRequest(req: express.Request) {
        const returnToURL = this.getSafeReturnToParam(req);
        if (req.query.host) {
            // This login request points already to an auth host
            return;
        }

        // read current auth provider configs
        const authProviderConfigs = this.hostContextProvider.getAll().map((hc) => hc.authProvider.params);

        // Special Context exception
        if (returnToURL) {
            const authProviderForSpecialContext = authProviderConfigs.find((c) => {
                if (c.loginContextMatcher) {
                    try {
                        const matcher = new RegExp(c.loginContextMatcher);
                        return matcher.test(returnToURL);
                    } catch {
                        /* */
                    }
                }
                return false;
            });
            if (authProviderForSpecialContext) {
                // the `host` param will be used by the authenticator to delegate to the auth provider
                req.query.host = authProviderForSpecialContext.host;

                log.debug({ sessionId: req.sessionID }, `Using "${authProviderForSpecialContext.type}" for login ...`, {
                    "login-flow": true,
                    query: req.query,
                    authProviderForSpecialContext,
                });
                return;
            }
        }

        // Use the single available auth provider
        const authProvidersOnDashboard = authProviderConfigs
            .filter((c) => !c.hiddenOnDashboard && !c.disallowLogin)
            .map((a) => a.host);
        if (authProvidersOnDashboard.length === 1) {
            req.query.host = authProvidersOnDashboard[0];
            return;
        }

        // If the context URL contains a known auth host, just use this
        if (returnToURL) {
            // returnToURL -> https://gitpod.io/#https://github.com/theia-ide/theia"
            const hash = decodeURIComponent(new URL(decodeURIComponent(returnToURL)).hash);
            const value = hash.substr(1); // to remove the leading #
            let contextUrlHost: string | undefined;
            try {
                const contextURL = new URL(value);
                contextUrlHost = contextURL.hostname;
            } catch {
                // ignore parse errors
            }

            if (!!contextUrlHost && authProvidersOnDashboard.find((a) => a === contextUrlHost)) {
                req.query.host = contextUrlHost;
                log.debug({ sessionId: req.sessionID }, "Guessed auth provider from returnTo URL: " + contextUrlHost, {
                    "login-flow": true,
                    query: req.query,
                });
                return;
            }
        }
    }

    protected ensureSafeReturnToParam(req: express.Request) {
        req.query.returnTo = this.getSafeReturnToParam(req);
    }

    protected urlStartsWith(url: string, prefixUrl: string): boolean {
        prefixUrl += prefixUrl.endsWith("/") ? "" : "/";
        return url.toLowerCase().startsWith(prefixUrl.toLowerCase());
    }

    protected getSafeReturnToParam(req: express.Request) {
        // @ts-ignore Type 'ParsedQs' is not assignable
        const returnToURL: string | undefined = req.query.redirect || req.query.returnTo;
        if (!returnToURL) {
            log.debug({ sessionId: req.sessionID }, "Empty redirect URL");
            return;
        }

        if (
            this.urlStartsWith(returnToURL, this.config.hostUrl.toString()) ||
            this.urlStartsWith(returnToURL, "https://www.gitpod.io")
        ) {
            return returnToURL;
        }

        log.debug({ sessionId: req.sessionID }, "The redirect URL does not match", { query: req.query });
        return;
    }

    private createGitpodServer(user: User, resourceGuard: ResourceAccessGuard) {
        const server = this.serverFactory();
        server.initialize(undefined, user, resourceGuard, ClientMetadata.from(user.id), undefined, {});
        return server;
    }
}
