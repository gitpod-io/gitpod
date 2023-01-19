/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDEFrontendDashboardService } from "@gitpod/gitpod-protocol/lib/frontend-dashboard-service";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import { Emitter } from "@gitpod/gitpod-protocol/lib/util/event";
import { serverUrl } from "./urls";

export class FrontendDashboardServiceClient implements IDEFrontendDashboardService.IClient {
    public latestStatus!: IDEFrontendDashboardService.Status;

    private readonly onDidChangeEmitter = new Emitter<IDEFrontendDashboardService.Status>();
    readonly onStatusUpdate = this.onDidChangeEmitter.event;

    private readonly onOpenBrowserIDEEmitter = new Emitter<void>();
    readonly onOpenBrowserIDE = this.onOpenBrowserIDEEmitter.event;

    private resolveInit!: () => void;
    private initPromise = new Promise<void>((resolve) => (this.resolveInit = resolve));

    private version?: number;

    constructor(private serverWindow: Window) {
        window.addEventListener("message", (event: MessageEvent) => {
            if (event.origin !== serverUrl.url.origin) {
                return;
            }
            if (IDEFrontendDashboardService.isStatusUpdateEventData(event.data)) {
                this.version = event.data.version;
                this.latestStatus = event.data.status;
                this.resolveInit();
                this.onDidChangeEmitter.fire(this.latestStatus);
            }
            if (IDEFrontendDashboardService.isRelocateEventData(event.data)) {
                window.location.href = event.data.url;
            }
            if (IDEFrontendDashboardService.isOpenBrowserIDE(event.data)) {
                this.onOpenBrowserIDEEmitter.fire(undefined);
            }
        });
    }
    initialize(): Promise<void> {
        return this.initPromise;
    }

    trackEvent(msg: RemoteTrackMessage): void {
        this.serverWindow.postMessage(
            { type: "ide-track-event", msg } as IDEFrontendDashboardService.TrackEventData,
            serverUrl.url.origin,
        );
    }

    activeHeartbeat(): void {
        this.serverWindow.postMessage(
            { type: "ide-heartbeat" } as IDEFrontendDashboardService.HeartbeatEventData,
            serverUrl.url.origin,
        );
    }

    setState(state: IDEFrontendDashboardService.SetStateData): void {
        this.serverWindow.postMessage(
            { type: "ide-set-state", state } as IDEFrontendDashboardService.SetStateData,
            serverUrl.url.origin,
        );
    }

    openDesktopIDE(url: string): void {
        if (this.version && this.version >= 1) {
            // always perfrom redirect to dekstop IDE on gitpod origin
            // to avoid confirmation popup on each workspace origin
            this.serverWindow.postMessage(
                { type: "ide-open-desktop", url } as IDEFrontendDashboardService.OpenDesktopIDE,
                serverUrl.url.origin,
            );
            return;
        }

        // TODO(ak) remove after new dashboard is deployed
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
}
