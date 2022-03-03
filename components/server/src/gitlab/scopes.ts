/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export namespace GitLabScope {
    export const READ_USER = 'read_user';
    export const API = 'api';
    export const READ_REPO = 'read_repository';

    export const All = [READ_USER, API, READ_REPO];
    export const Requirements = {
        /**
         * Minimal required permission.
         * GitLab API usage requires the permission of a user.
         */
        DEFAULT: [READ_USER, API],

        REPO: [API, READ_REPO],
    };
}
