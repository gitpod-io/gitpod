/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// cf. https://confluence.atlassian.com/bitbucketserver/bitbucket-oauth-2-0-provider-api-1108483661.html
//
export function oauthUrls(host: string) {
    return {
        authorizationUrl: `https://${host}/rest/oauth2/latest/authorize`,
        tokenUrl: `https://${host}/rest/oauth2/latest/token`,
        settingsUrl: "",
    };
}
