/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodClient, GitpodServer, GitpodServerPath, GitpodServiceImpl } from '@gitpod/gitpod-protocol';
import { WebSocketConnectionProvider } from '@gitpod/gitpod-protocol/lib/messaging/browser/connection';
// import { createWindowMessageConnection } from '@gitpod/gitpod-protocol/lib/messaging/browser/window-connection';
import { JsonRpcProxy /* , JsonRpcProxyFactory */ } from '@gitpod/gitpod-protocol/lib/messaging/proxy-factory';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
// import { gitpodServiceMock } from './service-mock';

export const gitpodHostUrl = new GitpodHostUrl(window.location.toString());

function createGitpodService<C extends GitpodClient, S extends GitpodServer>() {
    let proxy: JsonRpcProxy<S>;
    let reconnect = () => {
        console.log("WebSocket reconnect not possible.");
    }
    // FIXME: https://gitpod.slack.com/archives/C01KGM9BUNS/p1615456669011600
    // if (window.top !== window.self) {
    //     const connection = createWindowMessageConnection('gitpodServer', window.parent, '*');
    //     const factory = new JsonRpcProxyFactory<S>();
    //     proxy = factory.createProxy();
    //     factory.listen(connection);
    // } else {
        let host = gitpodHostUrl
            .asWebsocket()
            .with({ pathname: GitpodServerPath })
            .withApi();

        const connectionProvider = new WebSocketConnectionProvider();
        let _websocket: any;
        const _createWebSocket = connectionProvider.createWebSocket;
        connectionProvider.createWebSocket = (url) => {
            return (_websocket = _createWebSocket(url));
        }


        let numberOfErrors = 0;
        proxy = connectionProvider.createProxy<S>(host.toString(), undefined, {
            onerror: (event: any) => {
                log.error(event);
                if (numberOfErrors++ === 5) {
                    alert('We are having trouble connecting to the server.\nEither you are offline or websocket connections are blocked.');
                }
            }
        });

        if (_websocket && "reconnect" in _websocket) {
            reconnect = () => { (_websocket as any).reconnect() };
        }
    // }
    const service = new GitpodServiceImpl<C, S>(proxy);
    (service as any).reconnect = reconnect;
    return service;
}

declare global {
    type GitpodService = ReturnType<typeof createGitpodService> & { reconnect: () => void }
    interface Window { gitpodService?: GitpodService; }
}

// reuse existing service object if present
let gitpodService: GitpodService = window.gitpodService || (window.gitpodService = createGitpodService() as GitpodService);
// let gitpodService: GitpodService = gitpodServiceMock;

export { gitpodService };