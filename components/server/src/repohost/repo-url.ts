/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as url from 'url';

export function parseRepoUrl(repoUrl: string): { host: string, owner: string, repo: string} | undefined {
    const u = url.parse(repoUrl);
    const host = u.hostname || '';
    const path = u.pathname || '';
    const segments = path.split('/').filter(s => !!s); // [ 'TypeFox', 'gitpod.git' ]
    if (segments.length === 2) {
        const owner = segments[0];
        const repo = segments[1].endsWith('.git') ? segments[1].slice(0, -4) : segments[1];
        return { host, owner, repo };
    }
    return undefined;
}