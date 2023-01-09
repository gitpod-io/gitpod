/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInstancePhase } from "./workspace-instance";
import { RemoteTrackMessage } from "./analytics";
import { Event } from "./util/event";

export namespace IDEFrontendDashboardService {
    /**
     * IClient is the client side which is using in supervisor frontend
     */
    export interface IClient extends IClientOn, IClientSend {}
    interface IClientOn {
        onStatusUpdate: Event<Status>;
        relocate(url: string): void;
    }
    interface IClientSend {
        trackEvent(msg: RemoteTrackMessage): void;
        activeHeartbeat(): void;
        setState(state: SetStateData): void;
    }

    /**
     * IServer is the server side which is using in dashboard loading screen
     */
    export interface IServer extends IServerOn, IServerSend {
        auth(): Promise<void>;
    }
    interface IServerOn {
        onSetState: Event<SetStateData>;
        trackEvent(msg: RemoteTrackMessage): void;
        activeHeartbeat(): void;
    }
    interface IServerSend {
        sendStatusUpdate(status: Status): void;
        relocate(url: string): void;
    }

    export interface Status {
        workspaceID: string;
        loggedUserId: string;

        instanceId?: string;
        ideUrl?: string;
        statusPhase?: WorkspaceInstancePhase;

        workspaceDescription: string;
        workspaceType: string;
    }

    export interface SetStateData {
        ideFrontendFailureCause?: string;
        desktopIDE?: {
            clientID: string;
            link: string;
            label?: string;
        };
    }

    /**
     * interface for post message that send status update from dashboard to supervisor
     */
    export interface StatusUpdateEventData {
        type: "ide-status-update";
        status: Status;
    }

    export interface HeartbeatEventData {
        type: "ide-heartbeat";
    }

    export interface TrackEventData {
        type: "ide-track-event";
        msg: RemoteTrackMessage;
    }

    export interface RelocateEventData {
        type: "ide-relocate";
        url: string;
    }

    export interface SetStateEventData {
        type: "ide-set-state";
        state: SetStateData;
    }

    export function isStatusUpdateEventData(obj: any): obj is StatusUpdateEventData {
        return obj != null && typeof obj === "object" && obj.type === "ide-status-update";
    }

    export function isHeartbeatEventData(obj: any): obj is HeartbeatEventData {
        return obj != null && typeof obj === "object" && obj.type === "ide-heartbeat";
    }

    export function isTrackEventData(obj: any): obj is TrackEventData {
        return obj != null && typeof obj === "object" && obj.type === "ide-track-event";
    }

    export function isRelocateEventData(obj: any): obj is RelocateEventData {
        return obj != null && typeof obj === "object" && obj.type === "ide-relocate";
    }

    export function isSetStateEventData(obj: any): obj is SetStateEventData {
        return obj != null && typeof obj === "object" && obj.type === "ide-set-state";
    }
}
