/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as ws from "ws";
import * as http from "http";
import * as https from "https";
import * as url from "url";
import * as net from "net";
import { MessageConnection } from "vscode-jsonrpc";
import { createWebSocketConnection, IWebSocket } from "vscode-ws-jsonrpc";
import { log } from '../../util/logging';

export interface IServerOptions {
    readonly server: http.Server | https.Server;
    readonly path?: string;
    matches?(request: http.IncomingMessage): boolean;
}

export function createServerWebSocketConnection(options: IServerOptions, onConnect: (connection: MessageConnection) => void): void {
    openJsonRpcSocket(options, socket => {
        onConnect(createWebSocketConnection(socket, console));
    });
}

export function openJsonRpcSocket(options: IServerOptions, onOpen: (socket: IWebSocket) => void): void {
    openSocket(options, socket => {
        const webSocket = toIWebSocket(socket);
        onOpen(webSocket);
    });
}

export interface OnOpen {
    (webSocket: ws, request: http.IncomingMessage, socket: net.Socket, head: Buffer): void;
}

export function openSocket(options: IServerOptions, onOpen: OnOpen): void {
    const wss = new ws.Server({
        noServer: true,
            perMessageDeflate: {
                // don't compress if a message is less than 256kb
                threshold: 256 * 1024
            }
    });
    options.server.on('upgrade', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
        const pathname = request.url ? url.parse(request.url).pathname : undefined;
        if (options.path && pathname === options.path || options.matches && options.matches(request)) {
            wss.handleUpgrade(request, socket, head, webSocket => {
                if (webSocket.readyState === webSocket.OPEN) {
                    onOpen(webSocket, request, socket, head);
                } else {
                    webSocket.on('open', () => onOpen(webSocket, request, socket, head));
                }
            });
        }
    });
}

export function toIWebSocket(webSocket: ws) {
    let sendsAfterOpen = 0;
    return <IWebSocket>{
        send: content => {
            if (webSocket.readyState !== ws.OPEN) {
                if (sendsAfterOpen++ > 3) {
                    //log.debug(`Repeated try to send on closed web socket (readyState was ${webSocket.readyState})`, { ws });
                }
                return;
            }
            webSocket.send(content, err => {
                if (err) {
                    log.error('error in ws.send()', err, { ws });
                }
            })
        },
        onMessage: cb => webSocket.on('message', cb),
        onError: cb => webSocket.on('error', cb),
        onClose: cb => webSocket.on('close', cb),
        dispose: () => {
            if (webSocket.readyState < ws.CLOSING) {
                webSocket.close();
            }
        }
    };
}
