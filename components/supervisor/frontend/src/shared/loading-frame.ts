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
    openDesktopLink: (link: string) => void;
}> {
    return new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.src = startUrl.toString();
        frame.style.visibility = "visible";
        frame.className = "gitpod-frame loading";
        document.body.appendChild(frame);

        frame.onload = () => {
            const frontendDashboardServiceClient = new FrontendDashboardServiceClient(frame.contentWindow!);
            const openDesktopLink = (link: string) => {
                let redirect = false;
                try {
                    const desktopLink = new URL(link);
                    redirect = desktopLink.protocol !== "http:" && desktopLink.protocol !== "https:";
                } catch (e) {
                    console.error("invalid desktop link:", e);
                }
                // redirect only if points to desktop application
                // don't navigate browser to another page
                if (redirect) {
                    window.location.href = link;
                } else {
                    window.open(link, "_blank", "noopener");
                }
            };
            resolve({ frame, frontendDashboardServiceClient, openDesktopLink });
        };
    });
}
