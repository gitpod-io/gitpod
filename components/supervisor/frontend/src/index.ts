/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('../public/index.css');

import "reflect-metadata";
import { createGitpodService } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

const workspaceUrl = new GitpodHostUrl(window.location.href);
const { workspaceId } = workspaceUrl;
if (workspaceId) {
    const gitpodService = createGitpodService(workspaceUrl.withoutWorkspacePrefix().toString());
    gitpodService.server.getWorkspace(workspaceId).then(info => {
        document.title = info.workspace.description;
    });
} else {
    document.title += ': Unknown workspace';
}

const checkReady: (kind: 'content' | 'ide') => Promise<void> = kind =>
    fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/status/' + kind + '/wait/true').then(response => {
        if (response.ok) {
            return;
        }
        console.debug(`failed to check whether ${kind} is ready, trying again...`, response.status, response.statusText);
        return checkReady(kind);
    }, e => {
        console.debug(`failed to check whether ${kind} is ready, trying again...`, e);
        return checkReady(kind);
    });

const ideURL = new URL(window.location.href);
ideURL.searchParams.append('gitpod-ide-index', 'true');

const ideFrame = document.createElement('iframe');
ideFrame.src = ideURL.href;
ideFrame.className = 'gitpod-frame loading';

let segs = window.location.host.split('.');
let startURL = window.location.protocol + '//' + segs.splice(2, 4).join('.') + '/start/#' + segs[0];
if (window.location.host.includes("localhost") || window.location.pathname.substring(0, 11) === "/workspace/") {
    // /workspace/ paths are used for all path-routed ingress modes, e.g. pathAndHost or noDomain
    segs = window.location.pathname.split('/');
    startURL = window.location.protocol + '//' + window.location.host + '/start/#' + segs[segs.length - 2];
}

const loadingFrame = document.createElement('iframe');
loadingFrame.src = startURL;
loadingFrame.className = 'gitpod-frame loading';

const onDOMContentLoaded = new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));

Promise.all([onDOMContentLoaded, checkReady('ide'), checkReady('content')]).then(() => {
    console.info('IDE backend and content are ready, revealing IDE frontend...');
    ideFrame.onload = () => loadingFrame.remove();
    document.body.appendChild(ideFrame);
});

onDOMContentLoaded.then(() => {
    if (!ideFrame.parentElement) {
        document.body.appendChild(loadingFrame);
    }
});