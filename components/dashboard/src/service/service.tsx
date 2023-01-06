/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    GitpodClient,
    GitpodServer,
    GitpodServerPath,
    GitpodService,
    GitpodServiceImpl,
} from "@gitpod/gitpod-protocol";
import { WebSocketConnectionProvider } from "@gitpod/gitpod-protocol/lib/messaging/browser/connection";
import { createWindowMessageConnection } from "@gitpod/gitpod-protocol/lib/messaging/browser/window-connection";
import { JsonRpcProxyFactory } from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

export const gitpodHostUrl = new GitpodHostUrl(window.location.toString());

function createGitpodService<C extends GitpodClient, S extends GitpodServer>() {
    let host = gitpodHostUrl.asWebsocket().with({ pathname: GitpodServerPath }).withApi();

    const connectionProvider = new WebSocketConnectionProvider();
    let numberOfErrors = 0;
    let onReconnect = () => {};
    const proxy = connectionProvider.createProxy<S>(host.toString(), undefined, {
        onerror: (event: any) => {
            log.error(event);
            if (numberOfErrors++ === 5) {
                alert(
                    "We are having trouble connecting to the server.\nEither you are offline or websocket connections are blocked.",
                );
            }
        },
        onListening: (socket) => {
            onReconnect = () => socket.reconnect();
        },
    });

    const service = new GitpodServiceImpl<C, S>(proxy, { onReconnect });

    createIDEFrontendGitpodService(service);
    return service;
}

function createIDEFrontendGitpodService<C extends GitpodClient, S extends GitpodServer>(
    service: GitpodServiceImpl<C, S>,
) {
    if (window.top === window.self || process.env.NODE_ENV !== "production") {
        return;
    }
    console.log("=================createIDEFrontendGitpodService");
    const frameWindow = window.parent;
    const connection = createWindowMessageConnection("gitpodServer", frameWindow, "*");
    // TODO: add method white list
    const factory = new JsonRpcProxyFactory<C>(service.server);
    service.registerClient(factory.createProxy());
    connection.onRequest("$reconnectServer", () => service.reconnect());

    const wsUrl = GitpodHostUrl.fromWorkspaceUrl(window.location.href);

    const listenToInstance = async () => {
        if (!wsUrl.workspaceId) {
            throw new Error(`Failed to extract a workspace id from '${wsUrl.toString()}'.`);
        }
        const listener = await service.listenToInstance(wsUrl.workspaceId);
        if (listener.info.latestInstance) {
            wsAuth(listener.info.latestInstance.id);
        } else {
            const authListener = listener.onDidChange(() => {
                if (listener.info.latestInstance) {
                    authListener.dispose();
                    pendingWSAuth = wsAuth(listener.info.latestInstance.id);
                }
            });
        }
    };

    let pendingWSAuth: Promise<boolean> | undefined;
    const wsAuth = async (instanceID: string) => {
        const url = wsUrl.asStart().asWorkspaceAuth(instanceID).toString();
        const response = await fetch(url, {
            credentials: "include",
        });
        alert(`pendingWSAuth- ${instanceID} -${response.ok}`);
        return response.ok;
    };

    listenToInstance();

    connection.onRequest("$fetchWorkspaceCookie", async (t) => {
        alert(JSON.stringify(t, null, 4) + "=========fetchWorkspaceCookie");
        if (!pendingWSAuth) {
            pendingWSAuth = wsAuth(t.instanceID);
        }
        return await pendingWSAuth;
    });
    factory.listen(connection);
}

function getGitpodService(): GitpodService {
    const w = window as any;
    const _gp = w._gp || (w._gp = {});
    if (window.location.search.includes("service=mock")) {
        const service = _gp.gitpodService || (_gp.gitpodService = require("./service-mock").gitpodServiceMock);
        return service;
    }
    const service = _gp.gitpodService || (_gp.gitpodService = createGitpodService());
    return service;
}

export { getGitpodService };
