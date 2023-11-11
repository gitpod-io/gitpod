/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { GitHubScope } from "../github/scopes";
import { GitLabScope } from "../gitlab/scopes";
import { BitbucketOAuthScopes } from "../bitbucket/bitbucket-oauth-scopes";
import { BitbucketServerOAuthScopes } from "../bitbucket-server/bitbucket-server-oauth-scopes";

export function getRequiredScopes(entry: AuthProviderEntry) {
    switch (entry.type) {
        case "GitHub":
            return {
                default: GitHubScope.Requirements.DEFAULT,
                publicRepo: GitHubScope.Requirements.PUBLIC_REPO,
                privateRepo: GitHubScope.Requirements.PRIVATE_REPO,
            };
        case "GitLab":
            return {
                default: GitLabScope.Requirements.DEFAULT,
                publicRepo: GitLabScope.Requirements.DEFAULT,
                privateRepo: GitLabScope.Requirements.REPO,
            };
        case "Bitbucket":
            return {
                default: BitbucketOAuthScopes.Requirements.DEFAULT,
                publicRepo: BitbucketOAuthScopes.Requirements.DEFAULT,
                privateRepo: BitbucketOAuthScopes.Requirements.DEFAULT,
            };
        case "BitbucketServer":
            return {
                default: BitbucketServerOAuthScopes.Requirements.DEFAULT,
                publicRepo: BitbucketServerOAuthScopes.Requirements.DEFAULT,
                privateRepo: BitbucketServerOAuthScopes.Requirements.DEFAULT,
            };
    }
}
export function getScopesOfProvider(entry: AuthProviderEntry) {
    switch (entry.type) {
        case "GitHub":
            return GitHubScope.All;
        case "GitLab":
            return GitLabScope.All;
        case "Bitbucket":
            return BitbucketOAuthScopes.ALL;
        case "BitbucketServer":
            return BitbucketServerOAuthScopes.ALL;
    }
}
