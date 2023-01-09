/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDEFrontendDashboardService } from "@gitpod/gitpod-protocol/lib/frontend-dashboard-service";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import { Emitter } from "@gitpod/gitpod-protocol/lib/util/event";

let resolveSessionId: (sessionId: string) => void;

export class FrontendDashboardServiceClient implements IDEFrontendDashboardService.IClient {
    public latestStatus?: IDEFrontendDashboardService.Status;
    public sessionID: Promise<string>;

    private readonly onDidChangeEmitter = new Emitter<IDEFrontendDashboardService.Status>();
    readonly onStatusUpdate = this.onDidChangeEmitter.event;

    constructor(private serverWindow: Window) {
        this.sessionID = new Promise<string>((resolve) => (resolveSessionId = resolve));
        window.addEventListener("message", (event: MessageEvent) => {
            if (IDEFrontendDashboardService.isStatusUpdateEventData(event.data)) {
                this.latestStatus = event.data.status;
                this.onDidChangeEmitter.fire(this.latestStatus);
            }
            if (IDEFrontendDashboardService.isRelocateEventData(event.data)) {
                this.relocate(event.data.url);
            }
            if (IDEFrontendDashboardService.isSetSessionIDEventData(event.data)) {
                this.setSessionID(event.data.sessionID);
            }
        });
    }

    relocate(url: string): void {
        window.location.href = url;
    }
    setSessionID(sessionID: string): void {
        resolveSessionId(sessionID);
    }

    trackEvent(msg: RemoteTrackMessage): void {
        this.serverWindow.postMessage(
            { type: "ide-track-event", msg } as IDEFrontendDashboardService.TrackEventData,
            "*",
        );
        throw new Error("Method not implemented.");
    }
    activeHeartbeat(): void {
        this.serverWindow.postMessage({ type: "ide-heartbeat" } as IDEFrontendDashboardService.HeartbeatEventData, "*");
        throw new Error("Method not implemented.");
    }

    setState(state: IDEFrontendDashboardService.SetStateData): void {
        this.serverWindow.postMessage(
            { type: "ide-set-state", state } as IDEFrontendDashboardService.SetStateData,
            "*",
        );
    }
}
