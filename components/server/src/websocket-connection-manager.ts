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
import { AllAccessFunctionGuard, FunctionAccessGuard, WithFunctionAccessGuard } from "./auth/function-access";
import { HostContextProvider } from "./auth/host-context-provider";
import { RateLimiter, RateLimiterConfig, UserRateLimiter } from "./auth/rate-limiter";
import { CompositeResourceAccessGuard, OwnerResourceGuard, ResourceAccessGuard, SharedWorkspaceAccessGuard, TeamMemberResourceGuard, WithResourceAccessGuard, WorkspaceLogAccessGuard } from "./auth/resource-access";
import { increaseApiCallCounter, increaseApiConnectionClosedCounter, increaseApiConnectionCounter, increaseApiCallUserCounter } from "./prometheus-metrics";
import { GitpodServerImpl } from "./workspace/gitpod-server-impl";

export type GitpodServiceFactory<C extends GitpodClient, S extends GitpodServer> = () => GitpodServerImpl<C, S>;

const EVENT_CONNECTION_CREATED = "EVENT_CONNECTION_CREATED";
const EVENT_CONNECTION_CLOSED = "EVENT_CONNECTION_CLOSED";

/**
 * Establishes and manages JsonRpc-over-websocket connections from frontends to GitpodServerImpl instances
 */
export class WebsocketConnectionManager<C extends GitpodClient, S extends GitpodServer> implements ConnectionHandler {
    public readonly path = GitpodServerPath;

    protected readonly jsonRpcConnectionHandler: JsonRpcConnectionHandler<C>;
    protected readonly events = new EventEmitter();
    protected readonly servers: GitpodServerImpl<C, S>[] = [];

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

        const gitpodServer = this.serverFactory();
        const user = expressReq.user as User;

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

        const clientHeaderFields:ClientHeaderFields = {
            ip: expressReq.ips?.length > 0 ? expressReq.ips[0] : undefined,
            userAgent: expressReq.headers["user-agent"],
            dnt: expressReq.headers.dnt instanceof Array ? expressReq.headers.dnt[0] : expressReq.headers.dnt,
            clientRegion: expressReq.headers["x-glb-client-region"] instanceof Array ? expressReq.headers["x-glb-client-region"][0]: expressReq.headers["x-glb-client-region"]
        }

        gitpodServer.initialize(client, user, resourceGuard, clientHeaderFields);
        client.onDidCloseConnection(() => {
            increaseApiConnectionClosedCounter();
            gitpodServer.dispose();

            this.removeServer(gitpodServer);
            this.events.emit(EVENT_CONNECTION_CLOSED, gitpodServer);
        });
        this.servers.push(gitpodServer);

        this.events.emit(EVENT_CONNECTION_CREATED, gitpodServer);

        return new Proxy<GitpodServerImpl<C, S>>(gitpodServer, {
            get: (target, property: keyof GitpodServerImpl<C, S>) => {
                if (session) session.touch(console.error);

                return target[property];
            }
        });
    }

    protected createRateLimiter(request?: object): RateLimiter {
        const expressReq = request as express.Request;
        const user = expressReq.user as User;
        const sessionId = expressReq.session?.id;
        const id = user?.id || (!!sessionId ? `session-${sessionId}` : undefined) || "anonymous";
        return {
            user: id,
            consume: (method) => UserRateLimiter.instance(this.rateLimiterConfig).consume(id, method),
        }
    }

    public get currentConnectionCount(): number {
        return this.servers.length;
    }

    public onConnectionCreated(l: (server: GitpodServerImpl<C, S>) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CREATED, l)
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CREATED, l)
        }
    }

    public onConnectionClosed(l: (server: GitpodServerImpl<C, S>) => void): Disposable {
        this.events.on(EVENT_CONNECTION_CLOSED, l)
        return {
            dispose: () => this.events.off(EVENT_CONNECTION_CLOSED, l)
        }
    }

    protected removeServer(oddServer: GitpodServerImpl<C, S>) {
        const index = this.servers.findIndex(s => s.uuid === oddServer.uuid);
        if (index !== -1) {
            this.servers.splice(index);
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