/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


function iconForAuthProvider(type: string) {
    switch (type) {
        case "GitHub":
            return "/images/github.svg"
        case "GitLab":
            return "/images/gitlab.svg"
        case "BitBucket":
            return "/images/bitbucket.svg"
        default:
            break;
    }
}

function simplifyProviderName(host: string) {
    switch (host) {
        case "github.com":
            return "GitHub"
        case "gitlab.com":
            return "GitLab"
        case "bitbucket.org":
            return "BitBucket"
        default:
            return host;
    }
}

export { iconForAuthProvider, simplifyProviderName }