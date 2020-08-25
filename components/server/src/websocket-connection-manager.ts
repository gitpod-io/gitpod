/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodServerImpl } from "./workspace/gitpod-server-impl";
import { GitpodServerPath, User, GitpodClient, Disposable, GitpodServer } from "@gitpod/gitpod-protocol";
import { JsonRpcConnectionHandler, JsonRpcProxy } from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";
import { ConnectionHandler } from "@gitpod/gitpod-protocol/lib/messaging/handler";
import { MessageConnection } from "vscode-jsonrpc";
import { EventEmitter } from "events";
import * as express from "express";

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
        this.jsonRpcConnectionHandler = new JsonRpcConnectionHandler<C>(this.path, this.createProxyTarget.bind(this));
    }

    public onConnection(connection: MessageConnection, session?: object) {
        this.jsonRpcConnectionHandler.onConnection(connection, session);
    }

    protected createProxyTarget(client: JsonRpcProxy<C>, request?: object): GitpodServerImpl<C, S> {
        const expressReq = request as express.Request;
        const session = expressReq.session;

        const gitpodServer = this.serverFactory();
        const clientRegion = (expressReq as any).headers["x-glb-client-region"];
        gitpodServer.initialize(client, clientRegion, expressReq.user as User);
        client.onDidCloseConnection(() => {
            gitpodServer.dispose();

            this.removeServer(gitpodServer);
            this.events.emit(EVENT_CONNECTION_CLOSED, gitpodServer);
        });
        this.servers.push(gitpodServer);

        this.events.emit(EVENT_CONNECTION_CREATED, gitpodServer);

        return new Proxy<GitpodServerImpl<C, S>>(gitpodServer, {
            get: (target, property: keyof GitpodServerImpl<C, S>) => {
                const result = target[property];
                if (session) session.touch(console.error);
                return result;
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