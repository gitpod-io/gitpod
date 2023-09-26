/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    Emitter,
    GitpodClient,
    GitpodServer,
    GitpodServerPath,
    GitpodService,
    GitpodServiceImpl,
    User,
    WorkspaceInfo,
} from "@gitpod/gitpod-protocol";
import { WebSocketConnectionProvider } from "@gitpod/gitpod-protocol/lib/messaging/browser/connection";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { IDEFrontendDashboardService } from "@gitpod/gitpod-protocol/lib/frontend-dashboard-service";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import { helloService } from "./public-api";
import { getExperimentsClient } from "../experiments/client";
import { ConnectError, Code } from "@bufbuild/connect";
import { instrumentWebSocket } from "./metrics";

export const gitpodHostUrl = new GitpodHostUrl(window.location.toString());

function createGitpodService<C extends GitpodClient, S extends GitpodServer>() {
    let host = gitpodHostUrl.asWebsocket().with({ pathname: GitpodServerPath }).withApi();

    const connectionProvider = new WebSocketConnectionProvider();
    instrumentWebSocketConnection(connectionProvider);
    let numberOfErrors = 0;
    let onReconnect = () => {};
    const proxy = connectionProvider.createProxy<S>(host.toString(), undefined, {
        onerror: (event: any) => {
            log.error(event);
            // don't show alert if dashboard is inside iframe (workspace origin)
            if (window.top !== window.self && process.env.NODE_ENV === "production") {
                return;
            }
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

    return new GitpodServiceImpl<C, S>(proxy, { onReconnect });
}

function instrumentWebSocketConnection(connectionProvider: WebSocketConnectionProvider): void {
    const originalCreateWebSocket = connectionProvider["createWebSocket"];
    connectionProvider["createWebSocket"] = (url: string) => {
        return originalCreateWebSocket.call(
            connectionProvider,
            url,
            new Proxy(WebSocket, {
                construct(target: any, argArray) {
                    const webSocket = new target(...argArray);
                    instrumentWebSocket(webSocket, "gitpod");
                    return webSocket;
                },
            }),
        );
    };
}

export function getGitpodService(): GitpodService {
    const w = window as any;
    const _gp = w._gp || (w._gp = {});
    if (window.location.search.includes("service=mock")) {
        const service = _gp.gitpodService || (_gp.gitpodService = require("./service-mock").gitpodServiceMock);
        return service;
    }
    let service = _gp.gitpodService;
    if (!service) {
        service = _gp.gitpodService = createGitpodService();
        testPublicAPI(service);
    }
    return service;
}

/**
 * Emulates getWorkspace calls and listen to workspace statuses with Public API.
 * // TODO(ak): remove after reliability of Public API is confirmed
 */
function testPublicAPI(service: any): void {
    let user: any;
    service.server = new Proxy(service.server, {
        get(target, propKey) {
            return async function (...args: any[]) {
                if (propKey === "getLoggedInUser") {
                    user = await target[propKey](...args);
                    return user;
                }
                if (propKey === "getWorkspace") {
                    try {
                        return await target[propKey](...args);
                    } finally {
                        const grpcType = "unary";
                        // emulates frequent unary calls to public API
                        const isTest = await getExperimentsClient().getValueAsync(
                            "public_api_dummy_reliability_test",
                            false,
                            {
                                user,
                                gitpodHost: window.location.host,
                            },
                        );
                        if (isTest) {
                            helloService.sayHello({}).catch((e) => {
                                console.error(e, {
                                    userId: user?.id,
                                    workspaceId: args[0],
                                    grpcType,
                                });
                            });
                        }
                    }
                }
                return target[propKey](...args);
            };
        },
    });
    (async () => {
        const grpcType = "server-stream";
        const MAX_BACKOFF = 60000;
        const BASE_BACKOFF = 3000;
        let backoff = BASE_BACKOFF;

        // emulates server side streaming with public API
        while (true) {
            const isTest =
                !!user &&
                (await getExperimentsClient().getValueAsync("public_api_dummy_reliability_test", false, {
                    user,
                    gitpodHost: window.location.host,
                }));
            if (isTest) {
                try {
                    let previousCount = 0;
                    for await (const reply of helloService.lotsOfReplies(
                        { previousCount },
                        {
                            // GCP timeout is 10 minutes, we timeout 3 mins earlier
                            // to avoid unknown network errors
                            timeoutMs: 7 * 60 * 1000,
                        },
                    )) {
                        previousCount = reply.count;
                        backoff = BASE_BACKOFF;
                    }
                } catch (e) {
                    if (e instanceof ConnectError && e.code === Code.DeadlineExceeded) {
                        // timeout is expected, continue as usual
                        backoff = BASE_BACKOFF;
                    } else {
                        backoff = Math.min(2 * backoff, MAX_BACKOFF);
                        console.error(e, {
                            userId: user?.id,
                            grpcType,
                        });
                    }
                }
            } else {
                backoff = BASE_BACKOFF;
            }
            const jitter = Math.random() * 0.3 * backoff;
            const delay = backoff + jitter;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    })();
}
let ideFrontendService: IDEFrontendService | undefined;
export function getIDEFrontendService(workspaceID: string, sessionId: string, service: GitpodService) {
    if (!ideFrontendService) {
        ideFrontendService = new IDEFrontendService(workspaceID, sessionId, service, window.parent);
    }
    return ideFrontendService;
}

export class IDEFrontendService implements IDEFrontendDashboardService.IServer {
    private instanceID: string | undefined;
    private ownerId: string | undefined;
    private user: User | undefined;
    private ideCredentials!: string;

    private latestInfo?: IDEFrontendDashboardService.Status;

    private readonly onDidChangeEmitter = new Emitter<IDEFrontendDashboardService.SetStateData>();
    readonly onSetState = this.onDidChangeEmitter.event;

    constructor(
        private workspaceID: string,
        private sessionId: string,
        private service: GitpodService,
        private clientWindow: Window,
    ) {
        this.processServerInfo();
        window.addEventListener("message", (event: MessageEvent) => {
            if (IDEFrontendDashboardService.isTrackEventData(event.data)) {
                this.trackEvent(event.data.msg);
            }
            if (IDEFrontendDashboardService.isHeartbeatEventData(event.data)) {
                this.activeHeartbeat();
            }
            if (IDEFrontendDashboardService.isSetStateEventData(event.data)) {
                this.onDidChangeEmitter.fire(event.data.state);
            }
            if (IDEFrontendDashboardService.isOpenDesktopIDE(event.data)) {
                this.openDesktopIDE(event.data.url);
            }
        });
        window.addEventListener("unload", () => {
            if (!this.instanceID) {
                return;
            }
            if (this.ownerId !== this.user?.id) {
                return;
            }
            // send last heartbeat (wasClosed: true)
            const data = { sessionId: this.sessionId };
            const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
            const gitpodHostUrl = new GitpodHostUrl(window.location.toString());
            const url = gitpodHostUrl.withApi({ pathname: `/auth/workspacePageClose/${this.instanceID}` }).toString();
            navigator.sendBeacon(url, blob);
        });
    }

    private async processServerInfo() {
        const [user, listener, ideCredentials] = await Promise.all([
            this.service.server.getLoggedInUser(),
            this.service.listenToInstance(this.workspaceID),
            this.service.server.getIDECredentials(this.workspaceID),
        ]);
        this.user = user;
        this.ideCredentials = ideCredentials;
        const reconcile = () => {
            const info = this.parseInfo(listener.info);
            this.latestInfo = info;
            const oldInstanceID = this.instanceID;
            this.instanceID = info.instanceId;
            this.ownerId = info.ownerId;

            if (info.instanceId && oldInstanceID !== info.instanceId) {
                this.auth();
            }

            // TODO(hw): to be removed after IDE deployed
            this.sendStatusUpdate(this.latestInfo);
            // TODO(hw): end of todo
            this.sendInfoUpdate(this.latestInfo);
        };
        reconcile();
        listener.onDidChange(reconcile);
    }

    private parseInfo(workspace: WorkspaceInfo): IDEFrontendDashboardService.Info {
        return {
            loggedUserId: this.user!.id,
            workspaceID: this.workspaceID,
            instanceId: workspace.latestInstance?.id,
            ideUrl: workspace.latestInstance?.ideUrl,
            statusPhase: workspace.latestInstance?.status.phase,
            workspaceDescription: workspace.workspace.description,
            workspaceType: workspace.workspace.type,
            credentialsToken: this.ideCredentials,
            ownerId: workspace.workspace.ownerId,
        };
    }

    // implements

    private async auth() {
        if (!this.instanceID) {
            return;
        }
        const url = gitpodHostUrl.asWorkspaceAuth(this.instanceID).toString();
        await fetch(url, {
            credentials: "include",
        });
    }

    private trackEvent(msg: RemoteTrackMessage): void {
        msg.properties = {
            ...msg.properties,
            sessionId: this.sessionId,
            instanceId: this.latestInfo?.instanceId,
            workspaceId: this.workspaceID,
            type: this.latestInfo?.workspaceType,
        };
        this.service.server.trackEvent(msg);
    }

    private activeHeartbeat(): void {
        if (this.instanceID) {
            this.service.server.sendHeartBeat({ instanceId: this.instanceID });
        }
    }

    openDesktopIDE(url: string): void {
        let redirect = false;
        try {
            const desktopLink = new URL(url);
            // allow to redirect only for whitelisted trusted protocols
            // IDE-69
            const trustedProtocols = ["vscode:", "vscode-insiders:", "jetbrains-gateway:"];
            redirect = trustedProtocols.includes(desktopLink.protocol);
        } catch (e) {
            console.error("invalid desktop link:", e);
        }
        // redirect only if points to desktop application
        // don't navigate browser to another page
        if (redirect) {
            window.location.href = url;
        } else {
            window.open(url, "_blank", "noopener");
        }
    }

    // TODO(hw): to be removed after IDE deployed
    sendStatusUpdate(status: IDEFrontendDashboardService.Status): void {
        this.clientWindow.postMessage(
            {
                version: 1,
                type: "ide-status-update",
                status,
            } as IDEFrontendDashboardService.StatusUpdateEventData,
            "*",
        );
    }
    // TODO(hw): end of todo

    sendInfoUpdate(info: IDEFrontendDashboardService.Info): void {
        this.clientWindow.postMessage(
            {
                version: 1,
                type: "ide-info-update",
                info,
            } as IDEFrontendDashboardService.InfoUpdateEventData,
            "*",
        );
    }

    relocate(url: string): void {
        this.clientWindow.postMessage(
            { type: "ide-relocate", url } as IDEFrontendDashboardService.RelocateEventData,
            "*",
        );
    }

    openBrowserIDE(): void {
        this.clientWindow.postMessage({ type: "ide-open-browser" } as IDEFrontendDashboardService.OpenBrowserIDE, "*");
    }
}
