/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export function oauthUrls(host: string) {
    return {
        authorizationUrl: `https://${host}/oauth/authorize`,
        tokenUrl: `https://${host}/oauth/token`,
        settingsUrl: `https://${host}/-/profile/applications`,
    };
}
