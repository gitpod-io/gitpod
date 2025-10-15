/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import { inject, injectable } from "inversify";
import { OneTimeSecretDB, TeamDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "@gitpod/gitpod-db/lib/user-db";
import express from "express";
import { Authenticator } from "../auth/authenticator";
import { Config } from "../config";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthorizationService } from "./authorization-service";
import { Permission } from "@gitpod/gitpod-protocol/lib/permission";
import { parseWorkspaceIdFromHostname } from "@gitpod/gitpod-protocol/lib/util/parse-workspace-id";
import { SessionHandler } from "../session-handler";
import { URL } from "url";
import {
    getRequestingClientInfo,
    validateAuthorizeReturnToUrl,
    validateLoginReturnToUrl,
    safeFragmentRedirect,
    getSafeReturnToParam,
} from "../express-util";
import { GitpodToken, GitpodTokenType, User } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { reportJWTCookieIssued } from "../prometheus-metrics";
import {
    FGAResourceAccessGuard,
    OwnerResourceGuard,
    ResourceAccessGuard,
    ScopedResourceGuard,
} from "../auth/resource-access";
import { OneTimeSecretServer } from "../one-time-secret-server";
import { ClientMetadata } from "../websocket/websocket-connection-manager";
import * as fs from "fs/promises";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { GitpodServerImpl } from "../workspace/gitpod-server-impl";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { UserService } from "./user-service";
import { WorkspaceService } from "../workspace/workspace-service";
import { runWithSubjectId } from "../util/request-context";
import { SubjectId } from "../auth/subject-id";
import { isUserLoginBlockedBySunset } from "../util/featureflags";

export const ServerFactory = Symbol("ServerFactory");
export type ServerFactory = () => GitpodServerImpl;

@injectable()
export class UserController {
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;
    @inject(UserService) protected readonly userService: UserService;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(Authenticator) protected readonly authenticator: Authenticator;
    @inject(Config) protected readonly config: Config;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(SessionHandler) protected readonly sessionHandler: SessionHandler;
    @inject(OneTimeSecretServer) protected readonly otsServer: OneTimeSecretServer;
    @inject(OneTimeSecretDB) protected readonly otsDb: OneTimeSecretDB;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(ServerFactory) private readonly serverFactory: ServerFactory;

    get apiRouter(): express.Router {
        const router = express.Router();

        router.get("/login", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (req.isAuthenticated()) {
                log.info("(Auth) User is already authenticated.", { "login-flow": true });

                // Check if authenticated user is blocked by sunset
                const user = req.user as User;
                if (await isUserLoginBlockedBySunset(user, this.config.isDedicatedInstallation)) {
                    log.info("(Auth) User blocked by Classic PAYG sunset", {
                        userId: user.id,
                        organizationId: user.organizationId,
                        "login-flow": true,
                    });
                    res.redirect(302, "https://app.ona.com/login");
                    return;
                }

                // redirect immediately
                const redirectTo = this.ensureSafeReturnToParam(req) || this.config.hostUrl.asDashboard().toString();
                safeFragmentRedirect(res, redirectTo);
                return;
            }
            const clientInfo = getRequestingClientInfo(req);
            log.info("(Auth) User started the login process", {
                "login-flow": true,
                clientInfo,
            });

            // Try to guess auth host from request
            await this.augmentLoginRequest(req);

            // If there is no known auth host, we need to ask the user
            const redirectToLoginPage = !req.query.host;
            if (redirectToLoginPage) {
                const returnTo = this.ensureSafeReturnToParam(req);
                const search = returnTo ? `returnTo=${returnTo}` : "";
                const loginPageUrl = this.config.hostUrl.asLogin().with({ search }).toString();
                log.info(`Redirecting to login ${loginPageUrl}`);
                safeFragmentRedirect(res, loginPageUrl);
                return;
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
                const userId = _userId || req.params.userId;
                try {
                    log.debug({ userId }, "OTS based login started.");
                    const secret = await this.otsDb.get(req.params.key);
                    if (!secret) {
                        throw new ApplicationError(401, "Invalid OTS key");
                    }

                    const user = await runWithSubjectId(SubjectId.fromUserId(userId), () =>
                        this.userService.findUserById(userId, userId),
                    );
                    if (!user) {
                        throw new ApplicationError(404, "User not found");
                    }

                    await verifyAndHandle(req, res, user, secret);

                    log.debug({ userId }, "OTS based login successful.");
                } catch (err) {
                    let code = 500;
                    if (err.code !== undefined) {
                        code = err.code;
                    }
                    res.sendStatus(code);
                    log.error({ userId }, "OTS based login failed", err, { code });
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
                    throw new ApplicationError(ErrorCodes.BAD_REQUEST, "missing token");
                }
                const credentials = await this.readAdminCredentials();
                credentials.validate(token);

                // The user has supplied a valid token, we need to sign them in.
                // Login this user (sets cookie as side-effect)
                const user = await this.userDb.findUserById(BUILTIN_INSTLLATION_ADMIN_USER_ID);
                if (!user) {
                    // We respond with NOT_AUTHENTICATED to prevent gleaning whether the user, or token are invalid.
                    throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "Admin user not found");
                }

                // Ensure admin user is owner of any Org.
                const { rows: orgs } = await this.teamDb.findTeams(
                    0 /* offset */,
                    1000 /* limit */,
                    "creationTime" /* order by */,
                    "ASC",
                    "" /* empty search term returns any */,
                );
                for (const org of orgs) {
                    await this.teamDb.addMemberToTeam(BUILTIN_INSTLLATION_ADMIN_USER_ID, org.id);
                    await this.teamDb.setTeamMemberRole(BUILTIN_INSTLLATION_ADMIN_USER_ID, org.id, "owner");
                }

                const cookie = await this.sessionHandler.createJWTSessionCookie(user.id);
                res.cookie(cookie.name, cookie.value, cookie.opts);
                reportJWTCookieIssued();

                // Create a session for the admin user.
                await new Promise<void>((resolve, reject) => {
                    req.login(user, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });

                // Redirect the admin-user to the Org Settings page.
                // The dashboard is expected to render the Onboading flow instead of the regular view,
                // but if the browser is reloaded after completion of the flow, it should be fine to see the settings.
                safeFragmentRedirect(res, "/settings", 307);
            } catch (e) {
                log.error("Failed to sign-in as admin with OTS Token", e);

                // Always redirect to an expired token page if there's an error
                safeFragmentRedirect(res, "/error/expired-ots", 307);
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
                    throw new ApplicationError(401, "OTS secret not verified");
                }

                // mimick the shape of a successful login
                req.user = user;

                const cookie = await this.sessionHandler.createJWTSessionCookie(user.id);
                res.cookie(cookie.name, cookie.value, cookie.opts);
                reportJWTCookieIssued();

                // If returnTo was passed and it's safe, redirect to it
                const returnTo = this.ensureSafeReturnToParam(req);
                if (returnTo) {
                    log.info(`Redirecting after OTS login ${returnTo}`);
                    safeFragmentRedirect(res, returnTo);
                    return;
                }

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
            this.ensureSafeReturnToParamForAuthorize(req)
                .then(() => {
                    this.authenticator
                        .authorize(req, res, next)
                        .catch((err) => log.error("authenticator.authorize", err));
                })
                .catch((err) => {
                    log.error("authenticator.authorize", err);
                });
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
            this.ensureSafeReturnToParamForAuthorize(req)
                .then(() => {
                    this.authenticator
                        .deauthorize(req, res, next)
                        .catch((err) => log.error("authenticator.deauthorize", err));
                })
                .catch((err) => {
                    log.error("authenticator.deauthorize", err);
                });
        });
        router.get("/logout", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const logContext = LogContext.from({ user: req.user, request: req });
            const clientInfo = getRequestingClientInfo(req);
            const logPayload = { clientInfo };
            log.info(logContext, "(Logout) Logging out.", logPayload);

            // stop all running workspaces
            const user = req.user as User;
            if (user) {
                await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                    this.workspaceService
                        .stopRunningWorkspacesForUser({}, user.id, user.id, "logout", StopWorkspacePolicy.NORMALLY)
                        .catch((error) =>
                            log.error(logContext, "cannot stop workspaces on logout", { error, ...logPayload }),
                        );

                    // reset the FGA state
                    await this.userService.resetFgaVersion(user.id, user.id);
                });
            }

            const redirectToUrl = this.ensureSafeReturnToParam(req) || this.config.hostUrl.toString();

            if (req.isAuthenticated()) {
                req.logout();
            }

            // clear cookies
            this.sessionHandler.clearSessionCookie(res);

            // then redirect
            log.info(logContext, "(Logout) Redirecting...", { redirectToUrl, ...logPayload });
            safeFragmentRedirect(res, redirectToUrl);
        });

        router.get("/auth/jwt-cookie", this.sessionHandler.jwtSessionConvertor());

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

                await runWithSubjectId(SubjectId.fromUserId(user.id), async () => {
                    const resourceGuard = new FGAResourceAccessGuard(user.id, new OwnerResourceGuard(user.id));
                    const server = this.createGitpodServer(user, resourceGuard);
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
                            .catch((err) =>
                                log.warn(logCtx, "workspacePageClose: failed to track ide close signal", err),
                            );
                        res.sendStatus(200);
                    } catch (e) {
                        if (ApplicationError.hasErrorCode(e)) {
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
                });
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
                    const dbToken: GitpodToken = {
                        tokenHash,
                        name: `local-app`,
                        type: GitpodTokenType.MACHINE_AUTH_TOKEN,
                        userId: req.user.id,
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

                    safeFragmentRedirect(res, `http://${rt}/?ots=${encodeURI(ots.url)}`);
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

        return router;
    }

    protected getSorryUrl(message: string) {
        return this.config.hostUrl.asSorry(message).toString();
    }

    protected async augmentLoginRequest(req: express.Request) {
        const returnToURL = this.ensureSafeReturnToParam(req);
        if (req.query.host) {
            // This login request points already to an auth host
            return;
        }

        // read current auth provider configs
        const authProviderConfigs = this.hostContextProvider.getAll().map((hc) => hc.authProvider.params);

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
                log.debug("Guessed auth provider from returnTo URL: " + contextUrlHost, {
                    "login-flow": true,
                    query: req.query,
                });
                return;
            }
        }
    }

    protected ensureSafeReturnToParam(req: express.Request): string | undefined {
        const returnTo = getSafeReturnToParam(req, (url) => validateLoginReturnToUrl(url, this.config.hostUrl));
        req.query.returnTo = returnTo;
        return returnTo;
    }

    protected async ensureSafeReturnToParamForAuthorize(req: express.Request): Promise<string | undefined> {
        let returnTo = getSafeReturnToParam(req);
        if (returnTo) {
            // Always validate returnTo URL against allowlist for authorize API
            if (!validateAuthorizeReturnToUrl(returnTo, this.config.hostUrl)) {
                log.warn(`Invalid returnTo URL rejected for authorize: ${returnTo}`, { "login-flow": true });
                returnTo = undefined;
            }
        }

        req.query.returnTo = returnTo;
        return returnTo;
    }

    private createGitpodServer(user: User, resourceGuard: ResourceAccessGuard) {
        const server = this.serverFactory();
        server.initialize(undefined, user.id, resourceGuard, ClientMetadata.from(user.id), undefined, {});
        return server;
    }

    private async readAdminCredentials(): Promise<AdminCredentials> {
        const credentialsFilePath = this.config.admin.credentialsPath;

        // Credentials do not have to be present in the system, if admin level sign-in is entirely disabled.
        if (!credentialsFilePath) {
            throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "No admin credentials");
        }

        const contents = await fs.readFile(credentialsFilePath, { encoding: "utf8" });
        const payload = await JSON.parse(contents);

        const err = new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "Invalid admin credentials.");

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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
            throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "invalid token");
        }

        const tokensMatch = crypto.timingSafeEqual(
            Buffer.from(suppliedTokenHash, "utf8"),
            Buffer.from(this.hash, "utf8"),
        );

        if (!tokensMatch) {
            throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "invalid token");
        }
    }
}
