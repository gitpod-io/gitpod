/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { startUrl } from "./urls";
import { WindowMessageReader, WindowMessageWriter } from "@gitpod/gitpod-protocol/lib/messaging/browser/window-connection";
import { MessageConnection, createMessageConnection } from 'vscode-jsonrpc/lib/main';
import { ConsoleLogger } from 'vscode-ws-jsonrpc';

const serverOrigin = new URL(startUrl).origin;
const relocateListener = (event: MessageEvent) => {
    if (event.origin === serverOrigin && event.data.type == 'relocate' && event.data.url) {
        window.removeEventListener('message', relocateListener);
        window.location.href = event.data.url;
    }
};
window.addEventListener('message', relocateListener, false);

export function load(): Promise<{
    frame: HTMLIFrameElement,
    connection: MessageConnection
}> {
    return new Promise(resolve => {
        const frame = document.createElement('iframe');
        frame.src = startUrl;
        frame.className = 'gitpod-frame loading';
        document.body.appendChild(frame);
        const reader = new WindowMessageReader('gitpodServer', serverOrigin);
        frame.onload = () => {
            const writer = new WindowMessageWriter('gitpodServer', frame.contentWindow!, serverOrigin);
            const connection = createMessageConnection(reader, writer, new ConsoleLogger())
            resolve({ frame, connection });
        }
    });
}
