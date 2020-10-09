/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IDEService } from "@gitpod/gitpod-protocol/lib/ide-service";
import { Emitter } from "@gitpod/gitpod-protocol/lib/util/event";

interface IDECapabilities {
    /**
     * Controls whether IDE frame can provide IDE service.
     */
    readonly service?: boolean
}

export function create(): IDEService {
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
            onDidChangeEmitter.fire();
            delegate.onDidChange(() => onDidChangeEmitter.fire());
        }
    });
    return service;
}