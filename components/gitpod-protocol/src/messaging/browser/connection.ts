/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Logger, ConsoleLogger, toSocket, IWebSocket } from "vscode-ws-jsonrpc";
import { createMessageConnection } from "vscode-jsonrpc";
import { AbstractMessageWriter } from "vscode-jsonrpc/lib/messageWriter";
import { AbstractMessageReader } from "vscode-jsonrpc/lib/messageReader";
import { JsonRpcProxyFactory, JsonRpcProxy } from "../proxy-factory";
import { ConnectionEventHandler, ConnectionHandler } from "../handler";
import ReconnectingWebSocket, { Event } from 'reconnecting-websocket';

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
                onConnection: c => factory.listen(c),
            }, {
                onTransportDidClose: () => factory.fireConnectionClosed(),
                onTransportDidOpen: () => factory.fireConnectionOpened(),
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
    listen(handler: ConnectionHandler, eventHandler: ConnectionEventHandler, options?: WebSocketOptions): WebSocket {
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
        doListen(
            webSocket as any as ReconnectingWebSocket,
            handler,
            eventHandler,
            logger,
        );
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

// The following was extracted from vscode-ws-jsonrpc to make these changes:
//  - switch from WebSocket to ReconnectingWebSocket
//  - webSocket.onopen: making sure it's only ever called once so we're re-using MessageConnection
//  - WebSocketMessageWriter: buffer and re-try messages instead of throwing an error immidiately
//  - WebSocketMessageReader: don't close MessageConnection on 'socket.onclose'
function doListen(resocket: ReconnectingWebSocket, handler: ConnectionHandler, eventHandler: ConnectionEventHandler, logger: Logger) {
    resocket.addEventListener("close", () => eventHandler.onTransportDidClose());

    let alreadyOpened = false;
    resocket.onopen = () => {
        // trigerr "open" every time we re-open the underlying websocket
        eventHandler.onTransportDidOpen();

        // make sure we're only ever creating one MessageConnection, irregardless of how many times we have to re-open the underlying (reconnecting) websocket
        if (alreadyOpened) {
            return;
        }
        alreadyOpened = true;

        const connection = createWebSocketConnection(resocket, logger);
        handler.onConnection(connection);
    };
}

function createWebSocketConnection(resocket: ReconnectingWebSocket, logger: Logger) {
    const socket = toSocket(resocket as any);
    const messageReader = new NonClosingWebSocketMessageReader(socket);
    const messageWriter = new BufferingWebSocketMessageWriter(resocket, logger);
    const connection = createMessageConnection(messageReader, messageWriter, logger);
    connection.onClose(() => connection.dispose());
    return connection;
}

/**
 * This takes vscode-ws-jsonrpc/lib/socket/writer/WebSocketMessageWriter and adds a buffer
 */
class BufferingWebSocketMessageWriter extends AbstractMessageWriter {
    protected readonly socket: ReconnectingWebSocket;
    protected readonly logger: Logger;
    protected errorCount: number = 0;

    protected buffer: any[] = [];

    constructor(socket: ReconnectingWebSocket, logger: Logger) {
        super();
        this.socket = socket;
        this.logger = logger;

        socket.addEventListener("open", (event: Event) => this.flushBuffer());
    }

    write(msg: any) {
        if (this.socket.readyState !== ReconnectingWebSocket.OPEN) {
            this.bufferMsg(msg);
            return;
        }

        try {
            const content = JSON.stringify(msg);
            this.socket.send(content);
        } catch (e) {
            this.errorCount++;
            this.fireError(e, msg, this.errorCount);

            this.bufferMsg(msg);
        }
    }

    protected flushBuffer() {
        if (this.buffer.length === 0) {
            return
        }

        const buffer = [...this.buffer];
        this.buffer = [];
        for (const msg of buffer) {
            this.write(msg);
        }
        //this.logger.info(`flushed buffer (${this.buffer.length})`)
    }

    protected bufferMsg(msg: any) {
        this.buffer.push(msg);
        //this.logger.info(`buffered message (${this.buffer.length})`);
    }
}


/**
 * This takes vscode-ws-jsonrpc/lib/socket/reader/WebSocketMessageReader and removes the "onClose -> fireClose" connection
 */
class NonClosingWebSocketMessageReader extends AbstractMessageReader {
    protected readonly socket: IWebSocket;
    protected readonly events: any[] = [];
    protected state: 'initial' | 'listening' | 'closed' = 'initial';
    protected callback: (message: any) => void = () => {};

    constructor(socket: IWebSocket) {
        super();
        this.socket = socket;
        this.socket.onMessage(message => this.readMessage(message));
        this.socket.onError(error => this.fireError(error));
        this.socket.onClose((code, reason) => {
            if (code !== 1000) {
                const error = {
                    name: '' + code,
                    message: `Error during socket reconnect: code = ${code}, reason = ${reason}`
                };
                this.fireError(error);
            }
            // this.fireClose();        // <-- reason for this class to be copied over
        });
    }
    listen(callback: (message: any) => void) {
        if (this.state === 'initial') {
            this.state = 'listening';
            this.callback = callback;
            while (this.events.length !== 0) {
                const event = this.events.pop();
                if (event.message) {
                    this.readMessage(event.message);
                }
                else if (event.error) {
                    this.fireError(event.error);
                }
                else {
                    this.fireClose();
                }
            }
        }
    }
    readMessage(message: any) {
        if (this.state === 'initial') {
            this.events.splice(0, 0, { message });
        }
        else if (this.state === 'listening') {
            const data = JSON.parse(message);
            this.callback(data);
        }
    }
    fireError(error: any) {
        if (this.state === 'initial') {
            this.events.splice(0, 0, { error });
        }
        else if (this.state === 'listening') {
            super.fireError(error);
        }
    }
    fireClose() {
        if (this.state === 'initial') {
            this.events.splice(0, 0, {});
        }
        else if (this.state === 'listening') {
            super.fireClose();
        }
        this.state = 'closed';
    }
}
