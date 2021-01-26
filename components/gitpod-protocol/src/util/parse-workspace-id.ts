/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


/**
 * Hostname may be of the form:
 *  - moccasin-ferret-155799b3.ws-eu01.gitpod.io
 *  - 1234-moccasin-ferret-155799b3.ws-eu01.gitpod.io
 *  - webview-1234-moccasin-ferret-155799b3.ws-eu01.gitpod.io (or any other string replacing webview)
 * @param hostname The hostname the request is headed to
 */
export const parseWorkspaceIdFromHostname = function(hostname: string) {
    // We need to parse the workspace id precisely here to get the case '<some-str>-<port>-<wsid>.ws.' right
    const wsIdExpression = /([0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8})\.ws/g;
    const match = wsIdExpression.exec(hostname);
    if (match && match.length >= 2) {
        return match[1];
    } else {
        const legacyUrlFormat = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.ws/g;
        const legacyMatch = legacyUrlFormat.exec(hostname);
        if (legacyMatch && legacyMatch.length >= 2) {
            return legacyMatch[1];
        }
        return undefined;
    }
}