/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { listen as doListen, Logger, ConsoleLogger } from "vscode-ws-jsonrpc";
import { JsonRpcProxyFactory, JsonRpcProxy } from "../proxy-factory";
import { ConnectionHandler } from "../handler";
import ReconnectingWebSocket from 'reconnecting-websocket';

export interface WebSocketOptions {
    onerror?: (event: Event) => void;
    onListening?: (socket: ReconnectingWebSocket) => void;
}

export class WebSocketConnectionProvider {

    /**
     * Create a proxy object to remote interface of T type
     * over a web socket connection for the given path.
     *
     * An optional target can be provided to handle
     * notifications and requests from a remote side.
     */
    createProxy<T extends object>(path: string | Promise<string>, target?: object, options?: WebSocketOptions): JsonRpcProxy<T> {
        const factory = new JsonRpcProxyFactory<T>(target);
        const startListening = (path: string) => {
            const socket = this.listen({
                path,
                onConnection: c => factory.listen(c)
            },
                options
            );
            if (options?.onListening) {
                options.onListening(socket as any as ReconnectingWebSocket)
            }
        };

        if (typeof path === "string") {
            startListening(path);
        } else {
            path.then(path => startListening(path));
        }
        return factory.createProxy();
    }

    /**
     * Install a connection handler for the given path.
     */
    listen(handler: ConnectionHandler, options?: WebSocketOptions): WebSocket {
        const url = handler.path;
        const webSocket = this.createWebSocket(url);

        const logger = this.createLogger();
        if (options && options.onerror) {
            const onerror = options.onerror;
            webSocket.addEventListener('error', (event) => {
                onerror(event);
            });
        } else {
            webSocket.addEventListener('error', (error: Event) => {
                logger.error(JSON.stringify(error));
            });
        }
        doListen({
            webSocket,
            onConnection: connection => handler.onConnection(connection),
            logger
        });
        return webSocket;
    }

    protected createLogger(): Logger {
        return new ConsoleLogger();
    }

    /**
     * Creates a web socket for the given url
     */
    createWebSocket(url: string): WebSocket {
        return new ReconnectingWebSocket(url, undefined, {
            maxReconnectionDelay: 10000,
            minReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.3,
            maxRetries: Infinity,
            debug: false,
            WebSocket: WebSocket
        }) as any;
    }

}
