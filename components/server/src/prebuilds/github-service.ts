/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { inject, injectable } from "inversify";
import { GitHubApiError, GitHubRestApi } from "../github/api";
import { GitHubEnterpriseApp } from "./github-enterprise-app";
import { GithubContextParser } from "../github/github-context-parser";
import { User } from "@gitpod/gitpod-protocol";
import { Config } from "../config";
import { RepoURL } from "../repohost";
import { UnauthorizedError } from "../errors";
import { GitHubOAuthScopes } from "@gitpod/public-api-common/lib/auth-providers";

@injectable()
export class GitHubService extends RepositoryService {
    constructor(
        @inject(GitHubRestApi) protected readonly githubApi: GitHubRestApi,
        @inject(Config) private readonly config: Config,
        @inject(GithubContextParser) private readonly githubContextParser: GithubContextParser,
    ) {
        super();
    }

    async isGitpodWebhookEnabled(user: User, cloneUrl: string): Promise<boolean> {
        try {
            const { owner, repoName: repo } = await this.githubContextParser.parseURL(user, cloneUrl);
            const webhooks = (await this.githubApi.run(user, (gh) => gh.repos.listWebhooks({ owner, repo }))).data;
            return webhooks.some((webhook) => webhook.config.url === this.getHookUrl());
        } catch (error) {
            if (GitHubApiError.is(error)) {
                throw UnauthorizedError.create({
                    host: RepoURL.parseRepoUrl(cloneUrl)!.host,
                    providerType: "GitHub",
                    repoName: RepoURL.parseRepoUrl(cloneUrl)!.repo,
                    requiredScopes: GitHubOAuthScopes.Requirements.DEFAULT,
                    providerIsConnected: true,
                });
            }
            throw error;
        }
    }

    protected getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: GitHubEnterpriseApp.path,
            })
            .toString();
    }
}
