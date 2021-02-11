/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderScopes } from "@gitpod/gitpod-protocol";

export namespace GitHubScope {
    export const EMAIL = "user:email";
    export const PUBLIC = "public_repo";
    export const PRIVATE = "repo";
    export const ORGS = "read:org";
    export const WORKFLOW = "workflow";

    export const definitions: AuthProviderScopes = {
        default: [EMAIL],
        all: [EMAIL, PUBLIC, PRIVATE, ORGS, WORKFLOW],
        descriptions: {
            EMAIL: "Grants read-only access to the authenticated user's profile.",
            PUBLIC: "Grants read-write access to public repositories using Git-over-HTTP.",
            PRIVATE: "Grants read-write access to private repositories using Git-over-HTTP.",
            ORGS: "Grants read-only access to organization membership.",
            WORKFLOW: "Grants the ability to add and update GitHub Actions workflow files.",
        }
    };
}
