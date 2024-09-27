/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

export namespace GitLabOAuthScopes {
    export const READ_USER = "read_user";
    export const API = "api";
    export const READ_REPO = "read_repository";

    export const ALL = [READ_USER, API, READ_REPO];

    export const Requirements = {
        /**
         * Minimal required permission.
         * GitLab API usage requires the permission of a user.
         */
        DEFAULT: [READ_USER, API],

        REPO: [API, READ_REPO],
    };
}

export namespace GitHubOAuthScopes {
    export const EMAIL = "user:email";
    export const READ_USER = "read:user";
    export const PUBLIC = "public_repo";
    export const PRIVATE = "repo";
    export const ORGS = "read:org";
    export const WORKFLOW = "workflow";

    export const ALL = [EMAIL, READ_USER, PUBLIC, PRIVATE, ORGS, WORKFLOW];

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

export namespace BitbucketOAuthScopes {
    // https://confluence.atlassian.com/bitbucket/oauth-on-bitbucket-cloud-238027431.html

    /** Read user info like name, e-mail addresses etc. */
    export const ACCOUNT_READ = "account";
    /** Access repo info, clone repo over https, read and write issues */
    export const REPOSITORY_READ = "repository";
    /** Push over https, fork repo */
    export const REPOSITORY_WRITE = "repository:write";
    /** Lists and read pull requests */
    export const PULL_REQUEST_READ = "pullrequest";
    /** Create, comment and merge pull requests */
    export const PULL_REQUEST_WRITE = "pullrequest:write";

    export const ALL = [ACCOUNT_READ, REPOSITORY_READ, REPOSITORY_WRITE, PULL_REQUEST_READ, PULL_REQUEST_WRITE];

    export const Requirements = {
        /**
         * Minimal required permission.
         */
        DEFAULT: ALL,
    };
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

    export const Requirements = {
        /**
         * Minimal required permission.
         */
        DEFAULT: [PUBLIC_REPOS, REPO_READ, REPO_WRITE],
    };
}

export namespace AzureDevOpsOAuthScopes {
    export const READ_USER = "https://app.vssps.visualstudio.com/vso.profile";
    export const WRITE_REPO = "https://app.vssps.visualstudio.com/vso.code_write";

    // extend token lifetime
    const OFFLINE_ACCESS = "offline_access";
    export const APPEND_WHEN_FETCHING = [OFFLINE_ACCESS];

    export const ALL = [READ_USER, WRITE_REPO];
    export const REPO = [WRITE_REPO];
    export const DEFAULT = ALL;
    export const Requirements = {
        DEFAULT: [READ_USER, WRITE_REPO],
    };
}

export function getScopesForAuthProviderType(type: AuthProviderType | string) {
    switch (type) {
        case AuthProviderType.GITHUB:
        case "GitHub":
            return GitHubOAuthScopes.ALL;
        case AuthProviderType.GITLAB:
        case "GitLab":
            return GitLabOAuthScopes.ALL;
        case AuthProviderType.BITBUCKET:
        case "Bitbucket":
            return BitbucketOAuthScopes.ALL;
        case AuthProviderType.BITBUCKET_SERVER:
        case "BitbucketServer":
            return BitbucketServerOAuthScopes.ALL;
        case AuthProviderType.AZURE_DEVOPS:
        case "AzureDevOps":
            return AzureDevOpsOAuthScopes.ALL;
    }
}

export function getRequiredScopes(type: AuthProviderType | string) {
    switch (type) {
        case AuthProviderType.GITHUB:
        case "GitHub":
            return {
                default: GitHubOAuthScopes.Requirements.DEFAULT,
                publicRepo: GitHubOAuthScopes.Requirements.PUBLIC_REPO,
                privateRepo: GitHubOAuthScopes.Requirements.PRIVATE_REPO,
            };
        case AuthProviderType.GITLAB:
        case "GitLab":
            return {
                default: GitLabOAuthScopes.Requirements.DEFAULT,
                publicRepo: GitLabOAuthScopes.Requirements.DEFAULT,
                privateRepo: GitLabOAuthScopes.Requirements.REPO,
            };
        case AuthProviderType.BITBUCKET:
        case "Bitbucket":
            return {
                default: BitbucketOAuthScopes.Requirements.DEFAULT,
                publicRepo: BitbucketOAuthScopes.Requirements.DEFAULT,
                privateRepo: BitbucketOAuthScopes.Requirements.DEFAULT,
            };
        case AuthProviderType.BITBUCKET_SERVER:
        case "BitbucketServer":
            return {
                default: BitbucketServerOAuthScopes.Requirements.DEFAULT,
                publicRepo: BitbucketServerOAuthScopes.Requirements.DEFAULT,
                privateRepo: BitbucketServerOAuthScopes.Requirements.DEFAULT,
            };
        case AuthProviderType.AZURE_DEVOPS:
        case "AzureDevOps":
            return {
                default: AzureDevOpsOAuthScopes.Requirements.DEFAULT,
                publicRepo: AzureDevOpsOAuthScopes.Requirements.DEFAULT,
                privateRepo: AzureDevOpsOAuthScopes.Requirements.DEFAULT,
            };
    }
}

export function getScopeNameForScope(scope: string) {
    // Azure DevOps scopes are URLs, we only want to display the last part
    if (scope.startsWith("https://app.vssps.visualstudio.com/")) {
        return scope.replace("https://app.vssps.visualstudio.com/", "");
    }
    return scope;
}
