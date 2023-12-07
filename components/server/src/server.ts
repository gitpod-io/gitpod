/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as http from "http";
import express from "express";
import WebSocket from "ws";
import * as bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { injectable, inject } from "inversify";
import * as prom from "prom-client";
import { SessionHandler } from "./session-handler";
import { Authenticator } from "./auth/authenticator";
import { UserController } from "./user/user-controller";
import { EventEmitter } from "events";
import { createWebSocketConnection, toIWebSocket } from "@gitpod/gitpod-protocol/lib/messaging/node/connection";
import { WsExpressHandler, WsRequestHandler } from "./express/ws-handler";
import { isAllowedWebsocketDomain, bottomErrorHandler, unhandledToError, toHeaders } from "./express-util";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AddressInfo } from "net";
import { WorkspaceDownloadService } from "./workspace/workspace-download-service";
import { MonitoringEndpointsApp } from "./monitoring-endpoints";
import { WebsocketConnectionManager } from "./websocket/websocket-connection-manager";
import { TypeORM } from "@gitpod/gitpod-db/lib";
import { OneTimeSecretServer } from "./one-time-secret-server";
import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol";
import { BearerAuth, isBearerAuthError } from "./auth/bearer-authenticator";
import { HostContextProvider } from "./auth/host-context-provider";
import { CodeSyncService } from "./code-sync/code-sync-service";
import { increaseHttpRequestCounter, observeHttpRequestDuration, setGitpodVersion } from "./prometheus-metrics";
import { OAuthController } from "./oauth-server/oauth-controller";
import { HeadlessLogController } from "./workspace/headless-log-controller";
import { NewsletterSubscriptionController } from "./user/newsletter-subscription-controller";
import { Config } from "./config";
import { DebugApp } from "@gitpod/gitpod-protocol/lib/util/debug-app";
import { WsConnectionHandler } from "./express/ws-connection-handler";
import { LivenessController } from "./liveness/liveness-controller";
import { IamSessionApp } from "./iam/iam-session-app";
import { API } from "./api/server";
import { GithubApp } from "./prebuilds/github-app";
import { GitLabApp } from "./prebuilds/gitlab-app";
import { BitbucketApp } from "./prebuilds/bitbucket-app";
import { BitbucketServerApp } from "./prebuilds/bitbucket-server-app";
import { GitHubEnterpriseApp } from "./prebuilds/github-enterprise-app";
import { JobRunner } from "./jobs/runner";
import { RedisSubscriber } from "./messaging/redis-subscriber";
import { HEADLESS_LOGS_PATH_PREFIX, HEADLESS_LOG_DOWNLOAD_PATH_PREFIX } from "./workspace/headless-log-service";
import { runWithRequestContext } from "./util/request-context";

@injectable()
export class Server {
    static readonly EVENT_ON_START = "start";

    protected iamSessionApp?: express.Application;
    protected iamSessionAppServer?: http.Server;

    protected publicApiServer?: http.Server;
    protected privateApiServer?: http.Server;

    protected readonly eventEmitter = new EventEmitter();
    protected app?: express.Application;
    protected httpServer?: http.Server;
    protected monitoringApp?: express.Application;
    protected monitoringHttpServer?: http.Server;
    protected disposables = new DisposableCollection();

    constructor(
        @inject(Config) private readonly config: Config,
        @inject(TypeORM) private readonly typeOrm: TypeORM,
        @inject(SessionHandler) private readonly sessionHandler: SessionHandler,
        @inject(Authenticator) private readonly authenticator: Authenticator,
        @inject(UserController) private readonly userController: UserController,
        @inject(WebsocketConnectionManager) private readonly websocketConnectionHandler: WebsocketConnectionManager,
        @inject(WorkspaceDownloadService) private readonly workspaceDownloadService: WorkspaceDownloadService,
        @inject(LivenessController) private readonly livenessController: LivenessController,
        @inject(MonitoringEndpointsApp) private readonly monitoringEndpointsApp: MonitoringEndpointsApp,
        @inject(CodeSyncService) private readonly codeSyncService: CodeSyncService,
        @inject(HeadlessLogController) private readonly headlessLogController: HeadlessLogController,
        @inject(DebugApp) private readonly debugApp: DebugApp,
        @inject(GithubApp) private readonly githubApp: GithubApp,
        @inject(GitLabApp) private readonly gitLabApp: GitLabApp,
        @inject(BitbucketApp) private readonly bitbucketApp: BitbucketApp,
        @inject(BitbucketServerApp) private readonly bitbucketServerApp: BitbucketServerApp,
        @inject(GitHubEnterpriseApp) private readonly gitHubEnterpriseApp: GitHubEnterpriseApp,
        @inject(JobRunner) private readonly jobRunner: JobRunner,
        @inject(OneTimeSecretServer) private readonly oneTimeSecretServer: OneTimeSecretServer,
        @inject(BearerAuth) private readonly bearerAuth: BearerAuth,
        @inject(HostContextProvider) private readonly hostCtxProvider: HostContextProvider,
        @inject(OAuthController) private readonly oauthController: OAuthController,
        @inject(NewsletterSubscriptionController)
        private readonly newsletterSubscriptionController: NewsletterSubscriptionController,
        @inject(IamSessionApp) private readonly iamSessionAppCreator: IamSessionApp,
        @inject(API) private readonly api: API,
        @inject(RedisSubscriber) private readonly redisSubscriber: RedisSubscriber,
    ) {}

    public async init(app: express.Application) {
        log.setVersion(this.config.version);
        log.info("server initializing...");

        // Set version info metric
        setGitpodVersion(this.config.version);

        // ensure DB connection is established to avoid noisy error messages
        await this.typeOrm.connect();
        log.info("connected to DB");

        // metrics
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const startTime = Date.now();
            req.on("end", () => {
                const method = req.method;
                const route = String(req.route?.path || req.baseUrl || "unknown");
                observeHttpRequestDuration(method, route, res.statusCode, (Date.now() - startTime) / 1000);
                increaseHttpRequestCounter(method, route, res.statusCode);
            });

            return next();
        });

        // Express configuration
        // Read bodies as JSON (but keep the raw body just in case)
        app.use(
            bodyParser.json({
                verify: (req, res, buffer) => {
                    (req as any).rawBody = buffer;
                },
            }),
        );
        app.use(bodyParser.urlencoded({ extended: true }));
        // Add cookie Parser
        app.use(cookieParser());
        app.set("trust proxy", 1); // trust first proxy

        // Install Sessionhandler
        app.use(this.sessionHandler.http());

        // Install passport
        await this.authenticator.init(app);

        // Use RequestContext for authorization
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const abortController = new AbortController();
            req.on("abort", () => abortController.abort());
            runWithRequestContext(
                {
                    requestKind: "http",
                    requestMethod: req.path,
                    signal: abortController.signal,
                    subjectId: undefined, // Don't use req.user, as that would elevate permissions once we rollout scope-based API tokens
                    headers: toHeaders(req.headers),
                },
                () => next(),
            );
        });

        // Ensure that host contexts of dynamic auth providers are initialized.
        await this.hostCtxProvider.init();

        // Websocket for client connection
        const websocketConnectionHandler = this.websocketConnectionHandler;
        this.eventEmitter.on(Server.EVENT_ON_START, (httpServer) => {
            // CSRF protection: check "Origin" header:
            //  - for cookie/session AND Bearer auth: MUST be hostUrl.hostname (gitpod.io)
            //  - edge case: empty "Origin" is always permitted
            // We rely on the origin header being set correctly (needed by regular clients to use Gitpod:
            // CORS allows subdomains to access gitpod.io)
            const verifyOrigin = (origin: string) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                let allowedRequest = isAllowedWebsocketDomain(origin, this.config.hostUrl.url.hostname);
                if (!allowedRequest && this.config.insecureNoDomain) {
                    log.warn("Websocket connection CSRF guard disabled");
                    allowedRequest = true;
                }
                return allowedRequest;
            };

            /**
             * Verify the web socket handshake request.
             */
            const verifyClient: WebSocket.VerifyClientCallbackAsync = async (info, callback) => {
                let authenticatedUsingBearerToken = false;
                if (info.req.url === "/v1") {
                    // Connection attempt with Bearer-Token: be less strict for now
                    if (!verifyOrigin(info.origin)) {
                        log.debug("Websocket connection attempt with non-matching Origin header.", {
                            origin: info.origin,
                        });
                        return callback(false, 403);
                    }

                    try {
                        await this.bearerAuth.authExpressRequest(info.req as express.Request);
                        authenticatedUsingBearerToken = true;
                    } catch (e) {
                        if (isBearerAuthError(e)) {
                            return callback(false, 401, e.message);
                        }
                        log.warn("authentication failed: ", e);
                        return callback(false, 500);
                    }
                    // intentional fall-through to cookie/session based authentication
                }

                if (!authenticatedUsingBearerToken) {
                    // Connection attempt with cookie/session based authentication: be strict about where we accept connections from!
                    if (!verifyOrigin(info.origin)) {
                        log.debug("Websocket connection attempt with non-matching Origin header: " + info.origin);
                        return callback(false, 403);
                    }
                }

                return callback(true);
            };

            // Materialize user into req.user
            const initSessionHandlers = this.authenticator.initHandlers.map<WsRequestHandler>(
                (handler) => (ws, req, next) => {
                    // The fake response needs to be create in a per-request context to avoid memory leaks
                    handler(req, {} as express.Response, next);
                },
            );

            const wsPingPongHandler = new WsConnectionHandler();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const wsHandler = new WsExpressHandler(httpServer, verifyClient);
            this.disposables.push(wsHandler);
            wsHandler.ws(
                websocketConnectionHandler.path,
                (ws, request) => {
                    const websocket = toIWebSocket(ws);
                    (request as any).wsConnection = createWebSocketConnection(websocket, console);
                },
                this.sessionHandler.websocket(),
                ...initSessionHandlers,
                wsPingPongHandler.handler(),
                (ws: WebSocket, req: express.Request) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    websocketConnectionHandler.onConnection((req as any).wsConnection, req);
                },
            );
            wsHandler.ws(
                "/v1",
                (ws, request) => {
                    const websocket = toIWebSocket(ws);
                    (request as any).wsConnection = createWebSocketConnection(websocket, console);
                },
                wsPingPongHandler.handler(),
                (ws: WebSocket, req: express.Request) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    websocketConnectionHandler.onConnection((req as any).wsConnection, req);
                },
            );
            wsHandler.ws(/.*/, (ws, request) => {
                // fallthrough case
                // note: this is suboptimal as we upgrade and than terminate the request. But we're not sure this is a problem at all, so we start out with this
                log.warn("websocket path not matching", { path: request.path });
                ws.terminate();
            });

            // start ws heartbeat/ping-pong
            wsPingPongHandler.start();
            this.disposables.push(wsPingPongHandler);
        });

        // register routers
        await this.registerRoutes(app);

        // Turn unhandled requests into errors
        app.use(unhandledToError);

        // Generic error handler
        app.use(bottomErrorHandler(log.debug));

        // Health check + metrics endpoints
        this.monitoringApp = this.monitoringEndpointsApp.create();

        // IAM Session App - host separately to avoid exposing publicly
        this.iamSessionApp = this.iamSessionAppCreator.create();

        // Report current websocket connections
        this.installWebsocketConnectionGauge();
        this.installWebsocketClientContextGauge();

        await this.redisSubscriber.start();
        this.disposables.push(Disposable.create(() => this.redisSubscriber.stop().catch(log.error)));

        // Start periodic jobs
        this.disposables.push(this.jobRunner.start());

        this.app = app;

        log.info("server initialized.");
    }

    protected async registerRoutes(app: express.Application) {
        // Authorization: Session only
        app.use(this.userController.apiRouter);
        app.use("/workspace-download", this.workspaceDownloadService.apiRouter);
        app.use(this.oauthController.oauthRouter);

        // Authorization: Session or Bearer token
        app.use(HEADLESS_LOGS_PATH_PREFIX, this.headlessLogController.headlessLogs);
        app.use(HEADLESS_LOG_DOWNLOAD_PATH_PREFIX, this.headlessLogController.headlessLogDownload);

        // Authorization: Bearer token only
        app.use("/code-sync", this.codeSyncService.apiRouter);

        // Authorization: none
        app.use(this.oneTimeSecretServer.apiRouter);
        app.use(this.newsletterSubscriptionController.apiRouter);
        app.use("/live", this.livenessController.apiRouter);
        app.use("/version", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.send(this.config.version);
        });

        // Authorization: Custom
        if (this.config.githubApp?.enabled && this.githubApp.server) {
            log.info("Registered GitHub app at /apps/github");
            app.use("/apps/github/", this.githubApp.server?.expressApp);
            log.debug(`GitHub app ready under ${this.githubApp.server.expressApp.path()}`);
        } else {
            log.info("GitHub app disabled");
        }

        log.info("Registered GitLab app at " + GitLabApp.path);
        app.use(GitLabApp.path, this.gitLabApp.router);

        log.info("Registered Bitbucket app at " + BitbucketApp.path);
        app.use(BitbucketApp.path, this.bitbucketApp.router);

        log.info("Registered GitHub EnterpriseApp app at " + GitHubEnterpriseApp.path);
        app.use(GitHubEnterpriseApp.path, this.gitHubEnterpriseApp.router);

        log.info("Registered Bitbucket Server app at " + BitbucketServerApp.path);
        app.use(BitbucketServerApp.path, this.bitbucketServerApp.router);
    }

    public async start(port: number) {
        if (!this.app) {
            throw new Error("server cannot start, not initialized");
        }

        const httpServer = this.app.listen(port, () => {
            this.eventEmitter.emit(Server.EVENT_ON_START, httpServer);
            log.info(`server listening on port: ${(<AddressInfo>httpServer.address()).port}`);
        });
        this.httpServer = httpServer;

        if (this.monitoringApp) {
            this.monitoringHttpServer = this.monitoringApp.listen(9500, "localhost", () => {
                log.info(
                    `monitoring app listening on port: ${(<AddressInfo>this.monitoringHttpServer!.address()).port}`,
                );
            });
        }

        if (this.iamSessionApp) {
            this.iamSessionAppServer = this.iamSessionApp.listen(9876, () => {
                log.info(
                    `IAM session server listening on port: ${(<AddressInfo>this.iamSessionAppServer!.address()).port}`,
                );
            });
        }

        this.publicApiServer = this.api.listen();
        this.privateApiServer = this.api.listenPrivate();

        this.debugApp.start();
    }

    public async stop() {
        // run each stop with a timeout of 30s
        async function race(workLoad: Promise<any>, task: string, ms: number = 30 * 1000): Promise<void> {
            const before = Date.now();
            let timedOut = false;
            const timeout = new Promise<void>((resolve) =>
                setTimeout(() => {
                    timedOut = true;
                    resolve();
                }, ms),
            );
            await Promise.race([workLoad.catch((e) => log.error("error running " + task, e)), timeout]).then(() => {
                const duration = Date.now() - before;
                if (timedOut) {
                    log.error(`task ${task} timed out after ${duration}ms`);
                } else {
                    log.info(`task ${task} took ${duration}ms`);
                }
            });
        }
        await Promise.all([
            race(this.debugApp.stop(), "debugapp"),
            race(this.stopServer(this.iamSessionAppServer), "stop iamsessionapp"),
            race(this.stopServer(this.monitoringHttpServer), "stop monitoringapp"),
            race(this.stopServer(this.httpServer), "stop httpserver"),
            race(this.stopServer(this.privateApiServer), "stop private api server"),
            race(this.stopServer(this.publicApiServer), "stop public api server"),
            race((async () => this.disposables.dispose())(), "dispose disposables"),
        ]);

        log.info("server stopped.");
    }

    protected async stopServer(server?: http.Server): Promise<void> {
        if (!server) {
            return;
        }
        return new Promise((resolve) =>
            server.close((err: any) => {
                if (err) {
                    log.warn(`error on server close.`, { err });
                }
                resolve();
            }),
        );
    }

    protected installWebsocketConnectionGauge() {
        const gauge = new prom.Gauge({
            name: `server_websocket_connection_count`,
            help: "Currently served websocket connections",
            labelNames: ["clientType"],
        });
        this.websocketConnectionHandler.onConnectionCreated((s, _) =>
            gauge.inc({ clientType: s.clientMetadata.type || "undefined" }),
        );
        this.websocketConnectionHandler.onConnectionClosed((s, _) =>
            gauge.dec({ clientType: s.clientMetadata.type || "undefined" }),
        );
    }

    protected installWebsocketClientContextGauge() {
        const gauge = new prom.Gauge({
            name: `server_websocket_client_context_count`,
            help: "Currently served client contexts",
            labelNames: ["authLevel"],
        });
        this.websocketConnectionHandler.onClientContextCreated((ctx) =>
            gauge.inc({ authLevel: ctx.clientMetadata.authLevel }),
        );
        this.websocketConnectionHandler.onClientContextClosed((ctx) =>
            gauge.dec({ authLevel: ctx.clientMetadata.authLevel }),
        );
    }
}
