/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// https://confluence.atlassian.com/bitbucketserver/bitbucket-oauth-2-0-provider-api-1108483661.html#BitbucketOAuth2.0providerAPI-scopesScopes

export namespace BitbucketServerOAuthScopes {
    /** View projects and repositories that are publicly accessible, including pulling code and cloning repositories. */
    export const PUBLIC_REPOS = "PUBLIC_REPOS";
    /** View projects and repositories the user account can view, including pulling code, cloning, and forking repositories. Create and comment on pull requests. */
    export const REPOSITORY_READ = "REPO_READ";
    /** Push over https, fork repo */
    export const REPOSITORY_WRITE = "REPO_WRITE";

    export const ALL = [PUBLIC_REPOS, REPOSITORY_READ, REPOSITORY_WRITE];

    export const Requirements = {
        /**
         * Minimal required permission.
         */
        DEFAULT: ALL
    }
}
