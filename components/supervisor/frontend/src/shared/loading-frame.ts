/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { createGitpodService, GitpodClient } from '@gitpod/gitpod-protocol';
import { WindowMessageReader, WindowMessageWriter } from "@gitpod/gitpod-protocol/lib/messaging/browser/window-connection";
import { JsonRpcProxyFactory } from '@gitpod/gitpod-protocol/lib/messaging/proxy-factory';
import { createMessageConnection } from 'vscode-jsonrpc/lib/main';
import { ConsoleLogger } from 'vscode-ws-jsonrpc';
import { startUrl } from './urls';

const serverOrigin = startUrl.url.origin;
const relocateListener = (event: MessageEvent) => {
    if (event.origin === serverOrigin && event.data.type == 'relocate' && event.data.url) {
        window.removeEventListener('message', relocateListener);
        window.location.href = event.data.url;
    }
};
window.addEventListener('message', relocateListener, false);

export function load({ gitpodService }: {
    gitpodService: ReturnType<typeof createGitpodService>
}): Promise<{
    frame: HTMLIFrameElement
}> {
    return new Promise(resolve => {
        const frame = document.createElement('iframe');
        frame.src = startUrl.toString();
        frame.style.visibility = 'visible';
        frame.className = 'gitpod-frame loading';
        document.body.appendChild(frame);

        const factory = new JsonRpcProxyFactory<GitpodClient>(gitpodService.server);
        gitpodService.registerClient(factory.createProxy());
        const reader = new WindowMessageReader('gitpodServer', serverOrigin);
        frame.onload = () => {
            const writer = new WindowMessageWriter('gitpodServer', frame.contentWindow!, serverOrigin);
            const connection = createMessageConnection(reader, writer, new ConsoleLogger())
            factory.listen(connection);
            resolve({ frame });
        };
    });
}
