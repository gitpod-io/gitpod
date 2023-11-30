/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

export namespace GitLabScope {
    export const READ_USER = "read_user";
    export const API = "api";
    export const READ_REPO = "read_repository";

    export const ALL = [READ_USER, API, READ_REPO];
    /**
     * Minimal required permission.
     * GitLab API usage requires the permission of a user.
     */
    export const DEFAULT = [READ_USER, API];
    export const REPO = [API, READ_REPO];
}

export namespace GitHubScope {
    export const EMAIL = "user:email";
    export const READ_USER = "read:user";
    export const PUBLIC = "public_repo";
    export const PRIVATE = "repo";
    export const ORGS = "read:org";
    export const WORKFLOW = "workflow";

    export const ALL = [EMAIL, READ_USER, PUBLIC, PRIVATE, ORGS, WORKFLOW];
    export const DEFAULT = ALL;
    export const PUBLIC_REPO = ALL;
    export const PRIVATE_REPO = ALL;
}

export namespace BitbucketOAuthScopes {
    // https://confluence.atlassian.com/bitbucket/oauth-on-bitbucket-cloud-238027431.html

    /** Read user info like name, e-mail adresses etc. */
    export const ACCOUNT_READ = "account";
    /** Access repo info, clone repo over https, read and write issues */
    export const REPOSITORY_READ = "repository";
    /** Push over https, fork repo */
    export const REPOSITORY_WRITE = "repository:write";
    /** Lists and read pull requests */
    export const PULL_REQUEST_READ = "pullrequest";
    /** Create, comment and merge pull requests */
    export const PULL_REQUEST_WRITE = "pullrequest:write";
    /** Create, list web hooks */
    export const WEBHOOK = "webhook";

    export const ALL = [
        ACCOUNT_READ,
        REPOSITORY_READ,
        REPOSITORY_WRITE,
        PULL_REQUEST_READ,
        PULL_REQUEST_WRITE,
        WEBHOOK,
    ];

    export const DEFAULT = ALL;
}

export namespace BitbucketServerOAuthScopes {
    // https://confluence.atlassian.com/bitbucketserver/bitbucket-oauth-2-0-provider-api-1108483661.html#BitbucketOAuth2.0providerAPI-scopesScopes

    /** View projects and repositories that are publicly accessible, including pulling code and cloning repositories. */
    export const PUBLIC_REPOS = "PUBLIC_REPOS";
    /** View projects and repositories the user account can view, including pulling code, cloning, and forking repositories. Create and comment on pull requests. */
    export const REPO_READ = "REPO_READ";
    /** Push over https, fork repo */
    export const REPO_WRITE = "REPO_WRITE";

    export const REPO_ADMIN = "REPO_ADMIN";
    export const PROJECT_ADMIN = "PROJECT_ADMIN";

    export const ALL = [PUBLIC_REPOS, REPO_READ, REPO_WRITE, REPO_ADMIN, PROJECT_ADMIN];

    export const DEFAULT = ALL;
}

export function getScopesForAuthProviderType(type: AuthProviderType | string) {
    switch (type) {
        case AuthProviderType.GITHUB:
        case "GitHub":
            return GitHubScope.ALL;
        case AuthProviderType.GITLAB:
        case "GitLab":
            return GitLabScope.ALL;
        case AuthProviderType.BITBUCKET:
        case "Bitbucket":
            return BitbucketOAuthScopes.ALL;
        case AuthProviderType.BITBUCKET_SERVER:
        case "BitbucketServer":
            return BitbucketServerOAuthScopes.ALL;
    }
}

export function getRequiredScopes(type: AuthProviderType | string) {
    switch (type) {
        case AuthProviderType.GITHUB:
        case "GitHub":
            return {
                default: GitHubScope.DEFAULT,
                publicRepo: GitHubScope.PUBLIC_REPO,
                privateRepo: GitHubScope.PRIVATE_REPO,
            };
        case AuthProviderType.GITLAB:
        case "GitLab":
            return {
                default: GitLabScope.DEFAULT,
                publicRepo: GitLabScope.DEFAULT,
                privateRepo: GitLabScope.REPO,
            };
        case AuthProviderType.BITBUCKET:
        case "Bitbucket":
            return {
                default: BitbucketOAuthScopes.DEFAULT,
                publicRepo: BitbucketOAuthScopes.DEFAULT,
                privateRepo: BitbucketOAuthScopes.DEFAULT,
            };
        case AuthProviderType.BITBUCKET_SERVER:
        case "BitbucketServer":
            return {
                default: BitbucketServerOAuthScopes.DEFAULT,
                publicRepo: BitbucketServerOAuthScopes.DEFAULT,
                privateRepo: BitbucketServerOAuthScopes.DEFAULT,
            };
    }
}
