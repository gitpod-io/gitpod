/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface OssAllowList {
    /**
     * A string that identifies a GitHub/GitLab/Bitbucket identity of the form "<host>/<profilename>"
     * E.g., "github.com/geropl"
     */
    identity: string;

    deleted?: boolean;
}
