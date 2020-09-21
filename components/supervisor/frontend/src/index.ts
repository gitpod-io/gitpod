/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('../public/index.css');

import "reflect-metadata";
import { SetTokenRequest, TokenReuse } from "@gitpod/supervisor/lib/token_pb";
import { createGitpodService, GitpodTokenType } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

const workspaceUrl = new GitpodHostUrl(window.location.href);
const gitpodService = createGitpodService(workspaceUrl.withoutWorkspacePrefix().toString());
const { workspaceId } = workspaceUrl;
const pendingInfo = workspaceId && gitpodService.server.getWorkspace(workspaceId);
if (!workspaceId) {
    document.title += ': Unknown workspace';
    console.error(`Failed to extract a workpace id from '${window.location.href}' url.`);
} else if (pendingInfo) {
    pendingInfo.then(info => {
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

const onDOMContentLoaded = new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));

Promise.all([onDOMContentLoaded, ideReady, contentReady]).then(() => {
    console.info('IDE backend and content are ready, revealing IDE frontend...');
    ideFrame.onload = () => loadingFrame.remove();
    document.body.appendChild(ideFrame);
});

onDOMContentLoaded.then(() => {
    if (!ideFrame.parentElement) {
        document.body.appendChild(loadingFrame);
    }
});

async function updateToken(): Promise<void> {
    try {
        await supervisorReady;
        const token = workspaceId && 'supervisor-frontend-' + workspaceId;
        if (!token) {
            return;
        }
        let tokens = await gitpodService.server.getGitpodTokens();
        if (!tokens.filter(t => t.name === token)) {
            try {
                await gitpodService.server.generateNewGitpodToken({ name: token, type: GitpodTokenType.MACHINE_AUTH_TOKEN });
            } catch (e) {
                tokens = await gitpodService.server.getGitpodTokens();
                if (tokens.filter(t => t.name === token)) {
                    // continue if another supervisor frontend generated a token in the meantime
                } else {
                    throw e;
                }
            }
        }
        const host = window.location.host;
        const setTokenRequest: SetTokenRequest.AsObject = {
            host,
            scopeList: ['resource:default'],
            token,
            reuse: TokenReuse.REUSE_WHEN_POSSIBLE
        };
        await fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/token/' + encodeURIComponent(host), {
            method: 'POST',
            body: JSON.stringify(setTokenRequest)
        });
    } catch (e) {
        console.error('failed to set a supervisor frontend token: ', e);
    }
}
updateToken();