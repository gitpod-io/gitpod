/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import URI from "@theia/core/lib/common/uri";

const localhostRegex = /^(localhost|127(?:\.[0-9]+){0,2}\.[0-9]+|0+(?:\.0+){0,2}\.0+|\[(?:0*\:)*?:?0*1?\])(?::(\d+))?$/;

export function parseLocalhost(uri: URI): { address: string, port: number } | undefined {
    if (uri.scheme !== 'http' && uri.scheme !== 'https') {
        return undefined;
    }
    const localhostMatch = localhostRegex.exec(uri.authority);
    if (!localhostMatch) {
        return undefined;
    }
    let address = localhostMatch[1];
    if (address.startsWith('[') && address.endsWith(']')) {
        address = address.substr(1, address.length - 2);
    }
    let port = +localhostMatch[2];
    if (Number.isNaN(port)) {
        port = uri.scheme === 'http' ? 80 : 443;
    }
    return { address, port };
}