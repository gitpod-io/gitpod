/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as images from './images';

function iconForAuthProvider(type: string) {
    switch (type) {
        case "GitHub":
            return images.github
        case "GitLab":
            return images.gitlab
        case "BitBucket":
            return images.bitbucket
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