/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as ws from "ws";
import { IWebSocket } from "vscode-ws-jsonrpc";

export function toIWebSocket(ws: ws) {
    return <IWebSocket>{
        send: content => {
            if (ws.readyState >= ws.CLOSING) {
                // ws is already CLOSING/CLOSED, send() would just return an error.
                return;
            }

            // in general send-errors should trigger an 'error' event already, we just make sure it actually happens.
            try {
                ws.send(content, err => {
                    if (!err) {
                        return;
                    }
                    ws.emit('error', err);
                });
            } catch (err) {
                ws.emit('error', err);
            }
        },
        onMessage: cb => ws.on('message', cb),
        onError: cb => ws.on('error', cb),
        onClose: cb => ws.on('close', cb),
        dispose: () => {
            if (ws.readyState < ws.CLOSING) {
                ws.close();
            }
        }
    };
}
