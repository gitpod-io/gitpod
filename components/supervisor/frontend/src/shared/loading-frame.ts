/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FrontendDashboardServiceClient } from "./frontend-dashboard-service";
import { startUrl } from "./urls";

export function load(): Promise<{
    frame: HTMLIFrameElement;
    frontendDashboardServiceClient: FrontendDashboardServiceClient;
}> {
    return new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.src = startUrl.toString();
        frame.style.visibility = "visible";
        frame.className = "gitpod-frame loading";
        document.body.prepend(frame);

        frame.onload = () => {
            const frontendDashboardServiceClient = new FrontendDashboardServiceClient(frame.contentWindow!);
            resolve({ frame, frontendDashboardServiceClient });
        };
    });
}
