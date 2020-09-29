/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import { WebSocketConnectionProvider } from '@gitpod/gitpod-protocol/lib/messaging/browser/connection';
import { GitpodServer, GitpodServerPath, GitpodServiceImpl, GitpodClient } from '@gitpod/gitpod-protocol';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { globalCache } from './util';
import { createWindowMessageConnection } from '@gitpod/gitpod-protocol/lib/messaging/browser/window-connection';
import { JsonRpcProxyFactory, JsonRpcProxy } from '@gitpod/gitpod-protocol/lib/messaging/proxy-factory';

export function createGitpodService<C extends GitpodClient, S extends GitpodServer>(): GitpodServiceImpl<C, S> {
    return globalCache('service', createGitpodServiceInternal) as GitpodServiceImpl<C, S>;
}

function createGitpodServiceInternal<C extends GitpodClient, S extends GitpodServer>() {
    let proxy: JsonRpcProxy<S>;
    if (window.top !== window.self) {
        const connection = createWindowMessageConnection('gitpodServer', window.parent, '*');
        const factory = new JsonRpcProxyFactory<S>();
        proxy = factory.createProxy();
        factory.listen(connection);
    } else {
        let host = new GitpodHostUrl(window.location.toString())
            .asWebsocket()
            .with({ pathname: GitpodServerPath })
            .withApi();

        const connectionProvider = new WebSocketConnectionProvider();
        let numberOfErrors = 0;
        proxy = connectionProvider.createProxy<S>(host.toString(), undefined, {
            onerror: (event: any) => {
                log.error(event);
                if (numberOfErrors++ === 5) {
                    alert('We are having trouble connecting to the server.\nEither you are offline or websocket connections are blocked.');
                }
            }
        });
    }
    const service = new GitpodServiceImpl<C, S>(proxy);
    return service;
}