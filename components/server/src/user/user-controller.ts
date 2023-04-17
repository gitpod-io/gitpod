/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import { inject, injectable } from "inversify";
import { UserDB, DBUser, WorkspaceDB, OneTimeSecretDB } from "@gitpod/gitpod-db/lib";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "@gitpod/gitpod-db/lib/user-db";
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
import { LoginCompletionHandler } from "../auth/login-completion-handler";
import { TosCookie } from "./tos-cookie";
import { increaseLoginCounter } from "../prometheus-metrics";
import { OwnerResourceGuard, ResourceAccessGuard, ScopedResourceGuard } from "../auth/resource-access";
import { OneTimeSecretServer } from "../one-time-secret-server";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { EnforcementControllerServerFactory } from "./enforcement-endpoint";
import { ClientMetadata } from "../websocket/websocket-connection-manager";
import { ResponseError } from "vscode-jsonrpc";
import { VerificationService } from "../auth/verification-service";
import * as fs from "fs/promises";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

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

        const loginUserWithOts = (
            verifyAndHandle: (req: express.Request, res: express.Response, user: User, secret: string) => Promise<void>,
            _userId?: string,
        ) => {
            return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                const sessionId = req.sessionID;
                let userId = _userId || req.params.userId;
                try {
                    log.debug({ sessionId, userId }, "OTS based login started.");
                    const secret = await this.otsDb.get(req.params.key);
                    if (!secret) {
                        throw new ResponseError(401, "Invalid OTS key");
                    }

                    const user = await this.userDb.findUserById(userId);
                    if (!user) {
                        throw new ResponseError(404, "User not found");
                    }

                    await verifyAndHandle(req, res, user, secret);

                    log.debug({ sessionId, userId }, "OTS based login successful.");
                } catch (err) {
                    let code = 500;
                    if (err.code !== undefined) {
                        code = err.code;
                    }
                    res.sendStatus(code);
                    log.error({ sessionId, userId }, "OTS based login failed", err, { code });
                }
            };
        };

        // Admin user is logging-in with a one-time-token.
        router.get("/login/ots/admin/:token", async (req: express.Request, res: express.Response) => {
            // For the login to be succesful, we expect to receive a token which we need to validate against
            // pre-created credentials.
            // The credentials are provided as a file into the system, and can be updated while our system is running.
            // We must validate the following:
            //  * hash(token) matches the pre-created credentials
            //  * now() is not greater than the pre-created credentials expiry
            // If valid, we log the user-in as the "admin" user - a singleton identity which exists on the installation.

            try {
                const token = req.params.token;
                if (!token) {
                    throw new ResponseError(ErrorCodes.BAD_REQUEST, "missing token");
                }
                const credentials = await this.readAdminCredentials();
                credentials.validate(token);

                // The user has supplied a valid token, we need to sign them in.
                // Login this user (sets cookie as side-effect)
                const user = await this.userDb.findUserById(BUILTIN_INSTLLATION_ADMIN_USER_ID);
                if (!user) {
                    // We respond with NOT_AUTHENTICATED to prevent gleaning whether the user, or token are invalid.
                    throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Admin user not found");
                }
                await new Promise<void>((resolve, reject) => {
                    req.login(user, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });

                // Redirect the user to create a new Organization
                // We'll want to be more specific about the redirect based on the cell information in the future.
                res.redirect("/orgs/new", 307);
            } catch (e) {
                log.error("Failed to sign-in as admin with OTS Token", e);

                // Default to unathenticated, to not leak information.
                // We do not send the error response to ensure we do not disclose information.
                const code = e.code || 401;
                res.sendStatus(code);
                return;
            }
        });

        router.get(
            "/login/ots/:userId/:key",
            loginUserWithOts(async (req: express.Request, res: express.Response, user: User, secret: string) => {
                // This mechanism is used by integration tests, cmp. https://github.com/gitpod-io/gitpod/blob/478a75e744a642d9b764de37cfae655bc8b29dd5/test/tests/ide/vscode/python_ws_test.go#L105
                const secretHash = crypto
                    .createHash("sha256")
                    .update(user.id + this.config.session.secret)
                    .digest("hex");
                if (secretHash !== secret) {
                    throw new ResponseError(401, "OTS secret not verified");
                }

                // mimick the shape of a successful login
                (req.session! as any).passport = { user: user.id };

                // Save session to DB
                await new Promise<void>((resolve, reject) =>
                    req.session!.save((err) => (err ? reject(err) : resolve())),
                );

                res.sendStatus(200);
            }),
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
                    // There is no token to answer with, so we sent a 404. The client has to properly handle this case with retries/timeouts, etc.
                    res.sendStatus(404);
                    log.warn("attempted to fetch workspace cookie, but instance has no owner token", {
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

                    res.redirect(`http://${rt}/?ots=${encodeURI(ots.url)}`);
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
        router.get(
            "/auth/frontend-dev",
            async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                if (!req.isAuthenticated() || !User.is(req.user)) {
                    res.sendStatus(401);
                    return;
                }

                const user = req.user as User;
                if (this.authService.hasPermission(user, Permission.DEVELOPER)) {
                    res.sendStatus(200);
                    return;
                }

                res.sendStatus(401);
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

        return router;
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

    private async readAdminCredentials(): Promise<AdminCredentials> {
        const credentialsFilePath = this.config.admin.credentialsPath;

        // Credentials do not have to be present in the system, if admin level sing-in is entirely disabled.
        if (!credentialsFilePath) {
            throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "No admin credentials");
        }

        const contents = await fs.readFile(credentialsFilePath, { encoding: "utf8" });
        const payload = await JSON.parse(contents);

        const err = new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Invalid admin credentials.");

        if (!payload.expiresAt) {
            log.error("Admin credentials file does not contain expiry timestamp.");
            throw err;
        }
        if (!payload.tokenHash) {
            log.error("Admin credentials file does not contain tokenHash.");
            throw err;
        }
        if (!payload.algo || payload.algo !== "sha512") {
            log.error(`Admin credentials file contains invalid hash algorithm. got: ${payload.algo}`);
            throw err;
        }

        return new AdminCredentials(payload.tokenHash, payload.expiresAt, payload.algo);
    }
}

class AdminCredentials {
    // We expect to receive the hex digest of the hash
    protected hash: string;
    protected algo: "sha512";

    protected expiresAt: number;

    constructor(hash: string, expires: number, algo: "sha512") {
        this.hash = hash;
        this.expiresAt = expires;
        this.algo = algo;
    }

    validate(token: string) {
        const suppliedTokenHash = crypto.createHash(this.algo).update(token).digest("hex");

        const nowInSeconds = new Date().getTime() / 1000;
        if (nowInSeconds >= this.expiresAt) {
            log.error("Admin credentials are expired.");
            throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "invalid token");
        }

        const tokensMatch = crypto.timingSafeEqual(
            Buffer.from(suppliedTokenHash, "utf8"),
            Buffer.from(this.hash, "utf8"),
        );

        if (!tokensMatch) {
            throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "invalid token");
        }
    }
}
