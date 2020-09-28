/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { fetchWorkspaceInfo } from "./supervisor-service-client";
import { WorkspaceInfoResponse } from "@gitpod/supervisor-api-grpc/lib/info_pb";

let lastActivity = 0;
const updateLastActivitiy = () => {
    lastActivity = new Date().getTime();
};
export const track = (w: Window) => {
    w.document.addEventListener('mousemove', updateLastActivitiy, { capture: true });
    w.document.addEventListener('keydown', updateLastActivitiy, { capture: true });
}

let intervalHandle: NodeJS.Timer | undefined;
export function schedule({ instanceId }: WorkspaceInfoResponse.AsObject): void {
    if (intervalHandle === undefined) {
        return;
    }
    const sendHeartBeat = async (wasClosed?: true) => {
        try {
            await window.gitpod.service.server.sendHeartBeat({ instanceId, wasClosed });
        } catch (err) {
            console.error('Failed to send hearbeat:', err);
        }
    }
    sendHeartBeat();
    window.addEventListener('beforeunload', () => sendHeartBeat(true), { once: true });

    let activityInterval = 10000;
    intervalHandle = setInterval(() => {
        if (lastActivity + activityInterval < new Date().getTime()) {
            // no activity, no heartbeat
            return;
        }
        sendHeartBeat();
    }, activityInterval);
}

export const cancel = () => {
    if (intervalHandle !== undefined) {
        clearInterval(intervalHandle);
        intervalHandle = undefined;
    }
}