/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import ReconnectingWebSocket from 'reconnecting-websocket';

let connected = false;
const workspaceSockets = new Set<IDEWebSocket>();

const workspaceOrigin = new URL(window.location.href).origin;
const WebSocket = window.WebSocket;
class IDEWebSocket extends ReconnectingWebSocket {
    constructor(url: string, protocol?: string | string[]) {
        super(url, protocol, {
            WebSocket,
            startClosed: true,
            maxRetries: 0
        });
        const originUrl = new URL(url);
        originUrl.protocol = window.location.protocol;
        if (originUrl.origin === workspaceOrigin) {
            workspaceSockets.add(this);
            this.addEventListener('close', () => {
                workspaceSockets.delete(this);
            });

            if (connected) {
                this.reconnect();
            }
        } else {
            this.reconnect();
        }
    }
}

export function install(): void {
    window.WebSocket = IDEWebSocket as any;
}

export function connectWorkspace(): void {
    if (connected) {
        return;
    }
    connected = true;
    for (const socket of workspaceSockets) {
        socket.reconnect();
    }
}

export function disconnectWorkspace(): void {
    if (!connected) {
        return;
    }
    connected = false;
    for (const socket of workspaceSockets) {
        socket.close();
    }
}