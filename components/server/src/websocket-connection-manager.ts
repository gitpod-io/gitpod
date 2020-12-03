/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodServerImpl } from "./workspace/gitpod-server-impl";
import { GitpodServerPath, User, GitpodClient, Disposable, GitpodServer } from "@gitpod/gitpod-protocol";
import { JsonRpcConnectionHandler, JsonRpcProxy, JsonRpcProxyFactory } from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";
import { ConnectionHandler } from "@gitpod/gitpod-protocol/lib/messaging/handler";
import { MessageConnection, ResponseError, ErrorCodes as RPCErrorCodes } from "vscode-jsonrpc";
import { EventEmitter } from "events";
import * as express from "express";
import { OwnerResourceGuard, WithResourceAccessGuard, ResourceAccessGuard, CompositeResourceAccessGuard, SharedWorkspaceAccessGuard } from "./auth/resource-access";
import { WithFunctionAccessGuard, AllAccessFunctionGuard, FunctionAccessGuard } from "./auth/function-access";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

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

    constructor(protected readonly serverFactory: GitpodServiceFactory<C, S>) {
        this.jsonRpcConnectionHandler = new GitpodJsonRpcConnectionHandler<C>(
            this.path, 
            this.createProxyTarget.bind(this),
            this.createAccessGuard.bind(this),
        );
    }

    public onConnection(connection: MessageConnection, session?: object) {
        this.jsonRpcConnectionHandler.onConnection(connection, session);
    }

    protected createAccessGuard(request?: object): FunctionAccessGuard {
        return (request && (request as WithFunctionAccessGuard).functionGuard) || new AllAccessFunctionGuard();
    }

    protected createProxyTarget(client: JsonRpcProxy<C>, request?: object): GitpodServerImpl<C, S> {
        const expressReq = request as express.Request;
        const session = expressReq.session;

        const gitpodServer = this.serverFactory();
        const clientRegion = (expressReq as any).headers["x-glb-client-region"];
        const user = expressReq.user as User;

        let resourceGuard: ResourceAccessGuard;
        let explicitGuard = (expressReq as WithResourceAccessGuard).resourceGuard;
        if (!!explicitGuard) {
            resourceGuard = explicitGuard;
        } else if (!!user) {
            resourceGuard = new CompositeResourceAccessGuard([
                new OwnerResourceGuard(user.id),
                new SharedWorkspaceAccessGuard(),
            ]);
        } else {
            resourceGuard = {canAccess: async () => false };
        }

        gitpodServer.initialize(client, clientRegion, user, resourceGuard);
        client.onDidCloseConnection(() => {
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
        readonly accessGuard: (request?: object) => FunctionAccessGuard
    ) { 
        super(path, targetFactory);
    }

    onConnection(connection: MessageConnection, request?: object): void {
        const factory = new GitpodJsonRpcProxyFactory<T>(this.accessGuard(request));
        const proxy = factory.createProxy();
        factory.target = this.targetFactory(proxy, request);
        factory.listen(connection);
    }
}

class GitpodJsonRpcProxyFactory<T extends object> extends JsonRpcProxyFactory<T> {

    constructor(protected readonly accessGuard: FunctionAccessGuard) { 
        super();
    }
    
    protected async onRequest(method: string, ...args: any[]): Promise<any> {
        if (!this.accessGuard.canAccess(method)) {
            log.error(`Request ${method} is not allowed`, {method, args});
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        try {
            return await this.target[method](...args);
        } catch (e) {
            if (e instanceof ResponseError) {
                log.info(`Request ${method} unsuccessful: ${e.code}/"${e.message}"`, { method, args });
            } else {
                log.error(`Request ${method} failed with internal server error`, e, { method, args });
            }
            throw e;
        }
    }

    protected onNotification(method: string, ...args: any[]): void {
        throw new ResponseError(RPCErrorCodes.InvalidRequest, "notifications are not supported");
    }

}