/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodClient, GitpodServer, GitpodServerPath, GitpodService, GitpodServiceImpl, User } from '@gitpod/gitpod-protocol';
import { WebSocketConnectionProvider } from '@gitpod/gitpod-protocol/lib/messaging/browser/connection';
import { createWindowMessageConnection } from '@gitpod/gitpod-protocol/lib/messaging/browser/window-connection';
import { JsonRpcProxy, JsonRpcProxyFactory } from '@gitpod/gitpod-protocol/lib/messaging/proxy-factory';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export const gitpodHostUrl = new GitpodHostUrl((window as any).PREVIEW_URL || window.location.toString());

function createGitpodService<C extends GitpodClient, S extends GitpodServer>() {
    let proxy: JsonRpcProxy<S>;
    if (window.top !== window.self) {
        const connection = createWindowMessageConnection('gitpodServer', window.parent, '*');
        const factory = new JsonRpcProxyFactory<S>();
        proxy = factory.createProxy();
        factory.listen(connection);
    } else {
        let host = gitpodHostUrl
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



export class AppService {
    constructor(protected gitpodService: GitpodService) {
    }

    protected userPromise: Promise<User> | undefined;
    async getOrLoadUser() {
        if (!this.userPromise) {
            this.userPromise = this.gitpodService.server.getLoggedInUser();
        }
        return this.userPromise;
    }
    async reloadUser() {
        this.userPromise = undefined;
        return this.getOrLoadUser();
    }

    async getAuthProviders() {
        return this.gitpodService.server.getAuthProviders();
    }

}

let gitpodService: GitpodService;
let service: AppService;

const reconnect = () => {
    gitpodService = createGitpodService();
    service = new AppService(gitpodService);
}

reconnect();

export { service, gitpodService, reconnect };