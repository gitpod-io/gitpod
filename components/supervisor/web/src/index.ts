/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('../public/index.css');

// TODO document.title = 

const fetchContentReady: () => Promise<void> = () => fetch(window.location.protocol + '//' + window.location.host + '/supervisor/ready').then(response => {
    if (response.ok) {
        console.info('content is ready, revealing IDE...');
        return;
    }
    console.error('failed to check whether content is ready, trying again...', response.status, response.statusText);
    return fetchContentReady();
}, e => {
    console.error('failed to check whether content is ready, trying again...', e);
    return fetchContentReady();
});

const contentReady = fetchContentReady();

window.addEventListener('DOMContentLoaded', () => {
    const ideFrame = document.createElement('iframe');
    ideFrame.src = window.location.protocol + '//' + window.location.host + '/ide/'
    ideFrame.className = 'gitpod-frame ide';
    document.body.appendChild(ideFrame);

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
    document.body.appendChild(loadingFrame);

    contentReady.then(() => loadingFrame.remove());
});