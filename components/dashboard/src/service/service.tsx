/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodClient, GitpodServer, GitpodServerPath, GitpodService, GitpodServiceImpl } from '@gitpod/gitpod-protocol';
import { WebSocketConnectionProvider } from '@gitpod/gitpod-protocol/lib/messaging/browser/connection';
import { createWindowMessageConnection } from '@gitpod/gitpod-protocol/lib/messaging/browser/window-connection';
import { JsonRpcProxyFactory } from '@gitpod/gitpod-protocol/lib/messaging/proxy-factory';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export const gitpodHostUrl = new GitpodHostUrl(window.location.toString());


function createGitpodService<C extends GitpodClient, S extends GitpodServer>() {
    if (window.top !== window.self && process.env.NODE_ENV === 'production') {
        const connection = createWindowMessageConnection('gitpodServer', window.parent, '*');
        const factory = new JsonRpcProxyFactory<S>();
        const proxy = factory.createProxy();
        factory.listen(connection);
        return new GitpodServiceImpl<C, S>(proxy, {
            onReconnect: async () => {
                await connection.sendRequest('$reconnectServer');
            }
        });
    }
    let host = gitpodHostUrl
        .asWebsocket()
        .with({ pathname: GitpodServerPath })
        .withApi();

    const connectionProvider = new WebSocketConnectionProvider();
    let numberOfErrors = 0;
    let onReconnect = () => { };
    const proxy = connectionProvider.createProxy<S>(host.toString(), undefined, {
        onerror: (event: any) => {
            log.error(event);
            if (numberOfErrors++ === 5) {
                alert('We are having trouble connecting to the server.\nEither you are offline or websocket connections are blocked.');
            }
        },
        onListening: socket => {
            onReconnect = () => socket.reconnect()
        }
    });

    return new GitpodServiceImpl<C, S>(proxy, { onReconnect });
}

function getGitpodService(): GitpodService {
    const w = window as any;
    const _gp = w._gp || (w._gp = {});
    if (window.location.search.includes("service=mock")) {
        const service = _gp.gitpodService || (_gp.gitpodService = require('./service-mock').gitpodServiceMock);
        return service;
    }
    const service = _gp.gitpodService || (_gp.gitpodService = createGitpodService());
    return service;
}

export { getGitpodService }