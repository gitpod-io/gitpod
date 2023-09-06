/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as ws from "ws";
import {
    IWebSocket,
    Logger,
    WebSocketMessageReader,
    WebSocketMessageWriter,
    createMessageConnection,
} from "vscode-ws-jsonrpc";
import { log } from "../../util/logging";

export function toIWebSocket(ws: ws) {
    return <IWebSocket>{
        send: (content) => {
            if (ws.readyState >= ws.CLOSING) {
                // ws is already CLOSING/CLOSED, send() would just return an error.
                return;
            }

            // in general send-errors should trigger an 'error' event already, we just make sure it actually happens.
            try {
                ws.send(content, (err) => {
                    if (!err) {
                        return;
                    }
                    ws.emit("error", err);
                });
            } catch (err) {
                ws.emit("error", err);
            }
        },
        onMessage: (cb) => ws.on("message", cb),
        onError: (cb) => ws.on("error", cb),
        onClose: (cb) => ws.on("close", cb),
        dispose: () => {
            if (ws.readyState < ws.CLOSING) {
                ws.close();
            }
        },
    };
}

// copied from /node_modules/vscode-ws-jsonrpc/lib/socket/connection.js
export function createWebSocketConnection(socket: IWebSocket, logger: Logger) {
    const messageReader = new SafeWebSocketMessageReader(socket);
    const messageWriter = new WebSocketMessageWriter(socket);
    const connection = createMessageConnection(messageReader, messageWriter, logger);
    connection.onClose(() => connection.dispose());
    return connection;
}

class SafeWebSocketMessageReader extends WebSocketMessageReader {
    protected readMessage(message: any): void {
        try {
            super.readMessage(message);
        } catch (error) {
            log.debug("Failed to decode JSON-RPC message.", error);
        }
    }
}
