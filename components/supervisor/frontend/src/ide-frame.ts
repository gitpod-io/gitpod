/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IDEService } from "@gitpod/gitpod-protocol/lib/ide-service";
import { Emitter } from "@gitpod/gitpod-protocol/lib/util/event";
import { SupervisorServiceClient } from "./supervisor-service-client";

const ideURL = new URL(window.location.href);
ideURL.searchParams.append('gitpod-ide-index', 'true');

interface IDECapabilities {
    /**
     * Controls whether IDE frame can provide IDE service.
     */
    readonly service?: boolean
}

export function load(supervisorServiceClient: SupervisorServiceClient): Promise<{
    frame: HTMLIFrameElement
    service: IDEService
}> {
    return new Promise(resolve => {
        const frame = document.createElement('iframe');
        frame.src = ideURL.href;
        frame.className = 'gitpod-frame ide';
        frame.style.visibility = 'hidden';

        let capabilities: IDECapabilities = { service: false };
        const onDidChangeEmitter = new Emitter<void>();
        let _delegate: IDEService | undefined;
        const service: IDEService = {
            get state() {
                if (capabilities.service) {
                    return _delegate?.state || 'init';
                }
                return 'ready';
            },
            onDidChange: onDidChangeEmitter.event
        }
        frame.onload = () => {
            const capabilitiesElementAttribute = frame.contentDocument?.getElementById('gitpod-ide-capabilities')?.getAttribute('data-settings');
            capabilities = capabilitiesElementAttribute && JSON.parse(capabilitiesElementAttribute) || capabilities;
            resolve({ frame, service });
        }
        Object.defineProperty(window.gitpod, 'ideService', {
            get() {
                return _delegate;
            },
            set(delegate: IDEService) {
                if (_delegate) {
                    console.error(new Error('ideService is already set'));
                    return;
                }
                _delegate = delegate;
                onDidChangeEmitter.fire();
                delegate.onDidChange(() => onDidChangeEmitter.fire());
            }
        });

        Promise.all([supervisorServiceClient.ideReady, supervisorServiceClient.contentReady]).then(() => {
            console.info('IDE backend and content are ready, attaching IDE frontend...');
            document.body.appendChild(frame);
            frame.contentWindow?.addEventListener('DOMContentLoaded', () => {
                frame.contentWindow?.history.replaceState(null, '', window.location.href);
                if (frame.contentWindow) {
                    frame.contentWindow.gitpod = window.gitpod;
                }
                if (navigator.keyboard?.getLayoutMap && frame.contentWindow?.navigator.keyboard?.getLayoutMap) {
                    frame.contentWindow.navigator.keyboard.getLayoutMap = navigator.keyboard.getLayoutMap.bind(navigator.keyboard);
                }
                if (navigator.keyboard?.addEventListener && frame.contentWindow?.navigator.keyboard?.addEventListener) {
                    frame.contentWindow.navigator.keyboard.addEventListener = navigator.keyboard.addEventListener.bind(navigator.keyboard);
                }
            }, { once: true });
        });
    });
}