/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { startUrl } from "./urls";

const serverOrigin = new URL(startUrl).origin;
window.addEventListener('message', event => {
    if (event.origin === serverOrigin) {
        return;
    }
    if (event.isTrusted && event.data.type == 'relocate' && event.data.url) {
        window.location.href = event.data.url;
    }
}, false)

export function load(): Promise<HTMLIFrameElement> {
    return new Promise(resolve => {
        const loadingFrame = document.createElement('iframe');
        loadingFrame.src = startUrl;
        loadingFrame.className = 'gitpod-frame loading';
        document.body.appendChild(loadingFrame);
        loadingFrame.onload = () => resolve(loadingFrame);
    });
}
