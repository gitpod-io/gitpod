/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const URL = require('url').URL || window.URL;
import { log } from './logging';

export interface UrlChange {
    (old: URL): Partial<URL>
}
export type UrlUpdate = UrlChange | Partial<URL>;

export const workspaceIDRegex = /([a-z0-9]{4,8}-)+([a-z0-9]{12})/;

export class GitpodHostUrl {
    readonly url: URL;

    constructor(urlParam?: string | URL) {
        if (urlParam === undefined || typeof urlParam === 'string') {
            this.url = new URL(urlParam || 'https://gitpod.io');
            this.url.search = '';
            this.url.hash = '';
            this.url.pathname = '';
        } else if (urlParam instanceof URL) {
            this.url = urlParam;
        } else {
            log.error('Unexpected urlParam', { urlParam });
        }
    }

    withWorkspacePrefix(workspaceId: string, region: string) {
        return this.withDomainPrefix(`${workspaceId}.ws-${region}.`);
    }

    withDomainPrefix(prefix: string): GitpodHostUrl {
        return this.with(url => ({ host: prefix + url.host }));;
    }

    withoutWorkspacePrefix(): GitpodHostUrl {
        if (!this.url.host.match(workspaceIDRegex)) {
            // URL has no workspace prefix
            return this;
        }

        return this.withoutDomainPrefix(2);
    }

    withoutDomainPrefix(removeSegmentsCount: number): GitpodHostUrl {
        return this.with(url => ({ host: url.host.split('.').splice(removeSegmentsCount).join('.') }));
    }

    with(urlUpdate: UrlUpdate) {
        const update = typeof urlUpdate === 'function' ? urlUpdate(this.url) : urlUpdate;
        const addSlashToPath = update.pathname && update.pathname.length > 0 && !update.pathname.startsWith('/');
        if (addSlashToPath) {
            update.pathname = '/' + update.pathname;
        }
        const result = Object.assign(new URL(this.toString()), update);
        return new GitpodHostUrl(result);
    }

    withApi(urlUpdate?: UrlUpdate) {
        const updated = urlUpdate ? this.with(urlUpdate) : this;
        return updated.with(url => ({ pathname: `/api${url.pathname}` }));
    }

    withContext(contextUrl: string) {
        return this.with(url => ({ hash: contextUrl }));
    }

    asWebsocket(): GitpodHostUrl {
        return this.with(url => ({ protocol: url.protocol === 'https:' ? 'wss:' : 'ws:' }));
    }

    asDashboard(): GitpodHostUrl {
        return this.with(url => ({ pathname: '/workspaces/' }));
    }

    asLogin(): GitpodHostUrl {
        return this.with(url => ({ pathname: '/login/' }));
    }

    asUpgradeSubscription(): GitpodHostUrl {
        return this.with(url => ({ pathname: '/upgrade-subscription/' }));
    }

    asAccessControl(): GitpodHostUrl {
        return this.with(url => ({ pathname: '/access-control/' }));
    }

    asSettings(): GitpodHostUrl {
        return this.with(url => ({ pathname: '/settings/' }));
    }

    asGraphQLApi(): GitpodHostUrl {
        return this.with(url => ({ pathname: '/graphql/' }));
    }

    asStart(workspaceId = this.workspaceId): GitpodHostUrl {
        return this.withoutWorkspacePrefix().with({
            pathname: '/start/',
            hash: '#' + workspaceId
        });
    }

    asWorkspaceAuth(instanceID: string, redirect?: boolean): GitpodHostUrl {
        return this.with(url => ({ pathname: `/api/auth/workspace-cookie/${instanceID}`, search: redirect ? "redirect" : "" }));
    }

    toString() {
        return this.url.toString();
    }

    toStringWoRootSlash() {
        let result = this.toString();
        if (result.endsWith('/')) {
            result = result.slice(0, result.length - 1);
        }
        return result;
    }

    get workspaceId(): string | undefined {
        const hostSegs = this.url.host.split(".");
        if (hostSegs.length > 1 && hostSegs[0].match(workspaceIDRegex)) {
            // URL has a workspace prefix
            return hostSegs[0];
        }

        const pathSegs = this.url.pathname.split("/")
        if (pathSegs.length > 3 && pathSegs[1] === "workspace") {
            return pathSegs[2];
        }

        return undefined;
    }

    get blobServe(): boolean {
        const hostSegments = this.url.host.split(".");
        if (hostSegments[0] === 'blobserve') {
            return true;
        }

        const pathSegments = this.url.pathname.split("/")
        return pathSegments[0] === "blobserve";
    }

}
