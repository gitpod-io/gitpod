/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    ClientHeaderFields,
    Disposable,
    GitpodClient as GitpodApiClient,
    GitpodServerPath,
    RateLimiterError,
    User,
} from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ConnectionHandler } from "@gitpod/gitpod-protocol/lib/messaging/handler";
import {
    JsonRpcConnectionHandler,
    JsonRpcProxy,
    JsonRpcProxyFactory,
} from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { EventEmitter } from "events";
import * as express from "express";
import { ErrorCodes as RPCErrorCodes, MessageConnection, ResponseError } from "vscode-jsonrpc";
import { AllAccessFunctionGuard, FunctionAccessGuard, WithFunctionAccessGuard } from "../auth/function-access";
import { HostContextProvider } from "../auth/host-context-provider";
import { isValidFunctionName, RateLimiter, RateLimiterConfig, UserRateLimiter } from "../auth/rate-limiter";
import {
    CompositeResourceAccessGuard,
    OwnerResourceGuard,
    ResourceAccessGuard,
    SharedWorkspaceAccessGuard,
    TeamMemberResourceGuard,
    WithResourceAccessGuard,
    RepositoryResourceGuard,
} from "../auth/resource-access";
import { takeFirst } from "../express-util";
import {
    increaseApiCallCounter,
    increaseApiConnectionClosedCounter,
    increaseApiConnectionCounter,
    observeAPICallsDuration,
    apiCallDurationHistogram,
} from "../prometheus-metrics";
import { GitpodServerImpl } from "../workspace/gitpod-server-impl";
import * as opentracing from "opentracing";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

export type GitpodServiceFactory = () => GitpodServerImpl;

const EVENT_CONNECTION_CREATED = "EVENT_CONNECTION_CREATED";
const EVENT_CONNECTION_CLOSED = "EVENT_CONNECTION_CLOSED";
const EVENT_CLIENT_CONTEXT_CREATED = "EVENT_CLIENT_CONTEXT_CREATED";
const EVENT_CLIENT_CONTEXT_CLOSED = "EVENT_CLIENT_CONTEXT_CLOSED";

/** TODO(gpl) Refine this list */
export type WebsocketClientType =
    | "browser"
    | "go-client"
    | "gitpod-code"
    | "supervisor"
    | "local-companion"
    | "io.gitpod.jetbrains.remote"
    | "io.gitpod.jetbrains.gateway";
namespace WebsocketClientType {
    export function getClientType(req: express.Request): WebsocketClientType | undefined {
        const userAgent = req.headers["user-agent"];

        let result: WebsocketClientType | undefined = undefined;
        if (userAgent) {
            if (userAgent.startsWith("Go-http-client")) {
                result = "go-client";
            } else if (userAgent.startsWith("Mozilla")) {
                result = "browser";
            } else if (userAgent.startsWith("Gitpod Code")) {
                result = "gitpod-code";
            } else if (userAgent.startsWith("gitpod/supervisor")) {
                result = "supervisor";
            } else if (userAgent.startsWith("gitpod/local-companion")) {
                result = "local-companion";
            } else if (userAgent === "io.gitpod.jetbrains.remote" || userAgent === "io.gitpod.jetbrains.gateway") {
                result = userAgent;
            }
        }
        if (result === undefined) {
            log.debug("API client with unknown 'User-Agent'", req.headers);
        }
        return result;
    }
}
export type WebsocketAuthenticationLevel = "user" | "session" | "anonymous";

export interface ClientMetadata {
    id: string;
    authLevel: WebsocketAuthenticationLevel;
    sessionId?: string;
    userId?: string;
    type?: WebsocketClientType;
    origin: ClientOrigin;
    version?: string;
    userAgent?: string;
}
interface ClientOrigin {
    workspaceId?: string;
    instanceId?: string;
}
export namespace ClientMetadata {
    export function from(
        userId: string | undefined,
        sessionId?: string,
        data?: Omit<ClientMetadata, "id" | "sessionId" | "authLevel">,
    ): ClientMetadata {
        let id = "anonymous";
        let authLevel: WebsocketAuthenticationLevel = "anonymous";
        if (userId) {
            id = userId;
            authLevel = "user";
        } else if (sessionId) {
            id = `session-${sessionId}`;
            authLevel = "session";
        }
        return { id, authLevel, userId, sessionId, ...data, origin: data?.origin || {} };
    }

    export function fromRequest(req: any) {
        const expressReq = req as express.Request;
        const user = expressReq.user;
        const sessionId = expressReq.session?.id;
        const type = WebsocketClientType.getClientType(expressReq);
        const version = takeFirst(expressReq.headers["x-client-version"]);
        const userAgent = takeFirst(expressReq.headers["user-agent"]);
        const instanceId = takeFirst(expressReq.headers["x-workspace-instance-id"]);
        const workspaceId = getOriginWorkspaceId(expressReq);
        const origin: ClientOrigin = {
            instanceId,
            workspaceId,
        };
        return ClientMetadata.from(user?.id, sessionId, { type, origin, version, userAgent });
    }

    function getOriginWorkspaceId(req: express.Request): string | undefined {
        const origin = req.headers["origin"];
        if (!origin) {
            return undefined;
        }

        try {
            const u = new GitpodHostUrl(origin);
            return u.workspaceId;
        } catch (err) {
            // ignore
            return undefined;
        }
    }
}

export class WebsocketClientContext {
    constructor(public readonly clientMetadata: ClientMetadata) {}

    /** This list of endpoints serving client connections 1-1 */
    protected servers: GitpodServerImpl[] = [];

    get clientId(): string {
        return this.clientMetadata.id;
    }

    addEndpoint(server: GitpodServerImpl) {
        this.servers.push(server);
    }

    removeEndpoint(server: GitpodServerImpl) {
        const index = this.servers.findIndex((s) => s.uuid === server.uuid);
        if (index !== -1) {
            this.servers.splice(index, 1);
        }
    }

    hasNoEndpointsLeft(): boolean {
        return this.servers.length === 0;
    }
}

/**
 * Establishes and manages JsonRpc-over-websocket connections from frontends to GitpodServerImpl instances
 */
export class WebsocketConnectionManager implements ConnectionHandler {
    public readonly path = GitpodServerPath;

    protected readonly jsonRpcConnectionHandler: JsonRpcConnectionHandler<GitpodApiClient>;
    protected readonly events = new EventEmitter();
    protected readonly contexts: Map<string, WebsocketClientContext> = new Map();

    constructor(
        protected readonly serverFactory: GitpodServiceFactory,
        protected readonly hostContextProvider: HostContextProvider,
        protected readonly rateLimiterConfig: RateLimiterConfig,
    ) {
        this.jsonRpcConnectionHandler = new GitpodJsonRpcConnectionHandler<GitpodApiClient>(
            this.path,
            this.createProxyTarget.bind(this),
            this.rateLimiterConfig,
        );
    }

    public onConnection(connection: MessageConnection, session?: object) {
        increaseApiConnectionCounter();
        this.jsonRpcConnectionHandler.onConnection(connection, session);
    }

    protected createProxyTarget(
        client: JsonRpcProxy<GitpodApiClient>,
        request?: object,
        connectionCtx?: TraceContext,
    ): GitpodServerImpl {
        const expressReq = request as express.Request;
        const session = expressReq.session;
        const user: User | undefined = expressReq.user;

        const clientContext = this.getOrCreateClientContext(expressReq);
        const gitpodServer = this.serverFactory();

        let resourceGuard: ResourceAccessGuard;
        let explicitGuard = (expressReq as WithResourceAccessGuard).resourceGuard;
        if (!!explicitGuard) {
            resourceGuard = explicitGuard;
        } else if (!!user) {
            resourceGuard = new CompositeResourceAccessGuard([
                new OwnerResourceGuard(user.id),
                new TeamMemberResourceGuard(user.id),
                new SharedWorkspaceAccessGuard(),
                new RepositoryResourceGuard(user, this.hostContextProvider),
            ]);
        } else {
            resourceGuard = { canAccess: async () => false };
        }

        const clientHeaderFields: ClientHeaderFields = {
            ip: takeFirst(expressReq.ips),
            userAgent: expressReq.headers["user-agent"],
            dnt: takeFirst(expressReq.headers.dnt),
            clientRegion: takeFirst(expressReq.headers["x-glb-client-region"]),
        };

        gitpodServer.initialize(
            client,
            user,
            resourceGuard,
            clientContext.clientMetadata,
            connectionCtx,
            clientHeaderFields,
        );
        client.onDidCloseConnection(() => {
            try {
                gitpodServer.dispose();
                increaseApiConnectionClosedCounter();
                this.events.emit(EVENT_CONNECTION_CLOSED, gitpodServer, expressReq);

                clientContext.removeEndpoint(gitpodServer);
                if (clientContext.hasNoEndpointsLeft()) {
                    this.contexts.delete(clientContext.clientId);
                    this.events.emit(EVENT_CLIENT_CONTEXT_CLOSED, clientContext);
                }
            } catch (err) {
                // we want to be absolutely sure that we do not bubble up errors into ws.onClose here
                log.error("onDidCloseConnection", err);
            }
        });
        clientContext.addEndpoint(gitpodServer);

        this.events.emit(EVENT_CONNECTION_CREATED, gitpodServer, expressReq);

        return new Proxy<GitpodServerImpl>(gitpodServer, {
            get: (target, property: keyof GitpodServerImpl) => {
                if (session) session.touch();

                return target[property];
            },
        });
    }

    protected getOrCreateClientContext(expressReq: express.Request): WebsocketClientContext {
        const metadata = ClientMetadata.fromRequest(expressReq);
        let ctx = this.contexts.get(metadata.id);
        if (!ctx) {
            ctx = new WebsocketClientContext(metadata);
            this.contexts.set(metadata.id, ctx);
            this.events.emit(EVENT_CLIENT_CONTEXT_CREATED, ctx);
        }
        return ctx;
    }

    public onConnectionCreated(l: (server: GitpodServerImpl, req: express.Request) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CREATED, l);
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CREATED, l),
        };
    }

    public onConnectionClosed(l: (server: GitpodServerImpl, req: express.Request) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CLOSED, l);
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CLOSED, l),
        };
    }

    public onClientContextCreated(l: (ctx: WebsocketClientContext) => void): Disposable {
        this.events.on(EVENT_CLIENT_CONTEXT_CREATED, l);
        return {
            dispose: () => this.events.off(EVENT_CLIENT_CONTEXT_CREATED, l),
        };
    }

    public onClientContextClosed(l: (ctx: WebsocketClientContext) => void): Disposable {
        this.events.on(EVENT_CLIENT_CONTEXT_CLOSED, l);
        return {
            dispose: () => this.events.off(EVENT_CLIENT_CONTEXT_CLOSED, l),
        };
    }
}

class GitpodJsonRpcConnectionHandler<T extends object> extends JsonRpcConnectionHandler<T> {
    constructor(
        readonly path: string,
        readonly targetFactory: (proxy: JsonRpcProxy<T>, request?: object, connectionCtx?: TraceContext) => any,
        readonly rateLimiterConfig: RateLimiterConfig,
    ) {
        super(path, targetFactory); // targetFactory has to adhere to the interface here, but is not used, because we override "onConnection" below
    }

    onConnection(connection: MessageConnection, request?: object): void {
        const clientMetadata = ClientMetadata.fromRequest(request);

        // trace the ws connection itself
        const span = opentracing.globalTracer().startSpan("ws-connection");
        const ctx = { span };
        traceClientMetadata(ctx, clientMetadata);
        TraceContext.setOWI(ctx, {
            userId: clientMetadata.userId,
            sessionId: clientMetadata.sessionId,
        });
        connection.onClose(() => span.finish());

        const factory = new GitpodJsonRpcProxyFactory<T>(
            this.createAccessGuard(request),
            this.createRateLimiter(clientMetadata.id, request),
            clientMetadata,
            ctx,
        );
        const proxy = factory.createProxy();
        factory.target = this.targetFactory(proxy, request, ctx);
        factory.listen(connection);
    }

    protected createRateLimiter(clientId: string, req?: object): RateLimiter {
        return {
            user: clientId,
            consume: (method) => UserRateLimiter.instance(this.rateLimiterConfig).consume(clientId, method),
        };
    }

    protected createAccessGuard(request?: object): FunctionAccessGuard {
        return (request && (request as WithFunctionAccessGuard).functionGuard) || new AllAccessFunctionGuard();
    }
}

class GitpodJsonRpcProxyFactory<T extends object> extends JsonRpcProxyFactory<T> {
    constructor(
        protected readonly accessGuard: FunctionAccessGuard,
        protected readonly rateLimiter: RateLimiter,
        protected readonly clientMetadata: ClientMetadata,
        protected readonly connectionCtx: TraceContext,
    ) {
        super();
    }

    protected async onRequest(method: string, ...args: any[]): Promise<any> {
        const span = TraceContext.startSpan(method, undefined);
        const ctx = { span };
        const userId = this.clientMetadata.userId;
        const timer = apiCallDurationHistogram.startTimer();
        try {
            // generic tracing data
            traceClientMetadata(ctx, this.clientMetadata);
            TraceContext.setOWI(ctx, {
                userId,
                sessionId: this.clientMetadata.sessionId,
            });
            TraceContext.setJsonRPCMetadata(ctx, method);

            // rate limiting
            try {
                await this.rateLimiter.consume(method);
            } catch (rlRejected) {
                if (rlRejected instanceof Error) {
                    log.error({ userId }, "Unexpected error in the rate limiter", rlRejected);
                    throw rlRejected;
                }
                log.warn({ userId }, "Rate limiter prevents accessing method due to too many requests.", rlRejected, {
                    method,
                });
                throw new ResponseError<RateLimiterError>(ErrorCodes.TOO_MANY_REQUESTS, "too many requests", {
                    method,
                    retryAfter: Math.round(rlRejected.msBeforeNext / 1000) || 1,
                });
            }

            // explicitly guard against wrong method names
            if (!isValidFunctionName(method)) {
                throw new ResponseError(ErrorCodes.BAD_REQUEST, `Unknown method '${method}'`);
            }

            // access guard
            if (!this.accessGuard.canAccess(method)) {
                // logging/tracing is done in 'catch' clause
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `Request ${method} is not allowed`);
            }

            // actual call
            const result = await this.target[method](ctx, ...args); // we can inject TraceContext here because of GitpodServerWithTracing
            increaseApiCallCounter(method, 200);
            observeAPICallsDuration(method, 200, timer());
            return result;
        } catch (e) {
            if (e instanceof ResponseError) {
                increaseApiCallCounter(method, e.code);
                observeAPICallsDuration(method, e.code, timer());
                TraceContext.setJsonRPCError(ctx, method, e);

                log.info({ userId }, `Request ${method} unsuccessful: ${e.code}/"${e.message}"`, { method, args });
            } else {
                TraceContext.setError(ctx, e); // this is a "real" error

                const err = new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, "internal server error");
                increaseApiCallCounter(method, err.code);
                observeAPICallsDuration(method, err.code, timer());
                TraceContext.setJsonRPCError(ctx, method, err, true);

                log.error({ userId }, `Request ${method} failed with internal server error`, e, { method, args });
            }
            throw e;
        } finally {
            span.finish();
        }
    }

    protected onNotification(method: string, ...args: any[]): void {
        throw new ResponseError(RPCErrorCodes.InvalidRequest, "notifications are not supported");
    }
}

export function traceClientMetadata(ctx: TraceContext, clientMetadata: ClientMetadata) {
    TraceContext.addNestedTags(ctx, {
        client: {
            id: clientMetadata.id,
            authLevel: clientMetadata.authLevel,
            type: clientMetadata.type,
            version: clientMetadata.version,
            origin: clientMetadata.origin,
            userAgent: clientMetadata.userAgent,
        },
    });
}
