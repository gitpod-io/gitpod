/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DisposableCollection, Disposable } from "@gitpod/gitpod-protocol/lib/util/disposable";
import { isSaaSServerGreaterThan, isSaaS } from "./gitpod-server-compatibility";
import { serverUrl } from "../shared/urls";
import { FrontendDashboardServiceClient } from "../shared/frontend-dashboard-service";

let lastActivity = 0;
const updateLastActivitiy = () => {
    lastActivity = new Date().getTime();
};
export const track = (w: Window) => {
    w.document.addEventListener("mousemove", updateLastActivitiy, { capture: true });
    w.document.addEventListener("keydown", updateLastActivitiy, { capture: true });
};

let pageCloseCompatibile: boolean = false;
// TODO(ak) remove
isSaaSServerGreaterThan("main.4124").then((r) => {
    pageCloseCompatibile = r;
});

let toCancel: DisposableCollection | undefined;
export function schedule(frontendDashboardServiceClient: FrontendDashboardServiceClient, sessionId: string): void {
    if (toCancel) {
        return;
    }
    toCancel = new DisposableCollection();
    const sendHeartBeat = async (wasClosed?: true) => {
        try {
            frontendDashboardServiceClient.activeHeartbeat(); // wasClosed
            if (wasClosed) {
                frontendDashboardServiceClient.trackEvent({
                    event: "ide_close_signal",
                    properties: {
                        sessionId,
                        clientKind: "supervisor-frontend",
                    },
                });
            }
        } catch (err) {
            console.error("Failed to send hearbeat:", err);
        }
    };
    sendHeartBeat();

    const beaconWorkspacePageClose = () => {
        const instanceId = frontendDashboardServiceClient.latestStatus?.instanceId;
        if (!instanceId) {
            return;
        }
        const data = { sessionId };
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        const url = serverUrl.withApi({ pathname: `/auth/workspacePageClose/${instanceId}` }).toString();
        navigator.sendBeacon(url, blob);
    };

    const workspacePageCloseCompatible = () => {
        if (isSaaS && !pageCloseCompatibile) {
            sendHeartBeat(true);
            return;
        }
        beaconWorkspacePageClose();
    };

    const unloadListener = () => {
        workspacePageCloseCompatible();
    };
    window.addEventListener("unload", unloadListener);
    toCancel.push(Disposable.create(() => window.removeEventListener("unload", unloadListener)));

    let activityInterval = 30000;
    const intervalHandle = setInterval(() => {
        // add an additional random value between 5 and 15 seconds
        const randomInterval = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
        if (lastActivity + activityInterval + randomInterval < new Date().getTime()) {
            // no activity, no heartbeat
            return;
        }
        sendHeartBeat();
    }, activityInterval);
    toCancel.push(Disposable.create(() => clearInterval(intervalHandle)));
}

export const cancel = () => {
    if (toCancel) {
        toCancel.dispose();
        toCancel = undefined;
    }
};
