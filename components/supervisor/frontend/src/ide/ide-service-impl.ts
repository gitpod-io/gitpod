/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IDEService, IDEState } from "@gitpod/gitpod-protocol/lib/ide-service";
import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol/lib/util/disposable";
import { Emitter } from "@gitpod/gitpod-protocol/lib/util/event";

interface IDECapabilities {
    /**
     * Controls whether IDE frame can provide IDE service.
     */
    readonly service?: boolean
}

let state: IDEState = 'init';
window.addEventListener('beforeunload', e => {
    if (state === 'terminated') {
        // workspace is stopping or stopped avoid to prompt a user with confirmation dialogs
        e.stopImmediatePropagation();
    }
}, { capture: true });

export function create(): IDEService {
    let capabilities: IDECapabilities = { service: false };
    const onDidChangeEmitter = new Emitter<void>();
    let _delegate: IDEService | undefined;
    const toStop = new DisposableCollection();
    toStop.push(onDidChangeEmitter);
    const service: IDEService = {
        get state() {
            if (state === 'terminated') {
                return 'terminated';
            }
            if (capabilities.service) {
                return _delegate?.state || 'init';
            }
            return state;
        },
        onDidChange: onDidChangeEmitter.event,
        start: () => {
            if (state === 'terminated') {
                throw new Error('IDE has been stopped');
            }
            state = 'ready';
            toStop.push(Disposable.create(() => {
                state = 'terminated';
                onDidChangeEmitter.fire();
            }))
            if (_delegate) {
                toStop.push(_delegate.start());
            }
            return toStop;
        }
    }
    const capabilitiesElementAttribute = document.getElementById('gitpod-ide-capabilities')?.getAttribute('data-settings');
    capabilities = capabilitiesElementAttribute && JSON.parse(capabilitiesElementAttribute) || capabilities;
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
            if (state === 'ready') {
                toStop.push(delegate.start());
            }
            onDidChangeEmitter.fire();
            delegate.onDidChange(() => onDidChangeEmitter.fire());
        }
    });
    return service;
}