/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import bitbucket from './images/bitbucket.svg';
import github from './images/github.svg';
import gitlab from './images/gitlab.svg';
import { gitpodHostUrl } from "./service/service";


function iconForAuthProvider(type: string) {
    switch (type) {
        case "GitHub":
            return github
        case "GitLab":
            return gitlab
        case "Bitbucket":
            return bitbucket
        default:
            break;
    }
}

function simplifyProviderName(host: string) {
    switch (host) {
        case "github.com":
            return "GitHub"
        case "gitlab.com":
            return "GitLab"
        case "bitbucket.org":
            return "Bitbucket"
        default:
            return host;
    }
}

async function openAuthorizeWindow({ host, scopes, onSuccess, onError }: { host: string, scopes?: string[], onSuccess?: (payload?: string) => void, onError?: (error?: string) => void }) {
    const returnTo = gitpodHostUrl.with({ pathname: 'flow-result', search: 'message=success' }).toString();
    const url = gitpodHostUrl.withApi({
        pathname: '/authorize',
        search: `returnTo=${encodeURIComponent(returnTo)}&host=${host}&override=true&scopes=${(scopes || []).join(',')}`
    }).toString();

    const newWindow = window.open(url, "gitpod-auth-window");
    if (!newWindow) {
        console.log(`Failed to open the authorize window for ${host}`);
        onError && onError("failed");
        return;
    }

    const eventListener = (event: MessageEvent) => {
        // todo: check event.origin

        const killAuthWindow = () => {
            window.removeEventListener("message", eventListener);
    
            if (event.source && "close" in event.source && event.source.close) {
                console.log(`Received Auth Window Result. Closing Window.`);
                event.source.close();
            }
        }

        if (typeof event.data === "string" && event.data.startsWith("success")) {
            killAuthWindow();
            onSuccess && onSuccess();
        }
        if (typeof event.data === "string" && event.data.startsWith("error:")) {
            const errorText = atob(event.data.substring("error:".length));
            killAuthWindow();
            onError && onError(errorText);
        }
    };
    window.addEventListener("message", eventListener);
}

export { iconForAuthProvider, simplifyProviderName, openAuthorizeWindow }