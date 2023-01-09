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
} from "@gitpod/gitpod-protocol";
import { WebSocketConnectionProvider } from "@gitpod/gitpod-protocol/lib/messaging/browser/connection";
import { createWindowMessageConnection } from "@gitpod/gitpod-protocol/lib/messaging/browser/window-connection";
import { JsonRpcProxyFactory } from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { IDEFrontendDashboardService } from "@gitpod/gitpod-protocol/lib/frontend-dashboard-service";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";

export const gitpodHostUrl = new GitpodHostUrl(window.location.toString());

function createGitpodService<C extends GitpodClient, S extends GitpodServer>() {
    if (window.top !== window.self && process.env.NODE_ENV === "production") {
        const connection = createWindowMessageConnection("gitpodServer", window.parent, "*");
        const factory = new JsonRpcProxyFactory<S>();
        const proxy = factory.createProxy();
        factory.listen(connection);
        return new GitpodServiceImpl<C, S>(proxy, {
            onReconnect: async () => {
                await connection.sendRequest("$reconnectServer");
            },
        });
    }
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

    if (window.top !== window.self && process.env.NODE_ENV === "production") {
        getIDEFrontendService(service);
    }

    return service;
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

let ideFrontendService: IDEFrontendService | undefined;
function getIDEFrontendService(service: GitpodService) {
    if (!ideFrontendService) {
        ideFrontendService = new IDEFrontendService(service, window.parent);
    }
    return ideFrontendService;
}

class IDEFrontendService implements IDEFrontendDashboardService.IServer {
    private workspaceID: string;
    private instanceID: string | undefined;
    private user: User | undefined;

    private latestStatus?: IDEFrontendDashboardService.Status;

    private readonly onDidChangeEmitter = new Emitter<IDEFrontendDashboardService.SetStateData>();
    readonly onSetState = this.onDidChangeEmitter.event;

    getWindowWorkspaceID() {}

    constructor(private service: GitpodService, private clientWindow: Window) {
        if (!gitpodHostUrl.workspaceId) {
            throw new Error("no workspace id");
        }
        this.workspaceID = gitpodHostUrl.workspaceId;
        this.processInfo();
        this.processInstanceUpdate();
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
        });
    }

    async processInfo() {
        this.user = await this.service.server.getLoggedInUser();
        if (this.latestStatus) {
            this.latestStatus.loggedUserId = this.user.id;
            this.sendStatusUpdate(this.latestStatus);
        }
        const workspace = await this.service.server.getWorkspace(this.workspaceID);
        this.instanceID = workspace.latestInstance?.id;
        if (this.instanceID) {
            this.auth();
        }
    }

    async processInstanceUpdate() {
        const listener = await this.service.listenToInstance(this.workspaceID);
        listener.onDidChange(() => {
            const status: IDEFrontendDashboardService.Status = {
                loggedUserId: this.user!.id,
                workspaceID: this.workspaceID,
                instanceId: listener.info.latestInstance?.id,
                ideUrl: listener.info.latestInstance?.ideUrl,
                statusPhase: listener.info.latestInstance?.status.phase,
                workspaceDescription: listener.info.workspace.description,
                workspaceType: listener.info.workspace.type,
            };
            this.latestStatus = status;
            if (this.instanceID !== status.instanceId) {
                this.auth();
            }
            this.instanceID = status.instanceId;
            this.sendStatusUpdate(this.latestStatus);
        });
    }

    // implements

    async auth() {
        if (!this.instanceID) {
            return;
        }
        const url = gitpodHostUrl.asStart().asWorkspaceAuth(this.instanceID).toString();
        await fetch(url, {
            credentials: "include",
        });
    }

    trackEvent(msg: RemoteTrackMessage): void {
        console.log(">>>>>>>>> on trackEvent");
        msg.properties = {
            ...msg.properties,
            instanceId: this.latestStatus?.instanceId,
            workspaceId: this.workspaceID,
            type: this.latestStatus?.workspaceType,
        };
        this.service.server.trackEvent(msg);
    }
    activeHeartbeat(): void {
        console.log(">>>>>>>>> on activeHeartbeat");
        if (this.instanceID) {
            this.service.server.sendHeartBeat({ instanceId: this.instanceID });
        }
    }
    sendStatusUpdate(status: IDEFrontendDashboardService.Status): void {
        console.log("<<<<<<<<< send sendStatusUpdate");
        this.clientWindow.postMessage({
            type: "ide-status-update",
            status,
        } as IDEFrontendDashboardService.StatusUpdateEventData);
    }
    relocate(url: string): void {
        console.log("<<<<<<<<< send relocate");
        this.clientWindow.postMessage({ type: "ide-relocate", url } as IDEFrontendDashboardService.RelocateEventData);
    }

    setSessionID(sessionID: string): void {
        console.log("<<<<<<<<< send setSessionID");
        this.clientWindow.postMessage({
            type: "ide-set-session-id",
            sessionID,
        } as IDEFrontendDashboardService.SetSessionIDEventData);
    }
}

export { getGitpodService, getIDEFrontendService };
