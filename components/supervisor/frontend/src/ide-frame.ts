/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { SupervisorServiceClient } from "./supervisor-service-client";

const ideURL = new URL(window.location.href);
ideURL.searchParams.append('gitpod-ide-index', 'true');

export function load(supervisorServiceClient: SupervisorServiceClient): Promise<HTMLIFrameElement> {
    return new Promise(resolve => {
        const ideFrame = document.createElement('iframe');
        ideFrame.src = ideURL.href;
        ideFrame.className = 'gitpod-frame ide';
        ideFrame.style.visibility = 'hidden';
        Promise.all([supervisorServiceClient.ideReady, supervisorServiceClient.contentReady]).then(() => {
            console.info('IDE backend and content are ready, attaching IDE frontend...');
            document.body.appendChild(ideFrame);
            ideFrame.contentWindow?.addEventListener('DOMContentLoaded', () => {
                if (ideFrame.contentWindow) {
                    ideFrame.contentWindow.gitpod = window.gitpod;
                }
                if (navigator.keyboard?.getLayoutMap && ideFrame.contentWindow?.navigator.keyboard?.getLayoutMap) {
                    ideFrame.contentWindow.navigator.keyboard.getLayoutMap = navigator.keyboard.getLayoutMap.bind(navigator.keyboard);
                }
                if (navigator.keyboard?.addEventListener && ideFrame.contentWindow?.navigator.keyboard?.addEventListener) {
                    ideFrame.contentWindow.navigator.keyboard.addEventListener = navigator.keyboard.addEventListener.bind(navigator.keyboard);
                }
                resolve(ideFrame);
            }, { once: true });
        });
    });
}