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

    private resolveInit!: () => void;
    private initPromise = new Promise<void>((resolve) => (this.resolveInit = resolve));

    constructor(private serverWindow: Window) {
        window.addEventListener("message", (event: MessageEvent) => {
            if (event.origin !== serverUrl.url.origin) {
                return;
            }
            if (IDEFrontendDashboardService.isStatusUpdateEventData(event.data)) {
                this.latestStatus = event.data.status;
                this.resolveInit();
                this.onDidChangeEmitter.fire(this.latestStatus);
            }
            if (IDEFrontendDashboardService.isRelocateEventData(event.data)) {
                this.relocate(event.data.url);
            }
        });
    }

    initialize(): Promise<void> {
        return this.initPromise;
    }

    relocate(url: string): void {
        window.location.href = url;
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
}
