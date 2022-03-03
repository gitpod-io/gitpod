/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Message } from 'vscode-jsonrpc/lib/messages';
import { AbstractMessageWriter, MessageWriter } from 'vscode-jsonrpc/lib/messageWriter';
import { AbstractMessageReader, MessageReader, DataCallback } from 'vscode-jsonrpc/lib/messageReader';
import { MessageConnection, createMessageConnection } from 'vscode-jsonrpc/lib/main';
import { ConsoleLogger } from 'vscode-ws-jsonrpc';

interface WindowMessage extends Message {
    serviceId: string;
}
function isWindowMessage(value: any): value is WindowMessage {
    return (
        !!value &&
        typeof value === 'object' &&
        'jsonrpc' in value &&
        typeof value['jsonrpc'] === 'string' &&
        'serviceId' in value &&
        typeof value['serviceId'] === 'string'
    );
}

export class WindowMessageWriter extends AbstractMessageWriter implements MessageWriter {
    constructor(readonly serviceId: string, readonly window: Window, readonly targetOrigin: string) {
        super();
    }

    write(msg: Message): void {
        const { serviceId } = this;
        this.window.postMessage(Object.assign(msg, { serviceId }), this.targetOrigin);
    }
}

export class WindowMessageReader extends AbstractMessageReader implements MessageReader {
    protected callback?: DataCallback;
    protected readonly buffer: Message[] = [];

    constructor(readonly serviceId: string, readonly sourceOrigin: string) {
        super();
        window.addEventListener(
            'message',
            (event) => {
                if (this.sourceOrigin !== '*' && event.origin !== this.sourceOrigin) {
                    return;
                }
                if (!isWindowMessage(event.data) || event.data.serviceId !== this.serviceId) {
                    return;
                }
                if (this.callback) {
                    this.callback(event.data);
                } else {
                    this.buffer.push(event.data);
                }
            },
            false,
        );
    }

    listen(callback: DataCallback): void {
        let message;
        while ((message = this.buffer.pop())) {
            callback(message);
        }
        Object.freeze(this.buffer);
        this.callback = callback;
    }
}

export function createWindowMessageConnection(
    serviceId: string,
    window: Window,
    sourceOrigin: string,
    targetOrigin = sourceOrigin,
): MessageConnection {
    const reader = new WindowMessageReader(serviceId, sourceOrigin);
    const writer = new WindowMessageWriter(serviceId, window, targetOrigin);
    return createMessageConnection(reader, writer, new ConsoleLogger());
}
