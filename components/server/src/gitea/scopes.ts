/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export namespace GiteaScope {
    // TODO: currently Gitea does not support scopes (https://github.com/go-gitea/gitea/issues/4300)
    export const All = [];
    export const Requirements = {
        /**
         * Minimal required permission.
         * Gitea's API is not restricted any further.
         */
        DEFAULT: [],

        PUBLIC_REPO: [],
        PRIVATE_REPO: [],
    }
}
