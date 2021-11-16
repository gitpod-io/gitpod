/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as http from 'http';
import * as express from 'express';
import * as ws from 'ws';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import { injectable, inject } from 'inversify';
import * as prom from 'prom-client';
import { SessionHandlerProvider } from './session-handler';
import { Authenticator } from './auth/authenticator';
import { UserController } from './user/user-controller';
import { EventEmitter } from 'events';
import { toIWebSocket } from '@gitpod/gitpod-protocol/lib/messaging/node/connection';
import { WsExpressHandler, WsRequestHandler } from './express/ws-handler';
import { pingPong, handleError, isAllowedWebsocketDomain, bottomErrorHandler, unhandledToError } from './express-util';
import { createWebSocketConnection } from 'vscode-ws-jsonrpc/lib';
import { MessageBusIntegration } from './workspace/messagebus-integration';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { EnforcementController } from './user/enforcement-endpoint';
import { AddressInfo } from 'net';
import { URL } from 'url';
import { ConsensusLeaderQorum } from './consensus/consensus-leader-quorum';
import { RabbitMQConsensusLeaderMessenger } from './consensus/rabbitmq-consensus-leader-messenger';
import { WorkspaceGarbageCollector } from './workspace/garbage-collector';
import { WorkspaceDownloadService } from './workspace/workspace-download-service';
import { MonitoringEndpointsApp } from './monitoring-endpoints';
import { WebsocketClientType, WebsocketConnectionManager } from './websocket/websocket-connection-manager';
import { DeletedEntryGC, PeriodicDbDeleter, TypeORM } from '@gitpod/gitpod-db/lib';
import { OneTimeSecretServer } from './one-time-secret-server';
import { Disposable, DisposableCollection, GitpodClient, GitpodServer } from '@gitpod/gitpod-protocol';
import { BearerAuth, isBearerAuthError } from './auth/bearer-authenticator';
import { HostContextProvider } from './auth/host-context-provider';
import { CodeSyncService } from './code-sync/code-sync-service';
import { increaseHttpRequestCounter, observeHttpRequestDuration, setGitpodVersion } from './prometheus-metrics';
import { OAuthController } from './oauth-server/oauth-controller';
import { HeadlessLogController, HEADLESS_LOGS_PATH_PREFIX, HEADLESS_LOG_DOWNLOAD_PATH_PREFIX } from './workspace/headless-log-controller';
import { NewsletterSubscriptionController } from './user/newsletter-subscription-controller';
import { Config } from './config';
import { DebugApp } from './debug-app';
import { LocalMessageBroker } from './messaging/local-message-broker';

@injectable()
export class Server<C extends GitpodClient, S extends GitpodServer> {
    static readonly EVENT_ON_START = 'start';

    @inject(Config) protected readonly config: Config;
    @inject(TypeORM) protected readonly typeOrm: TypeORM;
    @inject(SessionHandlerProvider) protected sessionHandlerProvider: SessionHandlerProvider;
    @inject(Authenticator) protected authenticator: Authenticator;
    @inject(UserController) protected readonly userController: UserController;
    @inject(EnforcementController) protected readonly enforcementController: EnforcementController;
    @inject(WebsocketConnectionManager) protected websocketConnectionHandler: WebsocketConnectionManager<C, S>;
    @inject(MessageBusIntegration) protected readonly messagebus: MessageBusIntegration;
    @inject(LocalMessageBroker) protected readonly localMessageBroker: LocalMessageBroker;
    @inject(WorkspaceDownloadService) protected readonly workspaceDownloadService: WorkspaceDownloadService;
    @inject(MonitoringEndpointsApp) protected readonly monitoringEndpointsApp: MonitoringEndpointsApp;
    @inject(CodeSyncService) private readonly codeSyncService: CodeSyncService;
    @inject(HeadlessLogController) protected readonly headlessLogController: HeadlessLogController;
    @inject(DebugApp) protected readonly debugApp: DebugApp;

    @inject(RabbitMQConsensusLeaderMessenger) protected readonly consensusMessenger: RabbitMQConsensusLeaderMessenger;
    @inject(ConsensusLeaderQorum) protected readonly qorum: ConsensusLeaderQorum;
    @inject(WorkspaceGarbageCollector) protected readonly workspaceGC: WorkspaceGarbageCollector;
    @inject(DeletedEntryGC) protected readonly deletedEntryGC: DeletedEntryGC;
    @inject(OneTimeSecretServer) protected readonly oneTimeSecretServer: OneTimeSecretServer;

    @inject(PeriodicDbDeleter) protected readonly periodicDbDeleter: PeriodicDbDeleter;

    @inject(BearerAuth) protected readonly bearerAuth: BearerAuth;

    @inject(HostContextProvider) protected readonly hostCtxProvider: HostContextProvider;
    @inject(OAuthController) protected readonly oauthController: OAuthController;
    @inject(NewsletterSubscriptionController) protected readonly newsletterSubscriptionController: NewsletterSubscriptionController;

    protected readonly eventEmitter = new EventEmitter();
    protected app?: express.Application;
    protected httpServer?: http.Server;
    protected monitoringApp?: express.Application;
    protected monitoringHttpServer?: http.Server;
    protected disposables = new DisposableCollection();

    public async init(app: express.Application) {
        log.setVersion(this.config.version);
        log.info('server initializing...');

        // print config
        log.info("config", { config: JSON.stringify(this.config, undefined, 2) });

        // Set version info metric
        setGitpodVersion(this.config.version)

        // ensure DB connection is established to avoid noisy error messages
        await this.typeOrm.connect();
        log.info("connected to DB");

        // metrics
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const startTime = Date.now();
            req.on("end", () =>{
                const method = req.method;
                const route = req.route?.path || req.baseUrl || "unknown";
                observeHttpRequestDuration(method, route, res.statusCode, (Date.now() - startTime) / 1000)
                increaseHttpRequestCounter(method, route, res.statusCode);
            });

            return next();
        });

        // Express configuration
        // Read bodies as JSON
        app.use(bodyParser.json())
        app.use(bodyParser.urlencoded({ extended: true }))
        // Add cookie Parser
        app.use(cookieParser());
        app.set('trust proxy', 1)   // trust first proxy

        // Install Sessionhandler
        app.use(this.sessionHandlerProvider.sessionHandler);

        // Install passport
        await this.authenticator.init(app);

        // Ensure that host contexts of dynamic auth providers are initialized.
        await this.hostCtxProvider.init();

        // Websocket for client connection
        const websocketConnectionHandler = this.websocketConnectionHandler;
        this.eventEmitter.on(Server.EVENT_ON_START, (httpServer) => {
            // CSRF protection: check "Origin" header, it must be either:
            //  - gitpod.io (hostUrl.hostname) or
            //  - a workspace location (ending of hostUrl.hostname)
            // We rely on the origin header being set correctly (needed by regular clients to use Gitpod:
            // CORS allows subdomains to access gitpod.io)
            const verifyCSRF = (origin: string) => {
                let allowedRequest = isAllowedWebsocketDomain(origin, this.config.hostUrl.url.hostname);
                if (this.config.stage === 'prodcopy' || this.config.stage === 'staging') {
                    // On staging and devstaging, we want to allow Theia to be able to connect to the server from this magic port
                    // This enables debugging Theia from inside Gitpod
                    const url = new URL(origin);
                    if (url.hostname.startsWith("13444-")) {
                        allowedRequest = true;
                    }
                }
                if (!allowedRequest && this.config.insecureNoDomain) {
                    log.warn("Websocket connection CSRF guard disabled");
                    allowedRequest = true;
                }
                return allowedRequest;
            }

            /**
             * Verify the web socket handshake request.
             */
            const verifyClient: ws.VerifyClientCallbackAsync = async (info, callback) => {
                if (!verifyCSRF(info.origin)) {
                    log.warn("Websocket connection attempt with non-matching Origin header: " + info.origin)
                    return callback(false, 403);
                }
                if (info.req.url === '/v1') {
                    try {
                        await this.bearerAuth.auth(info.req as express.Request)
                    } catch (e) {
                        if (isBearerAuthError(e)) {
                            return callback(false, 401, e.message);
                        }
                        log.warn("authentication failed: ", e)
                        return callback(false, 500);
                    }
                }
                return callback(true);
            };

            // Materialize session into req.session
            const handleSession: WsRequestHandler = (ws, req, next) => {
                // The fake response needs to be create in a per-request context to avoid memory leaks
                this.sessionHandlerProvider.sessionHandler(req, {} as express.Response, next);
            };

            // Materialize user into req.user
            const initSessionHandlers = this.authenticator.initHandlers.map<WsRequestHandler>(
                handler => (ws, req, next) => {
                    // The fake response needs to be create in a per-request context to avoid memory leaks
                    handler(req, {} as express.Response, next);
                }
            );

            const wsHandler = new WsExpressHandler(httpServer, verifyClient);
            wsHandler.ws(websocketConnectionHandler.path, (ws, request) => {
                const websocket = toIWebSocket(ws);
                (request as any).wsConnection = createWebSocketConnection(websocket, console);
            }, handleSession, ...initSessionHandlers, handleError, pingPong, (ws: ws, req: express.Request) => {
                websocketConnectionHandler.onConnection((req as any).wsConnection, req);
            });
            wsHandler.ws("/v1", (ws, request) => {
                const websocket = toIWebSocket(ws);
                (request as any).wsConnection = createWebSocketConnection(websocket, console);
            }, handleError, pingPong, (ws: ws, req: express.Request) => {
                websocketConnectionHandler.onConnection((req as any).wsConnection, req);
            });
        })

        // register routers
        await this.registerRoutes(app);

        // Turn unhandled requests into errors
        app.use(unhandledToError);

        // Generic error handler
        app.use(bottomErrorHandler(log.debug));


        // Health check + metrics endpoints
        this.monitoringApp = this.monitoringEndpointsApp.create();

        // Report current websocket connections
        this.installWebsocketConnectionGauge();
        this.installWebsocketClientContextGauge();

        // Connect to message bus
        await this.messagebus.connect();

        // Start local message broker
        await this.localMessageBroker.start();
        this.disposables.push(Disposable.create(() => this.localMessageBroker.stop().catch(log.error)));

        // Start concensus quorum
        await this.consensusMessenger.connect();
        await this.qorum.start();

        // Start workspace garbage collector
        this.workspaceGC.start().catch((err) => log.error("wsgc: error during startup", err));

        // Start deleted entry GC
        this.deletedEntryGC.start();

        // Start one-time secret GC
        this.oneTimeSecretServer.startPruningExpiredSecrets();

        // Start DB updater
        this.startDbDeleter();

        this.app = app;
        log.info('server initialized.');
    }

    protected async startDbDeleter() {
        if (!this.config.runDbDeleter) {
            return;
        }
        const areWeLeader = await this.qorum.areWeLeader();
        if (areWeLeader) {
            this.periodicDbDeleter.start();
        }
    }

    protected async registerRoutes(app: express.Application) {
        app.use(this.userController.apiRouter);
        app.use(this.oneTimeSecretServer.apiRouter);
        app.use('/enforcement', this.enforcementController.apiRouter);
        app.use('/workspace-download', this.workspaceDownloadService.apiRouter);
        app.use('/code-sync', this.codeSyncService.apiRouter);
        app.use(HEADLESS_LOGS_PATH_PREFIX, this.headlessLogController.headlessLogs);
        app.use(HEADLESS_LOG_DOWNLOAD_PATH_PREFIX, this.headlessLogController.headlessLogDownload);
        app.use(this.newsletterSubscriptionController.apiRouter);
        app.use("/version", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.send(this.config.version);
        });
        app.use(this.oauthController.oauthRouter);
    }

    public async start(port: number) {
        if (!this.app) {
            throw new Error("server cannot start, not initialized");
        }

        const httpServer = this.app.listen(port, () => {
            this.eventEmitter.emit(Server.EVENT_ON_START, httpServer);
            log.info(`server listening on port: ${(<AddressInfo>httpServer.address()).port}`);
        })
        this.httpServer = httpServer;

        if (this.monitoringApp) {
            this.monitoringHttpServer = this.monitoringApp.listen(9500, 'localhost', () => {
                log.info(`monitoring app listening on port: ${(<AddressInfo>this.monitoringHttpServer!.address()).port}`);
            });
        }

        this.debugApp.start(6060);
    }

    public async stop() {
        await this.debugApp.stop();
        await this.stopServer(this.monitoringHttpServer);
        await this.stopServer(this.httpServer);
        this.disposables.dispose();
        log.info('server stopped.');
    }

    protected async stopServer(server?: http.Server): Promise<void> {
        if (!server) {
            return;
        }
        return new Promise((resolve) => server.close((err: any) => {
            if (err) {
                log.warn(`error on server close.`, { err });
            }
            resolve();
        }));
    }

    protected installWebsocketConnectionGauge() {
        const gauge = new prom.Gauge({
            name: `server_websocket_connection_count`,
            help: 'Currently served websocket connections',
            labelNames: ["clientType"],
        });
        this.websocketConnectionHandler.onConnectionCreated((_, req) => gauge.inc({ clientType: WebsocketClientType.getClientType(req) || "undefined" }));
        this.websocketConnectionHandler.onConnectionClosed((_, req) => gauge.dec({ clientType: WebsocketClientType.getClientType(req) || "undefined" }));
    }

    protected installWebsocketClientContextGauge() {
        const gauge = new prom.Gauge({
            name: `server_websocket_client_context_count`,
            help: 'Currently served client contexts',
            labelNames: ["authLevel"],
        });
        this.websocketConnectionHandler.onClientContextCreated((ctx) => gauge.inc({ authLevel: ctx.authLevel }));
        this.websocketConnectionHandler.onClientContextClosed((ctx) => gauge.dec({ authLevel: ctx.authLevel }));
    }
}