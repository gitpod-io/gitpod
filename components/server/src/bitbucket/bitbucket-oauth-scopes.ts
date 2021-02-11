/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderScopes } from "@gitpod/gitpod-protocol";

// https://confluence.atlassian.com/bitbucket/oauth-on-bitbucket-cloud-238027431.html

export namespace BitbucketOAuthScopes {
    /** Read user info like name, e-mail adresses etc. */
    export const ACCOUNT_READ = "account";
    /** Access repo info, clone repo over https, read and write issues */
    export const REPOSITORY_READ = "repository";
    /** Push over https, fork repo */
    export const REPOSITORY_WRITE = "repository:write";
    /** Lists and read pull requests */
    export const PULL_REQUEST_READ = "pullrequest";
    /** Create, comment and merge pull requests */
    export const PULL_REQUEST_WRITE = "pullrequest:write"
    /** Create, list web hooks */
    export const WEBHOOK = "webhook"

    export const definitions: AuthProviderScopes = {
        default: [ACCOUNT_READ, REPOSITORY_READ, REPOSITORY_WRITE, PULL_REQUEST_READ, PULL_REQUEST_WRITE, WEBHOOK],
        all: [ACCOUNT_READ, REPOSITORY_READ, REPOSITORY_WRITE, PULL_REQUEST_READ, PULL_REQUEST_WRITE, WEBHOOK],
        descriptions: {
            ACCOUNT_READ: "Grants read-only access to your account information.",
            REPOSITORY_READ: "Read-only access to your repositories (note: Bitbucket doesn't support revoking scopes)",
            REPOSITORY_WRITE: "Grants read/write access to your repositories (note: Bitbucket doesn't support revoking scopes)",
            PULL_REQUEST_READ: "Grants read-only access to pull requests and ability to collaborate via comments, tasks, and approvals (note: Bitbucket doesn't support revoking scopes)",
            PULL_REQUEST_WRITE: "Allows creating, merging and declining pull requests (note: Bitbucket doesn't support revoking scopes)",
            WEBHOOK: "Allows installing webhooks (used when enabling prebuilds for a repository, note: Bitbucket doesn't support revoking scopes)",
        }
    };
}