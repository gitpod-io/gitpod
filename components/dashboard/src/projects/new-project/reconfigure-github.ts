/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { gitpodHostUrl } from "../../service/service";
import { projectsPathNew } from "../projects.routes";

export async function openReconfigureWindow(params: { account?: string; onSuccess: (p: any) => void }) {
    const { account, onSuccess } = params;
    const state = btoa(JSON.stringify({ from: "/reconfigure", next: projectsPathNew }));
    const url = gitpodHostUrl
        .withApi({
            pathname: "/apps/github/reconfigure",
            search: `account=${account}&state=${encodeURIComponent(state)}`,
        })
        .toString();

    const width = 800;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Optimistically assume that the new window was opened.
    window.open(
        url,
        "gitpod-github-window",
        `width=${width},height=${height},top=${top},left=${left}status=yes,scrollbars=yes,resizable=yes`,
    );

    const eventListener = (event: MessageEvent) => {
        // todo: check event.origin

        const killWindow = () => {
            window.removeEventListener("message", eventListener);

            if (event.source && "close" in event.source && event.source.close) {
                console.log(`Received Window Result. Closing Window.`);
                event.source.close();
            }
        };

        if (typeof event.data === "string" && event.data.startsWith("payload:")) {
            killWindow();
            try {
                let payload: { installationId: string; setupAction?: string } = JSON.parse(
                    atob(event.data.substring("payload:".length)),
                );
                onSuccess && onSuccess(payload);
            } catch (error) {
                console.log(error);
            }
        }
        if (typeof event.data === "string" && event.data.startsWith("error:")) {
            let error: string | { error: string; description?: string } = atob(event.data.substring("error:".length));
            try {
                const payload = JSON.parse(error);
                if (typeof payload === "object" && payload.error) {
                    error = { error: payload.error, description: payload.description };
                }
            } catch (error) {
                console.log(error);
            }

            killWindow();
            // onError && onError(error);
        }
    };
    window.addEventListener("message", eventListener);
}
