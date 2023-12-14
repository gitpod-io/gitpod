/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { inject, injectable } from "inversify";
import { GitHubRestApi } from "../github/api";
import { GitHubEnterpriseApp } from "./github-enterprise-app";
import { GithubContextParser } from "../github/github-context-parser";
import { User } from "@gitpod/gitpod-protocol";
import { Config } from "../config";
import { TokenService } from "../user/token-service";

@injectable()
export class GitHubService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    constructor(
        @inject(GitHubRestApi) protected readonly githubApi: GitHubRestApi,
        @inject(Config) private readonly config: Config,
        @inject(TokenService) private readonly tokenService: TokenService,
        @inject(GithubContextParser) private readonly githubContextParser: GithubContextParser,
    ) {
        super();
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        const { owner, repoName: repo } = await this.githubContextParser.parseURL(user, cloneUrl);
        const webhooks = (await this.githubApi.run(user, (gh) => gh.repos.listWebhooks({ owner, repo }))).data;
        for (const webhook of webhooks) {
            if (webhook.config.url === this.getHookUrl()) {
                await this.githubApi.run(user, (gh) => gh.repos.deleteWebhook({ owner, repo, hook_id: webhook.id }));
            }
        }
        const tokenEntry = await this.tokenService.createGitpodToken(
            user,
            GitHubService.PREBUILD_TOKEN_SCOPE,
            cloneUrl,
        );
        const config = {
            url: this.getHookUrl(),
            content_type: "json",
            secret: user.id + "|" + tokenEntry.token.value,
        };
        await this.githubApi.run(user, (gh) => gh.repos.createWebhook({ owner, repo, config }));
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
