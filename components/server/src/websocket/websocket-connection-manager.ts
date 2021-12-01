/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ClientHeaderFields, Disposable, GitpodClient as GitpodApiClient, GitpodServerPath, User } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ConnectionHandler } from "@gitpod/gitpod-protocol/lib/messaging/handler";
import { JsonRpcConnectionHandler, JsonRpcProxy, JsonRpcProxyFactory } from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { EventEmitter } from "events";
import * as express from "express";
import { ErrorCodes as RPCErrorCodes, MessageConnection, ResponseError } from "vscode-jsonrpc";
import { AllAccessFunctionGuard, FunctionAccessGuard, WithFunctionAccessGuard } from "../auth/function-access";
import { HostContextProvider } from "../auth/host-context-provider";
import { RateLimiter, RateLimiterConfig, UserRateLimiter } from "../auth/rate-limiter";
import { CompositeResourceAccessGuard, OwnerResourceGuard, ResourceAccessGuard, SharedWorkspaceAccessGuard, TeamMemberResourceGuard, WithResourceAccessGuard, WorkspaceLogAccessGuard } from "../auth/resource-access";
import { takeFirst } from "../express-util";
import { increaseApiCallCounter, increaseApiConnectionClosedCounter, increaseApiConnectionCounter, increaseApiCallUserCounter } from "../prometheus-metrics";
import { GitpodServerImpl } from "../workspace/gitpod-server-impl";
import * as opentracing from 'opentracing';
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";

export type GitpodServiceFactory = () => GitpodServerImpl;

const EVENT_CONNECTION_CREATED = "EVENT_CONNECTION_CREATED";
const EVENT_CONNECTION_CLOSED = "EVENT_CONNECTION_CLOSED";
const EVENT_CLIENT_CONTEXT_CREATED = "EVENT_CLIENT_CONTEXT_CREATED";
const EVENT_CLIENT_CONTEXT_CLOSED = "EVENT_CLIENT_CONTEXT_CLOSED";

/** TODO(gpl) Refine this list */
export type WebsocketClientType = "browser" | "go-client";
export namespace WebsocketClientType {
    export function getClientType(req: express.Request): WebsocketClientType | undefined {
        const userAgent = req.headers["user-agent"];

        if (!userAgent) {
            return undefined;
        }
        if (userAgent.startsWith("Go-http-client")) {
            return "go-client";
        }
        if (userAgent.startsWith("Mozilla")) {
            return "browser";
        }
        return undefined;
    }
}
export type WebsocketAuthenticationLevel = "user" | "session" | "anonymous";

export interface ClientMetadata {
    id: string,
    authLevel: WebsocketAuthenticationLevel,
}
export namespace ClientMetadata {
    export function getUserId(metadata: ClientMetadata): string | undefined {
        if (metadata.authLevel !== "user") {
            return undefined;
        }
        return metadata.id;
    }
    export function from(userId: string | undefined, sessionId?: string): ClientMetadata {
        if (userId) {
            return { id: userId, authLevel: "user" };
        } else if (sessionId) {
            return { id: `session-${sessionId}`, authLevel: "session" };
        } else {
            return { id: "anonymous", authLevel: "anonymous" };
        }
    }
}

export class WebsocketClientContext {
    constructor(
        /**
         * We try to be as specific as we can when identifying client connections.
         * If we now the userId, this will be the userId. If we just have a session, this is the sessionId (prefixed by `session-`).
         * If it's a
         */
        public readonly clientId: string,

        public readonly authLevel: WebsocketAuthenticationLevel
    ) {}

    /** This list of endpoints serving client connections 1-1 */
    protected servers: GitpodServerImpl[] = [];

    addEndpoint(server: GitpodServerImpl) {
        this.servers.push(server);
    }

    removeEndpoint(server: GitpodServerImpl) {
        const index = this.servers.findIndex(s => s.uuid === server.uuid);
        if (index !== -1) {
            this.servers.splice(index);
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
        protected readonly rateLimiterConfig: RateLimiterConfig) {
        this.jsonRpcConnectionHandler = new GitpodJsonRpcConnectionHandler<GitpodApiClient>(
            this.path,
            this.createProxyTarget.bind(this),
            this.createAccessGuard.bind(this),
            this.createRateLimiter.bind(this),
            this.getClientId.bind(this),
        );
    }

    public onConnection(connection: MessageConnection, session?: object) {
        increaseApiConnectionCounter();
        this.jsonRpcConnectionHandler.onConnection(connection, session);
    }

    protected createAccessGuard(request?: object): FunctionAccessGuard {
        return (request && (request as WithFunctionAccessGuard).functionGuard) || new AllAccessFunctionGuard();
    }

    protected createProxyTarget(client: JsonRpcProxy<GitpodApiClient>, request?: object): GitpodServerImpl {
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
                new WorkspaceLogAccessGuard(user, this.hostContextProvider),
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

        gitpodServer.initialize(client, user, resourceGuard, clientHeaderFields);
        client.onDidCloseConnection(() => {
            gitpodServer.dispose();
            increaseApiConnectionClosedCounter();
            this.events.emit(EVENT_CONNECTION_CLOSED, gitpodServer, expressReq);

            clientContext.removeEndpoint(gitpodServer);
            if (clientContext.hasNoEndpointsLeft()) {
                this.contexts.delete(clientContext.clientId);
                this.events.emit(EVENT_CLIENT_CONTEXT_CLOSED, clientContext);
            }
        });
        clientContext.addEndpoint(gitpodServer);

        this.events.emit(EVENT_CONNECTION_CREATED, gitpodServer, expressReq);

        return new Proxy<GitpodServerImpl>(gitpodServer, {
            get: (target, property: keyof GitpodServerImpl) => {
                if (session) session.touch();

                return target[property];
            }
        });
    }

    protected getOrCreateClientContext(expressReq: express.Request): WebsocketClientContext {
        const { id: clientId, authLevel } = this.getClientId(expressReq);
        let ctx = this.contexts.get(clientId);
        if (!ctx) {
            ctx = new WebsocketClientContext(clientId, authLevel);
            this.contexts.set(clientId, ctx);
            this.events.emit(EVENT_CLIENT_CONTEXT_CREATED, ctx);
        }
        return ctx;
    }

    protected getClientId(req?: object): ClientMetadata {
        const expressReq = req as express.Request;
        const user = expressReq.user;
        const sessionId = expressReq.session?.id;
        return ClientMetadata.from(user?.id, sessionId);
    }

    protected createRateLimiter(req?: object): RateLimiter {
        const { id: clientId } = this.getClientId(req);
        return {
            user: clientId,
            consume: (method) => UserRateLimiter.instance(this.rateLimiterConfig).consume(clientId, method),
        }
    }

    public onConnectionCreated(l: (server: GitpodServerImpl, req: express.Request) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CREATED, l)
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CREATED, l)
        }
    }

    public onConnectionClosed(l: (server: GitpodServerImpl, req: express.Request) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CLOSED, l)
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CLOSED, l)
        }
    }

    public onClientContextCreated(l: (ctx: WebsocketClientContext) => void): Disposable {
        this.events.on(EVENT_CLIENT_CONTEXT_CREATED, l)
        return {
            dispose: () => this.events.off(EVENT_CLIENT_CONTEXT_CREATED, l)
        }
    }

    public onClientContextClosed(l: (ctx: WebsocketClientContext) => void): Disposable {
        this.events.on(EVENT_CLIENT_CONTEXT_CLOSED, l)
        return {
            dispose: () => this.events.off(EVENT_CLIENT_CONTEXT_CLOSED, l)
        }
    }
}

class GitpodJsonRpcConnectionHandler<T extends object> extends JsonRpcConnectionHandler<T> {
    constructor(
        readonly path: string,
        readonly targetFactory: (proxy: JsonRpcProxy<T>, request?: object) => any,
        readonly accessGuard: (request?: object) => FunctionAccessGuard,
        readonly rateLimiterFactory: (request?: object) => RateLimiter,
        readonly getClientId: (request?: object) => ClientMetadata,
    ) {
        super(path, targetFactory);
    }

    onConnection(connection: MessageConnection, request?: object): void {
        const factory = new GitpodJsonRpcProxyFactory<T>(
            this.accessGuard(request),
            this.rateLimiterFactory(request),
            this.getClientId(request),
        );
        const proxy = factory.createProxy();
        factory.target = this.targetFactory(proxy, request);
        factory.listen(connection);
    }


}

class GitpodJsonRpcProxyFactory<T extends object> extends JsonRpcProxyFactory<T> {

    protected userId: string | undefined;

    constructor(
        protected readonly accessGuard: FunctionAccessGuard,
        protected readonly rateLimiter: RateLimiter,
        protected readonly clientMetadata: ClientMetadata,
    ) {
        super();

        this.userId = ClientMetadata.getUserId(clientMetadata);
    }

    protected async onRequest(method: string, ...args: any[]): Promise<any> {
        if (!this.rateLimiter.user.startsWith("session-")) {
            increaseApiCallUserCounter(method, this.rateLimiter.user);
        } else {
            increaseApiCallUserCounter(method, "anonymous");
        }

        try {
            await this.rateLimiter.consume(method);
        } catch (rlRejected) {
            if (rlRejected instanceof Error) {
                log.error("Unexpected error in the rate limiter", rlRejected);
                increaseApiCallCounter(method, 500);
                throw rlRejected;
            }
            log.warn(`Rate limiter prevents accessing method '${method}' of user '${this.rateLimiter.user} due to too many requests.`, rlRejected);
            increaseApiCallCounter(method, ErrorCodes.TOO_MANY_REQUESTS);
            throw new ResponseError(ErrorCodes.TOO_MANY_REQUESTS, "too many requests", { "Retry-After": String(Math.round(rlRejected.msBeforeNext / 1000)) || 1 });
        }

        if (!this.accessGuard.canAccess(method)) {
            log.error(`Request ${method} is not allowed`, { method, args });
            increaseApiCallCounter(method, ErrorCodes.PERMISSION_DENIED);
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        const span = opentracing.globalTracer().startSpan(method);
        const ctx = { span };

        // some generic data
        span.addTags({ client: this.clientMetadata });
        if (this.userId) {
            span.addTags({
                user: {
                    id: this.userId,
                },
            });
        }

        try {
            const result = await this.target[method](ctx, ...args);    // we can inject TraceContext here because of GitpodServerWithTracing
            increaseApiCallCounter(method, 200);
            return result;
        } catch (e) {
            if (e instanceof ResponseError) {
                increaseApiCallCounter(method, e.code);
                TraceContext.logJsonRPCError(ctx, method, e);
                log.info(`Request ${method} unsuccessful: ${e.code}/"${e.message}"`, { method, args });
            } else {
                const err = new ResponseError(500, "internal server error");
                increaseApiCallCounter(method, err.code);
                TraceContext.logJsonRPCError(ctx, method, err);

                log.error(`Request ${method} failed with internal server error`, e, { method, args });
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