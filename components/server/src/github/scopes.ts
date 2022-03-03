/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export namespace GitHubScope {
    export const EMAIL = 'user:email';
    export const READ_USER = 'read:user';
    export const PUBLIC = 'public_repo';
    export const PRIVATE = 'repo';
    export const ORGS = 'read:org';
    export const WORKFLOW = 'workflow';

    export const All = [EMAIL, READ_USER, PUBLIC, PRIVATE, ORGS, WORKFLOW];
    export const Requirements = {
        /**
         * Minimal required permission.
         * GitHub's API is not restricted any further.
         */
        DEFAULT: [EMAIL],

        PUBLIC_REPO: [PUBLIC],
        PRIVATE_REPO: [PRIVATE],
    };
}
