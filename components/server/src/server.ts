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
import { Env } from './env';
import { EventEmitter } from 'events';
import { toIWebSocket } from '@gitpod/gitpod-protocol/lib/messaging/node/connection';
import { WsExpressHandler, WsRequestHandler } from './express/ws-handler';
import { pingPong, handleError, isAllowedWebsocketDomain } from './express-util';
import { createWebSocketConnection } from 'vscode-ws-jsonrpc/lib';
import { MessageBusIntegration } from './workspace/messagebus-integration';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { EnforcementController } from './user/enforcement-endpoint';
import { AddressInfo } from 'net';
import { TheiaPluginController } from './theia-plugin/theia-plugin-controller';
import { URL } from 'url';
import { ConsensusLeaderQorum } from './consensus/consensus-leader-quorum';
import { RabbitMQConsensusLeaderMessenger } from './consensus/rabbitmq-consensus-leader-messenger';
import { WorkspaceGarbageCollector } from './workspace/garbage-collector';
import { WorkspaceDownloadService } from './workspace/workspace-download-service';
import { MonitoringEndpointsApp } from './monitoring-endpoints';
import { WebsocketConnectionManager } from './websocket-connection-manager';
import { DeletedEntryGC, PeriodicDbDeleter } from '@gitpod/gitpod-db/lib';
import { OneTimeSecretServer } from './one-time-secret-server';
import { GitpodClient, GitpodServer } from '@gitpod/gitpod-protocol';
import { BearerAuth } from './auth/bearer-authenticator';
import { HostContextProvider } from './auth/host-context-provider';
import { CodeSyncService } from './code-sync/code-sync-service';
import { increaseHttpRequestCounter, observeHttpRequestDuration } from './prometheus-metrics';
import { OAuthController } from './oauth-server/oauth-controller';
import { HeadlessLogController } from './workspace/headless-log-controller';
import { NewsletterSubscriptionController } from './user/newsletter-subscription-controller';
import { Config } from './config';

@injectable()
export class Server<C extends GitpodClient, S extends GitpodServer> {
    static readonly EVENT_ON_START = 'start';

    @inject(Env) protected readonly env: Env;
    @inject(Config) protected readonly config: Config;
    @inject(SessionHandlerProvider) protected sessionHandlerProvider: SessionHandlerProvider;
    @inject(Authenticator) protected authenticator: Authenticator;
    @inject(UserController) protected readonly userController: UserController;
    @inject(EnforcementController) protected readonly enforcementController: EnforcementController;
    @inject(TheiaPluginController) protected readonly pluginController: TheiaPluginController;
    @inject(WebsocketConnectionManager) protected websocketConnectionHandler: WebsocketConnectionManager<C, S>;
    @inject(MessageBusIntegration) protected readonly messagebus: MessageBusIntegration;
    @inject(WorkspaceDownloadService) protected readonly workspaceDownloadService: WorkspaceDownloadService;
    @inject(MonitoringEndpointsApp) protected readonly monitoringEndpointsApp: MonitoringEndpointsApp;
    @inject(CodeSyncService) private readonly codeSyncService: CodeSyncService;
    @inject(HeadlessLogController) protected readonly headlessLogController: HeadlessLogController;

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
    protected monApp?: express.Application;
    protected monHttpServer?: http.Server;

    public async init(app: express.Application) {
        log.info('Initializing');
        log.info('config', { config: JSON.stringify(this.config, undefined, 2) });

        // metrics
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const startTime = Date.now();
            req.on("end", () =>{
                const method = req.method;
                const route = req.route?.path || req.baseUrl || req.url || "unknown";
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
            const csrfGuard: ws.VerifyClientCallbackAsync = (info: { origin: string; secure: boolean; req: http.IncomingMessage }, callback: (res: boolean, code?: number, message?: string) => void) => {
                let allowedRequest = isAllowedWebsocketDomain(info.origin, this.env.hostUrl.url.hostname);
                if (this.env.kubeStage === 'prodcopy' || this.env.kubeStage === 'staging') {
                    // On staging and devstaging, we want to allow Theia to be able to connect to the server from this magic port
                    // This enables debugging Theia from inside Gitpod
                    const url = new URL(info.origin);
                    if (url.hostname.startsWith("13444-")) {
                        allowedRequest = true;
                    }
                }
                if (!allowedRequest && this.env.insecureNoDomain) {
                    log.warn("Websocket connection CSRF guard disabled");
                    allowedRequest = true;
                }

                if (!allowedRequest) {
                    log.warn("Websocket connection attempt with non-matching Origin header: " + info.origin)
                    return callback(false, 403);
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

            const wsHandler = new WsExpressHandler(httpServer, csrfGuard);
            wsHandler.ws(websocketConnectionHandler.path, (ws, request) => {
                const websocket = toIWebSocket(ws);
                (request as any).wsConnection = createWebSocketConnection(websocket, console);
            }, handleSession, ...initSessionHandlers, handleError, pingPong, (ws: ws, req: express.Request) => {
                websocketConnectionHandler.onConnection((req as any).wsConnection, req);
            });
            wsHandler.ws("/v1", (ws, request) => {
                const websocket = toIWebSocket(ws);
                (request as any).wsConnection = createWebSocketConnection(websocket, console);
            }, this.bearerAuth.websocketHandler, handleError, pingPong, (ws: ws, req: express.Request) => {
                websocketConnectionHandler.onConnection((req as any).wsConnection, req);
            });
        })

        // register routers
        await this.registerRoutes(app);

        // Turn unhandled requests into errors
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (this.isAnsweredRequest(req, res)) {
                return next();
            }

            // As we direct browsers to *api*.gitpod.io/login, we get requests like the following, which we do not want to end up in the error logs
            if (req.originalUrl === '/'
                || req.originalUrl === '/gitpod'
                || req.originalUrl === '/favicon.ico'
                || req.originalUrl === '/robots.txt') {
                // Redirect to gitpod.io/<pathname>
                res.redirect(this.env.hostUrl.with({ pathname: req.originalUrl }).toString());
                return;
            }
            return next(new Error("Unhandled request: " + req.method + " " + req.originalUrl));
        });

        // Generic error handler
        app.use((err: any, req: express.Request, response: express.Response, next: express.NextFunction) => {
            let msg: string;
            if (err instanceof Error) {
                msg = err.toString() + "\nStack: " + err.stack;
            } else {
                msg = err.toString();
            }
            log.debug({ sessionId: req.sessionID }, err, {
                originalUrl: req.originalUrl,
                headers: req.headers,
                cookies: req.cookies,
                session: req.session
            });
            if (!this.isAnsweredRequest(req, response)) {
                response.status(500).send({ error: msg });
            }
        });


        // Health check + metrics endpoints
        this.monApp = this.monitoringEndpointsApp.create();

        // Report current websocket connections
        this.installWebsocketConnectionGauge();

        // Connect to message bus
        await this.messagebus.connect();

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
        log.info('Initialized');
    }
    protected async startDbDeleter() {
        if (!this.env.runDbDeleter) {
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
        app.use('/plugins', this.pluginController.apiRouter);
        app.use('/workspace-download', this.workspaceDownloadService.apiRouter);
        app.use('/code-sync', this.codeSyncService.apiRouter);
        app.use('/headless-logs', this.headlessLogController.apiRouter);
        app.use(this.newsletterSubscriptionController.apiRouter);
        app.use("/version", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            res.send(this.env.version);
        });
        app.use(this.oauthController.oauthRouter);
    }

    protected isAnsweredRequest(req: express.Request, res: express.Response) {
        return res.headersSent || req.originalUrl.endsWith(".websocket");
    }

    public async start(port: number) {
        if (!this.app) {
            throw new Error("Server cannot start, not initialized");
        }

        const httpServer = this.app.listen(port, () => {
            this.eventEmitter.emit(Server.EVENT_ON_START, httpServer);
            log.info(`Server listening on port: ${(<AddressInfo>httpServer.address()).port}`);
        })
        this.httpServer = httpServer;
        if (this.monApp) {
            this.monHttpServer = this.monApp.listen(9500, 'localhost', () => {
                log.info(`Monitoring server listening on port: ${(<AddressInfo>this.monHttpServer!.address()).port}`);
            });
        }
    }

    public async stop() {
        await this.stopServer(this.monHttpServer);
        await this.stopServer(this.httpServer);
        log.info('Stopped');
    }

    protected async stopServer(server?: http.Server): Promise<void> {
        if (!server) {
            return;
        }
        return new Promise((resolve) => server.close((err: any) => {
            if (err) {
                log.warn(`Error on server close.`, { err });
            }
            resolve();
        }));
    }

    protected installWebsocketConnectionGauge() {
        const gauge = new prom.Gauge({
            name: `server_websocket_connection_count`,
            help: 'Currently served websocket connections',
        });
        this.websocketConnectionHandler.onConnectionCreated(() => gauge.inc());
        this.websocketConnectionHandler.onConnectionClosed(() => gauge.dec());
    }
}