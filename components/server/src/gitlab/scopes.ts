/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderScopes } from '@gitpod/gitpod-protocol';

export namespace GitLabScope {
    export const READ_USER: string = "read_user";
    export const READ_API = "read_api";
    export const READ_REPO = "read_repository";
    export const WRITE_REPO = "write_repository";
    export const API = "api";

    export const definitions: AuthProviderScopes = {
        default: [READ_USER],
        all: [READ_USER, READ_API, READ_REPO, WRITE_REPO, API],
        descriptions: {
            READ_USER: "Grants read-only access to the authenticated user's profile.",
            READ_API: "Grants read access to the API.",
            READ_REPO: "Grants read-only access to repositories on private projects using Git-over-HTTP.",
            WRITE_REPO: "Grants read-write access to repositories on private projects using Git-over-HTTP.",
            API: "Grants complete read/write access to the API.",
        }
    };

}
