/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ClientHeaderFields, Disposable, GitpodClient, GitpodServer, GitpodServerPath, User } from "@gitpod/gitpod-protocol";
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

export type GitpodServiceFactory<C extends GitpodClient, S extends GitpodServer> = () => GitpodServerImpl<C, S>;

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

export class WebsocketClientContext<C extends GitpodClient, S extends GitpodServer> {
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
    protected servers: GitpodServerImpl<C, S>[] = [];

    addEndpoint(server: GitpodServerImpl<C, S>) {
        this.servers.push(server);
    }

    removeEndpoint(server: GitpodServerImpl<C, S>) {
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
export class WebsocketConnectionManager<C extends GitpodClient, S extends GitpodServer> implements ConnectionHandler {
    public readonly path = GitpodServerPath;

    protected readonly jsonRpcConnectionHandler: JsonRpcConnectionHandler<C>;
    protected readonly events = new EventEmitter();
    protected readonly contexts: Map<string, WebsocketClientContext<C, S>> = new Map();

    constructor(
        protected readonly serverFactory: GitpodServiceFactory<C, S>,
        protected readonly hostContextProvider: HostContextProvider,
        protected readonly rateLimiterConfig: RateLimiterConfig) {
        this.jsonRpcConnectionHandler = new GitpodJsonRpcConnectionHandler<C>(
            this.path,
            this.createProxyTarget.bind(this),
            this.createAccessGuard.bind(this),
            this.createRateLimiter.bind(this),
        );
    }

    public onConnection(connection: MessageConnection, session?: object) {
        increaseApiConnectionCounter();
        this.jsonRpcConnectionHandler.onConnection(connection, session);
    }

    protected createAccessGuard(request?: object): FunctionAccessGuard {
        return (request && (request as WithFunctionAccessGuard).functionGuard) || new AllAccessFunctionGuard();
    }

    protected createProxyTarget(client: JsonRpcProxy<C>, request?: object): GitpodServerImpl<C, S> {
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

        return new Proxy<GitpodServerImpl<C, S>>(gitpodServer, {
            get: (target, property: keyof GitpodServerImpl<C, S>) => {
                if (session) session.touch();

                return target[property];
            }
        });
    }

    protected getOrCreateClientContext(expressReq: express.Request): WebsocketClientContext<C, S> {
        const { clientId, authLevel } = this.getClientId(expressReq);
        let ctx = this.contexts.get(clientId);
        if (!ctx) {
            ctx = new WebsocketClientContext(clientId, authLevel);
            this.contexts.set(clientId, ctx);
            this.events.emit(EVENT_CLIENT_CONTEXT_CREATED, ctx);
        }
        return ctx;
    }

    protected getClientId(expressReq: express.Request): { clientId: string, authLevel: WebsocketAuthenticationLevel } {
        const user = expressReq.user;
        const sessionId = expressReq.session?.id;
        if (user?.id) {
            return { clientId: user.id, authLevel: "user" };
        } else if (!!sessionId) {
            return { clientId: `session-${sessionId}`, authLevel: "session" };
        } else {
            return { clientId: "anonymous", authLevel: "anonymous" };
        }
    }

    protected createRateLimiter(expressReq?: object): RateLimiter {
        const { clientId } = this.getClientId(expressReq as express.Request);
        return {
            user: clientId,
            consume: (method) => UserRateLimiter.instance(this.rateLimiterConfig).consume(clientId, method),
        }
    }

    public onConnectionCreated(l: (server: GitpodServerImpl<C, S>, req: express.Request) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CREATED, l)
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CREATED, l)
        }
    }

    public onConnectionClosed(l: (server: GitpodServerImpl<C, S>, req: express.Request) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CLOSED, l)
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CLOSED, l)
        }
    }

    public onClientContextCreated(l: (ctx: WebsocketClientContext<C, S>) => void): Disposable {
        this.events.on(EVENT_CLIENT_CONTEXT_CREATED, l)
        return {
            dispose: () => this.events.off(EVENT_CLIENT_CONTEXT_CREATED, l)
        }
    }

    public onClientContextClosed(l: (ctx: WebsocketClientContext<C, S>) => void): Disposable {
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
    ) {
        super(path, targetFactory);
    }

    onConnection(connection: MessageConnection, request?: object): void {
        const factory = new GitpodJsonRpcProxyFactory<T>(this.accessGuard(request), this.rateLimiterFactory(request));
        const proxy = factory.createProxy();
        factory.target = this.targetFactory(proxy, request);
        factory.listen(connection);
    }


}

class GitpodJsonRpcProxyFactory<T extends object> extends JsonRpcProxyFactory<T> {

    constructor(
        protected readonly accessGuard: FunctionAccessGuard,
        protected readonly rateLimiter: RateLimiter,
    ) {
        super();
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

        try {
            const result = await this.target[method](...args);
            increaseApiCallCounter(method, 200);
            return result;
        } catch (e) {
            if (e instanceof ResponseError) {
                increaseApiCallCounter(method, e.code);
                log.info(`Request ${method} unsuccessful: ${e.code}/"${e.message}"`, { method, args });
            } else {
                increaseApiCallCounter(method, 500);
                log.error(`Request ${method} failed with internal server error`, e, { method, args });
            }
            throw e;
        }
    }

    protected onNotification(method: string, ...args: any[]): void {
        throw new ResponseError(RPCErrorCodes.InvalidRequest, "notifications are not supported");
    }

}