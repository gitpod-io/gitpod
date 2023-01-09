/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDEFrontendDashboardService } from "@gitpod/gitpod-protocol/lib/frontend-dashboard-service";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import { Emitter } from "@gitpod/gitpod-protocol/lib/util/event";

export class FrontendDashboardServiceClient implements IDEFrontendDashboardService.IClient {
    public latestStatus!: IDEFrontendDashboardService.Status;

    private readonly onDidChangeEmitter = new Emitter<IDEFrontendDashboardService.Status>();
    readonly onStatusUpdate = this.onDidChangeEmitter.event;

    private resolveInit!: () => void;
    private initPromise = new Promise<void>((resolve) => (this.resolveInit = resolve));

    constructor(private serverWindow: Window) {
        console.log("===========new.FrontendDashboardServiceClient", serverWindow);
        window.addEventListener("message", (event: MessageEvent) => {
            if (IDEFrontendDashboardService.isStatusUpdateEventData(event.data)) {
                console.log("=============supervisor isStatusUpdateEventData", event.data);
                this.latestStatus = event.data.status;
                this.resolveInit();
                this.onDidChangeEmitter.fire(this.latestStatus);
            }
            if (IDEFrontendDashboardService.isRelocateEventData(event.data)) {
                console.log("=============supervisor isRelocateEventData", event.data);
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
        console.log("=========== supervisor send trackEvent");
        this.serverWindow.postMessage(
            { type: "ide-track-event", msg } as IDEFrontendDashboardService.TrackEventData,
            "*",
        );
    }

    activeHeartbeat(): void {
        console.log("=========== supervisor send activeHeartbeat");
        this.serverWindow.postMessage({ type: "ide-heartbeat" } as IDEFrontendDashboardService.HeartbeatEventData, "*");
    }

    setState(state: IDEFrontendDashboardService.SetStateData): void {
        console.log("=========== supervisor send setState");
        this.serverWindow.postMessage(
            { type: "ide-set-state", state } as IDEFrontendDashboardService.SetStateData,
            "*",
        );
    }
}
