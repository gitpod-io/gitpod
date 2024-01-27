/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// cf. https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/
//
export function oauthUrls(host: string) {
    return {
        authorizationUrl: `https://${host}/site/oauth2/authorize`,
        tokenUrl: `https://${host}/site/oauth2/access_token`,
        settingsUrl: `https://${host}/account/settings/app-authorizations/`,
    };
}
