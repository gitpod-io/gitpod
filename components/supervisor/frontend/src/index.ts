/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('../public/index.css');

import "reflect-metadata";
import { createGitpodService } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { WorkspaceInfoResponse } from '@gitpod/supervisor-api-grpc/lib/info_pb';

const workspaceUrl = new GitpodHostUrl(window.location.href);
window.gitpod = {
    service: createGitpodService(workspaceUrl.withoutWorkspacePrefix().toString())
};
const { workspaceId } = workspaceUrl;
const workspaceInfo = workspaceId ? window.gitpod.service.server.getWorkspace(workspaceId) : undefined;
if (!workspaceId) {
    document.title += ': Unknown workspace';
    console.error(`Failed to extract a workspace id from '${window.location.href}'.`)
} else if (workspaceInfo) {
    workspaceInfo.then(info => {
        document.title = info.workspace.description;
    });
}

const checkReady: (kind: 'content' | 'ide' | 'supervisor') => Promise<void> = kind =>
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
const supervisorReady = checkReady('supervisor');
const ideReady = supervisorReady.then(() => checkReady('ide'));
const contentReady = supervisorReady.then(() => checkReady('content'));

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

const onDOMContentLoaded = new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }));

Promise.all([onDOMContentLoaded, ideReady, contentReady]).then(() => {
    console.info('IDE backend and content are ready, attaching IDE frontend...');
    ideFrame.onload = () => loadingFrame.remove();
    document.body.appendChild(ideFrame);
    ideFrame.contentWindow?.addEventListener('DOMContentLoaded', () => {
        if (ideFrame.contentWindow) {
            trackLastActivity(ideFrame.contentWindow);
            ideFrame.contentWindow.gitpod = window.gitpod;
        }
        if (navigator.keyboard?.getLayoutMap && ideFrame.contentWindow?.navigator.keyboard?.getLayoutMap) {
            ideFrame.contentWindow.navigator.keyboard.getLayoutMap = navigator.keyboard.getLayoutMap.bind(navigator.keyboard);
        }
        if (navigator.keyboard?.addEventListener && ideFrame.contentWindow?.navigator.keyboard?.addEventListener) {
            ideFrame.contentWindow.navigator.keyboard.addEventListener = navigator.keyboard.addEventListener.bind(navigator.keyboard);
        }
    }, { once: true });
});

onDOMContentLoaded.then(() => {
    if (!ideFrame.parentElement) {
        document.body.appendChild(loadingFrame);
        loadingFrame.contentWindow?.addEventListener('DOMContentLoaded', () => {
            if (loadingFrame.contentWindow) {
                trackLastActivity(loadingFrame.contentWindow);
            }
        }, { once: true });
    }
});


let lastActivity = 0;
const updateLastActivitiy = () => {
    lastActivity = new Date().getTime();
};
const trackLastActivity = (w: Window) => {
    w.document.addEventListener('mousemove', updateLastActivitiy, { capture: true });
    w.document.addEventListener('keydown', updateLastActivitiy, { capture: true });
}
trackLastActivity(window);
supervisorReady.then(async () => {
    const response = await fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/info/workspace', { credentials: 'include' });
    const { instanceId }: WorkspaceInfoResponse.AsObject = await response.json();
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
    setInterval(() => {
        if (lastActivity + activityInterval < new Date().getTime()) {
            // no activity, no heartbeat
            return;
        }
        sendHeartBeat();
    }, activityInterval);
});