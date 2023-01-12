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
    return service;
}

export function getGitpodService(): GitpodService {
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
export function getIDEFrontendService(workspaceID: string, sessionId: string, service: GitpodService) {
    if (!ideFrontendService) {
        ideFrontendService = new IDEFrontendService(workspaceID, sessionId, service, window.parent);
    }
    return ideFrontendService;
}

export class IDEFrontendService implements IDEFrontendDashboardService.IServer {
    private instanceID: string | undefined;
    private ideUrl: URL | undefined;
    private user: User | undefined;

    private latestStatus?: IDEFrontendDashboardService.Status;

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
            if (event.origin !== this.ideUrl?.origin) {
                return;
            }

            if (IDEFrontendDashboardService.isTrackEventData(event.data)) {
                console.log("=============dashboard isTrackEventData", event.data);
                this.trackEvent(event.data.msg);
            }
            if (IDEFrontendDashboardService.isHeartbeatEventData(event.data)) {
                console.log("=============dashboard isHeartbeatEventData", event.data);
                this.activeHeartbeat();
            }
            if (IDEFrontendDashboardService.isSetStateEventData(event.data)) {
                console.log("=============dashboard isSetStateEventData", event.data);
                this.onDidChangeEmitter.fire(event.data.state);
            }
        });
        window.addEventListener("unload", () => {
            if (!this.instanceID) {
                return;
            }

            const data = { sessionId: this.sessionId };
            const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
            const gitpodHostUrl = new GitpodHostUrl(new URL(window.location.toString()));
            const url = gitpodHostUrl.withApi({ pathname: `/auth/workspacePageClose/${this.instanceID}` }).toString();
            navigator.sendBeacon(url, blob);
        });
    }

    private async processServerInfo() {
        this.user = await this.service.server.getLoggedInUser();
        const workspace = await this.service.server.getWorkspace(this.workspaceID);
        this.instanceID = workspace.latestInstance?.id;
        if (this.instanceID) {
            this.auth();
        }

        const listener = await this.service.listenToInstance(this.workspaceID);
        listener.onDidChange(() => {
            this.ideUrl = listener.info.latestInstance?.ideUrl
                ? new URL(listener.info.latestInstance?.ideUrl)
                : undefined;
            const status = this.getWorkspaceStatus(listener.info);
            this.latestStatus = status;
            this.sendStatusUpdate(this.latestStatus);
            if (this.instanceID !== status.instanceId) {
                this.instanceID = status.instanceId;
                this.auth();
            }
        });
    }

    getWorkspaceStatus(workspace: WorkspaceInfo): IDEFrontendDashboardService.Status {
        return {
            loggedUserId: this.user!.id,
            workspaceID: this.workspaceID,
            instanceId: workspace.latestInstance?.id,
            ideUrl: workspace.latestInstance?.ideUrl,
            statusPhase: workspace.latestInstance?.status.phase,
            workspaceDescription: workspace.workspace.description,
            workspaceType: workspace.workspace.type,
        };
    }

    // implements

    async auth() {
        if (!this.instanceID) {
            return;
        }
        const url = gitpodHostUrl.asWorkspaceAuth(this.instanceID).toString();
        await fetch(url, {
            credentials: "include",
        });
    }

    trackEvent(msg: RemoteTrackMessage): void {
        console.log("=========== dashboard on trackEvent");
        msg.properties = {
            ...msg.properties,
            sessionId: this.sessionId,
            instanceId: this.latestStatus?.instanceId,
            workspaceId: this.workspaceID,
            type: this.latestStatus?.workspaceType,
        };
        this.service.server.trackEvent(msg);
    }

    activeHeartbeat(): void {
        console.log("=========== dashboard on activeHeartbeat");
        if (this.instanceID) {
            this.service.server.sendHeartBeat({ instanceId: this.instanceID });
        }
    }

    sendStatusUpdate(status: IDEFrontendDashboardService.Status): void {
        if (!this.ideUrl) {
            console.log("=========== dashboard send sendStatusUpdate => NO ideUrl");
            return;
        }

        console.log("=========== dashboard send sendStatusUpdate");
        this.clientWindow.postMessage(
            {
                type: "ide-status-update",
                status,
            } as IDEFrontendDashboardService.StatusUpdateEventData,
            this.ideUrl.origin,
        );
    }

    relocate(url: string): void {
        if (!this.ideUrl) {
            console.log("=========== dashboard send relocate => NO ideUrl");
            return;
        }

        console.log("=========== dashboard send relocate");
        this.clientWindow.postMessage(
            { type: "ide-relocate", url } as IDEFrontendDashboardService.RelocateEventData,
            this.ideUrl.origin,
        );
    }
}
