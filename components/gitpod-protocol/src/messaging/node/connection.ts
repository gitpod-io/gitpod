/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as ws from "ws";
import * as http from "http";
import * as net from "net";
import { IWebSocket } from "vscode-ws-jsonrpc";
import { log } from '../../util/logging';

export interface OnOpen {
    (webSocket: ws, request: http.IncomingMessage, socket: net.Socket, head: Buffer): void;
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
