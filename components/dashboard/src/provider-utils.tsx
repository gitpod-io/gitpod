/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {github, gitlab, bitbucket} from './images';
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

async function openAuthorizeWindow({ host, scopes, onSuccess, onError }: { host: string, scopes?: string[], onSuccess?: () => void, onError?: (error?: string) => void }) {
    const returnTo = gitpodHostUrl.with({ pathname: 'login-success' }).toString();
    const url = gitpodHostUrl.withApi({
        pathname: '/authorize',
        search: `returnTo=${encodeURIComponent(returnTo)}&host=${host}&override=true&scopes=${(scopes || []).join(',')}`
    }).toString();

    const newWindow = window.open(url, "gitpod-connect");
    if (!newWindow) {
        console.log(`Failed to open the authorize window for ${host}`);
        onError && onError("failed");
        return;
    }

    const eventListener = (event: MessageEvent) => {
        // todo: check event.origin

        if (event.data === "auth-success") {
            window.removeEventListener("message", eventListener);

            if (event.source && "close" in event.source && event.source.close) {
                console.log(`Authorization OK. Closing child window.`);
                event.source.close();
            } else {
                // todo: add a button to the /login-success page to close, if this should not work as expected
            }
            onSuccess && onSuccess();
        }
    };
    window.addEventListener("message", eventListener);
}

export { iconForAuthProvider, simplifyProviderName, openAuthorizeWindow }