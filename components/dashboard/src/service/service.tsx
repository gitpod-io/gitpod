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
        return new GitpodServiceImpl<C, S>(proxy);
    }
    let host = gitpodHostUrl
        .asWebsocket()
        .with({ pathname: GitpodServerPath })
        .withApi();

    const connectionProvider = new WebSocketConnectionProvider();
    let numberOfErrors = 0;
    const { proxy, webSocket } = connectionProvider.createProxy2<S>(host.toString(), undefined, {
        onerror: (event: any) => {
            log.error(event);
            if (numberOfErrors++ === 5) {
                alert('We are having trouble connecting to the server.\nEither you are offline or websocket connections are blocked.');
            }
        }
    });

    const service = new GitpodServiceImpl<C, S>(proxy);
    (service as any).reconnect = () => {
        const ws = (webSocket as any);
        if (typeof ws.reconnect === "function") {
            ws.reconnect();
        } else {
            console.log("WebSocket reconnect not possible.");
        }
    };
    return service;
}

function getGitpodService(): GitpodService {
    const w = window as any;
    const _gp = w._gp || (w._gp = {});
    const service = _gp.gitpodService || (_gp.gitpodService = createGitpodService());
    return service;
}

function reconnectGitpodService() {
    const service = getGitpodService() as any;
    if (service.reconnect) {
        service.reconnect();
    } else {
        console.error("WebSocket reconnect not possible.")
    }
}

export { getGitpodService, reconnectGitpodService }