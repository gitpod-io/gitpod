/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { GitpodService, Branding } from '@gitpod/gitpod-protocol';
import { Context } from '../context';

export interface WithBrandingProps {
    service?: GitpodService;
}

interface WithBrandingState {
    branding?: Branding;
}

/**
 * the first effective update will be when we receive and store the branding info in local storage.
 * next page load should pick it up from local storage quite fast.
 */
export function updateBrowserTab(branding: Branding | undefined = WithBranding.getCachedBranding()) {
    if (!branding) {
        return;
    }
    window.document.title = window.document.title.replace("Gitpod", branding.name);
    const favicon = branding.favicon;
    if (favicon) {
        document.querySelectorAll("link[rel*='icon']").forEach(e => e.remove());
        const link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = favicon;
        document.querySelector('head')!.appendChild(link);
    }
}

export class WithBranding extends React.Component<WithBrandingProps, WithBrandingState> {

    static async getBranding(service?: GitpodService, forceRefresh?: boolean): Promise<Branding | undefined> {
        let b = WithBranding.getCachedBranding();
        if ((!b || forceRefresh) && !!service) {
            b = await service.server.getBranding({});
            setCacheItem('branding_v1', JSON.stringify(b));

            updateBrowserTab();
        }
        return b;
    }

    static getCachedBranding(): Branding | undefined {
        const rb = getCacheItem('branding_v1');
        if (!rb) {
            return;
        }

        return JSON.parse(String(rb));
    }

    constructor(props: WithBrandingProps) {
        super(props);
        this.state = {
            branding: WithBranding.getCachedBranding()
        };
    }

    componentWillMount() {
        if (!this.props.service) {
            return;
        }

        WithBranding.getBranding(this.props.service, true)
            .then(b => this.setState({ branding: b }))
            .catch(e => console.log("cannot update branding", e));
    }

    render() {
        // Inject the branding into the existing context
        return (
            <Context.Consumer>
                {(ctx) => 
                    <Context.Provider value={{
                        ...ctx,
                        branding: this.state.branding
                    }}>
                        {this.props.children}
                    </Context.Provider>
                }
            </Context.Consumer>
        )
    }

}

function getCacheItem(key: string): string | undefined | null {
    if (isLocalStorageSupported) {
        try {
            return localStorage.getItem(key);
        } catch {
            // ignore and fall back
        }
    }
    return cache.get(key);
}
function setCacheItem(key: string, value: string) {
    if (isLocalStorageSupported) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // ignore and fall back
        }
    }
    return cache.set(key, value);
}
function checkLocalStorageSupported() {
    try {
        const key = "random_key_onp3bGB";
        localStorage.setItem(key, key);
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
}
const isLocalStorageSupported = checkLocalStorageSupported();
const cache = new Map<string, string>();
