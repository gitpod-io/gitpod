/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import ReconnectingWebSocket from 'reconnecting-websocket';
import { Disposable } from '@gitpod/gitpod-protocol/lib/util/disposable';

let connected = false;
const workspaceSockets = new Set<IDEWebSocket>();

const workspaceOrigin = new URL(window.location.href).origin;
const WebSocket = window.WebSocket;
function isWorkspaceOrigin(url: string): boolean {
    const originUrl = new URL(url);
    originUrl.protocol = window.location.protocol;
    return originUrl.origin === workspaceOrigin;
}
/**
 * IDEWebSocket is a proxy to standard WebSocket
 * which allows to control when web sockets to the workspace
 * should be opened or closed.
 * It should not deviate from standard WebSocket in any other way.
 */
class IDEWebSocket extends ReconnectingWebSocket {
    constructor(url: string, protocol?: string | string[]) {
        super(url, protocol, {
            WebSocket,
            startClosed: isWorkspaceOrigin(url) && !connected,
            maxRetries: 0,
            connectionTimeout: 2147483647 // disable connection timeout, clients should handle it
        });
        if (isWorkspaceOrigin(url)) {
            workspaceSockets.add(this);
            this.addEventListener('close', () => {
                workspaceSockets.delete(this);
            });
        }
    }
    static disconnectWorkspace(): void {
        for (const socket of workspaceSockets) {
            socket.close();
        }
    }
}

export function install(): void {
    window.WebSocket = IDEWebSocket as any;
}

export function connectWorkspace(): Disposable {
    if (connected) {
        return Disposable.NULL;
    }
    connected = true;
    for (const socket of workspaceSockets) {
        socket.reconnect();
    }
    return Disposable.create(() => disconnectWorkspace());
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