/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    createMessageConnection,
    IWebSocket,
    Logger,
    MessageConnection,
    WebSocketMessageReader,
    WebSocketMessageWriter,
} from "@codingame/monaco-jsonrpc";

export function createWebSocketConnection(socket: IWebSocket, logger: Logger): MessageConnection {
    const messageReader = new WebSocketMessageReaderSafe(socket);
    const messageWriter = new WebSocketMessageWriter(socket);
    const connection = createMessageConnection(messageReader, messageWriter, logger);
    connection.onClose(() => connection.dispose());
    return connection;
}

class WebSocketMessageReaderSafe extends WebSocketMessageReader {
    protected readMessage(message: any): void {
        try {
            super.readMessage(message);
        } catch (error) {
            console.error(error);
        }
    }
}
