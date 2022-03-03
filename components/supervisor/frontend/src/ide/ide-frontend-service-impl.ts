/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IDEFrontendService, IDEFrontendState } from '@gitpod/gitpod-protocol/lib/ide-frontend-service';
import { Disposable, DisposableCollection } from '@gitpod/gitpod-protocol/lib/util/disposable';
import { Emitter } from '@gitpod/gitpod-protocol/lib/util/event';

interface IDEFrontendCapabilities {
    /**
     * Controls whether IDE window can provide the IDE frontend service.
     */
    readonly service?: boolean;
}

let state: IDEFrontendState = 'init';
window.addEventListener(
    'beforeunload',
    (e) => {
        if (state === 'terminated') {
            // workspace is stopping or stopped avoid to prompt a user with confirmation dialogs
            e.stopImmediatePropagation();
        }
    },
    { capture: true },
);

export function create(): IDEFrontendService {
    let failureCause: Error | undefined;
    let capabilities: IDEFrontendCapabilities = { service: false };
    const onDidChangeEmitter = new Emitter<void>();
    let _delegate: IDEFrontendService | undefined;
    const toStop = new DisposableCollection();
    toStop.push(onDidChangeEmitter);
    const doStart = () => {
        if (!_delegate || state !== 'ready') {
            return;
        }
        try {
            toStop.push(_delegate.start());
        } catch (e) {
            console.error('supervisor frontend: IDE frontend start failed:', e);
            failureCause = e;
            state = 'terminated';
            onDidChangeEmitter.fire();
        }
    };
    const service: IDEFrontendService = {
        get state() {
            if (state === 'terminated') {
                return 'terminated';
            }
            if (capabilities.service) {
                return _delegate?.state || 'init';
            }
            return state;
        },
        get failureCause() {
            return _delegate?.failureCause || failureCause;
        },
        onDidChange: onDidChangeEmitter.event,
        start: () => {
            if (state === 'terminated') {
                throw new Error('IDE frontend has been stopped');
            }
            state = 'ready';
            toStop.push(
                Disposable.create(() => {
                    state = 'terminated';
                    onDidChangeEmitter.fire();
                }),
            );
            doStart();
            return toStop;
        },
    };
    const capabilitiesElementAttribute = document
        .getElementById('gitpod-ide-capabilities')
        ?.getAttribute('data-settings');
    capabilities = (capabilitiesElementAttribute && JSON.parse(capabilitiesElementAttribute)) || capabilities;
    Object.defineProperty(window.gitpod, 'ideService', {
        get() {
            return _delegate;
        },
        set(delegate: IDEFrontendService) {
            if (_delegate) {
                console.error(new Error('ideService is already set'));
                return;
            }
            _delegate = delegate;
            doStart();
            onDidChangeEmitter.fire();
            delegate.onDidChange(() => onDidChangeEmitter.fire());
        },
    });
    return service;
}
