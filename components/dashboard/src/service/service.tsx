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

    return new GitpodServiceImpl<C, S>(proxy, { onReconnect });
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
            // send last heartbeat (wasClosed: true)
            const data = { sessionId: this.sessionId };
            const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
            const gitpodHostUrl = new GitpodHostUrl(new URL(window.location.toString()));
            const url = gitpodHostUrl.withApi({ pathname: `/auth/workspacePageClose/${this.instanceID}` }).toString();
            navigator.sendBeacon(url, blob);
        });
    }

    private async processServerInfo() {
        this.user = await this.service.server.getLoggedInUser();

        const listener = await this.service.listenToInstance(this.workspaceID);
        const reconcile = () => {
            const status = this.getWorkspaceStatus(listener.info);
            this.latestStatus = status;
            const oldInstanceID = this.instanceID;
            this.instanceID = status.instanceId;
            if (status.instanceId && oldInstanceID !== status.instanceId) {
                this.auth();
            }
            this.sendStatusUpdate(this.latestStatus);
        };
        reconcile();
        listener.onDidChange(reconcile);
    }

    private getWorkspaceStatus(workspace: WorkspaceInfo): IDEFrontendDashboardService.Status {
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
            instanceId: this.latestStatus?.instanceId,
            workspaceId: this.workspaceID,
            type: this.latestStatus?.workspaceType,
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
            redirect = desktopLink.protocol !== "http:" && desktopLink.protocol !== "https:";
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
